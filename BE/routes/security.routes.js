const sql = require('mssql');

module.exports = function(app, authenticateToken, dbConfig) {

    // 1. ĐỔI MẬT KHẨU
    app.put('/api/security/change-password', authenticateToken, async (req, res) => {
        try {
            const { matKhauCu, matKhauMoi } = req.body;
            const id_tk = req.user.id;

            if (!matKhauCu || !matKhauMoi) {
                return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
            }

            const pool = await sql.connect(dbConfig);
            
            // Kiểm tra mật khẩu cũ có đúng không
            const checkRes = await pool.request()
                .input('id_tk', sql.Int, id_tk)
                .query("SELECT MatKhau FROM TaiKhoan WHERE ID_TK = @id_tk");
            
            const currentPass = checkRes.recordset[0].MatKhau.trim();

            if (currentPass !== matKhauCu) {
                return res.status(400).json({ message: 'Mật khẩu cũ không chính xác.' });
            }

            // Cập nhật mật khẩu mới
            await pool.request()
                .input('id_tk', sql.Int, id_tk)
                .input('newPass', sql.NVarChar, matKhauMoi)
                .query("UPDATE TaiKhoan SET MatKhau = @newPass WHERE ID_TK = @id_tk");

            res.json({ message: 'Đổi mật khẩu thành công!' });

        } catch (error) {
            console.error('Lỗi đổi mật khẩu:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // 2. LẤY LỊCH SỬ ĐĂNG NHẬP
    app.get('/api/security/history', authenticateToken, async (req, res) => {
        try {
            const id_tk = req.user.id;
            const pool = await sql.connect(dbConfig);
            
            // Lấy 10 lần đăng nhập gần nhất
            const result = await pool.request()
                .input('id_tk', sql.Int, id_tk)
                .query(`
                    SELECT TOP 10 ThoiGian, ThietBi, IPAddress 
                    FROM LichSuDangNhap 
                    WHERE ID_TK = @id_tk 
                    ORDER BY ThoiGian DESC
                `);

            res.json(result.recordset);
        } catch (error) {
            console.error('Lỗi lấy lịch sử:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });
    // ... (các API đổi mật khẩu, lịch sử đăng nhập giữ nguyên)

    // 3. LẤY THÔNG TIN TÀI KHOẢN (Email, SĐT, Địa chỉ)
    app.get('/api/security/info', authenticateToken, async (req, res) => {
        try {
            const id_cd = req.user.id_cd; // Lấy ID công dân từ token
            const pool = await sql.connect(dbConfig);
            
            const result = await pool.request()
                .input('id_cd', sql.NVarChar, id_cd)
                .query(`
                    SELECT HoTen, Email, SDT, DC, QueQuan, TonGiao 
                    FROM HoSoCongDan 
                    WHERE ID_CD = @id_cd
                `);

            if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
            
            res.json(result.recordset[0]);
        } catch (error) {
            console.error('Lỗi lấy thông tin cá nhân:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // 4. CẬP NHẬT THÔNG TIN TÀI KHOẢN (LINH HOẠT - SỬA CÁI NÀO CẬP NHẬT CÁI ĐÓ)
    app.put('/api/security/info', authenticateToken, async (req, res) => {
        try {
            const id_cd = req.user.id_cd;
            
            // Lấy tất cả dữ liệu từ Client gửi lên
            const { email, sdt, diaChi, tonGiao } = req.body; 

            // Kết nối DB
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            request.input('id_cd', sql.NVarChar, id_cd);

            // Tạo mảng chứa các phần của câu lệnh SET
            let updateParts = [];

            // Kỹ thuật Dynamic SQL: Có dữ liệu mới thêm vào câu lệnh Update
            // Kiểm tra !== undefined để phân biệt giữa "không gửi" và "gửi rỗng"
            
            if (email !== undefined) {
                request.input('email', sql.NVarChar, email);
                updateParts.push("Email = @email");
            }

            if (sdt !== undefined) {
                request.input('sdt', sql.VarChar, sdt);
                updateParts.push("SDT = @sdt");
            }

            if (diaChi !== undefined) {
                request.input('dc', sql.NVarChar, diaChi);
                updateParts.push("DC = @dc");
            }

            // Sửa lỗi cũ: Đã khai báo và kiểm tra tonGiao đầy đủ
            if (tonGiao !== undefined) {
                request.input('tonGiao', sql.NVarChar, tonGiao);
                updateParts.push("TonGiao = @tonGiao");
            }

            // Nếu không có trường nào được gửi lên thì báo lỗi
            if (updateParts.length === 0) {
                return res.status(400).json({ message: 'Không có thông tin nào để cập nhật.' });
            }

            // Ghép các phần lại thành câu lệnh SQL hoàn chỉnh
            // Ví dụ: UPDATE HoSoCongDan SET Email = @email, TonGiao = @tonGiao WHERE ID_CD = @id_cd
            const query = `UPDATE HoSoCongDan SET ${updateParts.join(', ')} WHERE ID_CD = @id_cd`;

            // Thực thi
            await request.query(query);

            res.json({ message: 'Cập nhật thông tin thành công!' });

        } catch (error) {
            console.error('Lỗi cập nhật thông tin:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });
};