const sql = require('mssql');

module.exports = function(app, authenticateToken, authorizeAdmin, dbConfig) {

    // ==========================================
    // 1. THỐNG KÊ (Dashboard Việc làm)
    // ==========================================
    app.get('/api/admin/jobs/stats', authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const [unemployedRes, activeJobsRes, totalUsersRes] = await Promise.all([
                // Đếm số người thất nghiệp (TinhTrangViecLam = 0)
                pool.request().query("SELECT COUNT(*) AS Count FROM TaiKhoan WHERE TinhTrangViecLam = 0"),
                // Đếm số tin tuyển dụng đang mở (chưa hết hạn)
                pool.request().query("SELECT COUNT(*) AS Count FROM TinTuyenDung WHERE HanNopHoSo >= GETDATE()"),
                // Tổng số user (để tính %)
                pool.request().query("SELECT COUNT(*) AS Count FROM TaiKhoan WHERE VaiTro = 'User'")
            ]);

            const stats = {
                unemployed: unemployedRes.recordset[0].Count || 0,
                activeJobs: activeJobsRes.recordset[0].Count || 0,
                totalUsers: totalUsersRes.recordset[0].Count || 0
            };
            res.json(stats);
        } catch (error) {
            console.error('Lỗi Admin Job Stats:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // ==========================================
    // 2. QUẢN LÝ HỒ SƠ VIỆC LÀM CÔNG DÂN
    // ==========================================
    
    // Xem chi tiết hồ sơ việc làm của 1 công dân
    app.get('/api/admin/jobs/profile/:id_cd', authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id_cd } = req.params;
            const pool = await sql.connect(dbConfig);
            
            // Lấy ID_TK từ ID_CD
            const tkRes = await pool.request().input('id_cd', sql.NVarChar, id_cd).query("SELECT ID_TK, TinhTrangViecLam FROM TaiKhoan WHERE ID_CD = @id_cd");
            if (tkRes.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy công dân.' });
            
            const { ID_TK, TinhTrangViecLam } = tkRes.recordset[0];

            // Lấy lịch sử làm việc
            const historyRes = await pool.request().input('id_tk', sql.Int, ID_TK).query("SELECT * FROM HoSoViecLam WHERE ID_TK = @id_tk ORDER BY NgayBD DESC");
            
            // Lấy thông tin ứng tuyển
            const applyRes = await pool.request().input('id_tk', sql.Int, ID_TK).query(`
                SELECT UT.*, Tin.TieuDe, Tin.TenCongTy 
                FROM UngTuyen UT 
                JOIN TinTuyenDung Tin ON UT.ID_Tin = Tin.ID_Tin 
                WHERE UT.ID_TK = @id_tk 
                ORDER BY UT.NgayUngTuyen DESC
            `);

            res.json({
                tinhTrang: TinhTrangViecLam,
                lichSuLamViec: historyRes.recordset,
                lichSuUngTuyen: applyRes.recordset
            });
        } catch (error) {
            console.error('Lỗi Admin Get Job Profile:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // ==========================================
    // 3. CRUD TIN TUYỂN DỤNG
    // ==========================================

    // Lấy danh sách tất cả tin tuyển dụng
    app.get('/api/admin/jobs/list', authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT * FROM TinTuyenDung ORDER BY NgayDang DESC");
            res.json(result.recordset);
        } catch (error) {
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // Thêm tin tuyển dụng mới
    app.post('/api/admin/jobs/create', authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { tieuDe, tenCongTy, nganhNghe, mucLuong, diaDiem, moTa, hanNop } = req.body;
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('tieuDe', sql.NVarChar, tieuDe)
                .input('tenCongTy', sql.NVarChar, tenCongTy)
                .input('nganhNghe', sql.NVarChar, nganhNghe)
                .input('mucLuong', sql.NVarChar, mucLuong)
                .input('diaDiem', sql.NVarChar, diaDiem)
                .input('moTa', sql.NVarChar, moTa)
                .input('hanNop', sql.Date, hanNop)
                .query(`
                    INSERT INTO TinTuyenDung (TieuDe, TenCongTy, NganhNghe, MucLuong, DiaDiem, MoTa, HanNopHoSo)
                    VALUES (@tieuDe, @tenCongTy, @nganhNghe, @mucLuong, @diaDiem, @moTa, @hanNop)
                `);
            res.json({ message: 'Đăng tin thành công!' });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // Sửa tin tuyển dụng
    app.put('/api/admin/jobs/update/:id', authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { tieuDe, tenCongTy, nganhNghe, mucLuong, diaDiem, moTa, hanNop } = req.body;
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.Int, id)
                .input('tieuDe', sql.NVarChar, tieuDe)
                .input('tenCongTy', sql.NVarChar, tenCongTy)
                .input('nganhNghe', sql.NVarChar, nganhNghe)
                .input('mucLuong', sql.NVarChar, mucLuong)
                .input('diaDiem', sql.NVarChar, diaDiem)
                .input('moTa', sql.NVarChar, moTa)
                .input('hanNop', sql.Date, hanNop)
                .query(`
                    UPDATE TinTuyenDung 
                    SET TieuDe=@tieuDe, TenCongTy=@tenCongTy, NganhNghe=@nganhNghe, 
                        MucLuong=@mucLuong, DiaDiem=@diaDiem, MoTa=@moTa, HanNopHoSo=@hanNop
                    WHERE ID_Tin = @id
                `);
            res.json({ message: 'Cập nhật tin thành công!' });
        } catch (error) {
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // Xóa tin tuyển dụng
    app.delete('/api/admin/jobs/delete/:id', authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await sql.connect(dbConfig);
            // Xóa các đơn ứng tuyển liên quan trước (nếu không có CASCADE DELETE)
            await pool.request().input('id', sql.Int, id).query("DELETE FROM UngTuyen WHERE ID_Tin = @id");
            // Xóa tin
            await pool.request().input('id', sql.Int, id).query("DELETE FROM TinTuyenDung WHERE ID_Tin = @id");
            res.json({ message: 'Xóa tin thành công!' });
        } catch (error) {
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // ==========================================
    // 4. XEM HỒ SƠ ỨNG TUYỂN (Của 1 tin cụ thể)
    // ==========================================
    app.get('/api/admin/jobs/applications/:id_tin', authenticateToken, authorizeAdmin, async (req, res) => {
        try {
            const { id_tin } = req.params;
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id_tin', sql.Int, id_tin)
                .query(`
                    SELECT UT.*, HS.HoTen, HS.ID_CD, HS.Email
                    FROM UngTuyen UT
                    JOIN TaiKhoan TK ON UT.ID_TK = TK.ID_TK
                    JOIN HoSoCongDan HS ON TK.ID_CD = HS.ID_CD
                    WHERE UT.ID_Tin = @id_tin
                    ORDER BY UT.NgayUngTuyen DESC
                `);
            res.json(result.recordset);
        } catch (error) {
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });
};