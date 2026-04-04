const express = require('express');
const router = express.Router();
const sql = require('mssql');
const os = require('os'); // Thư viện lấy thông tin phần cứng

module.exports = function(dbConfig) {

    // --- MIDDLEWARE KIỂM TRA QUYỀN ADMIN ---
    const checkAdmin = (req, res, next) => {
        if (req.user && (req.user.role === 'Admin' || req.user.VaiTro === 'Admin')) {
            next();
        } else {
            res.status(403).json({ message: 'Truy cập bị từ chối' });
        }
    };

    router.use(checkAdmin); // Áp dụng cho tất cả API bên dưới

    // 1. LẤY DANH SÁCH USER (QUẢN LÝ NGƯỜI DÙNG)
    router.get('/users', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query(`
                SELECT TK.ID_TK, TK.TenDangNhap, TK.VaiTro, HS.HoTen, HS.Email, HS.ID_CD
                FROM TaiKhoan TK
                LEFT JOIN HoSoCongDan HS ON TK.ID_CD = HS.ID_CD
            `);
            res.json(result.recordset);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // 2. ĐỔI QUYỀN (ROLE)
    router.put('/users/role', async (req, res) => {
        try {
            const { id_tk, newRole } = req.body;
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.Int, id_tk)
                .input('role', sql.NVarChar, newRole)
                .query("UPDATE TaiKhoan SET VaiTro = @role WHERE ID_TK = @id");
            res.json({ message: 'Cập nhật quyền thành công!' });
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // 3. LẤY THÔNG SỐ HỆ THỐNG (MONITORING)
    router.get('/stats', async (req, res) => {
        try {
            // Lấy thông tin DB Size
            const pool = await sql.connect(dbConfig);
            const dbSizeResult = await pool.request().query("EXEC sp_spaceused");
            
            // Thông tin Server (Node.js OS)
            const freeMem = os.freemem() / (1024 * 1024 * 1024); // GB
            const totalMem = os.totalmem() / (1024 * 1024 * 1024); // GB
            const usedMem = totalMem - freeMem;

            const stats = {
                dbSize: dbSizeResult.recordset[0].database_size,
                ramUsed: usedMem.toFixed(2),
                ramTotal: totalMem.toFixed(2),
                cpuModel: os.cpus()[0].model,
               uptime: (process.uptime() / 3600).toFixed(1) + ' giờ' // Thời gian Server chạy
            };
            res.json(stats);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // 4. LẤY LOG HỆ THỐNG
    router.get('/logs', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT TOP 50 * FROM SystemLogs ORDER BY ThoiGian DESC");
            res.json(result.recordset);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });

    // 5. THỰC HIỆN BACKUP (HÀNG THẬT - REAL)
    router.post('/backup', async (req, res) => {
        try {
            const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14); // Tạo chuỗi thời gian
            const fileName = `DACN_${timestamp}.bak`;
            
            // !!! QUAN TRỌNG: Đổi đường dẫn này thành thư mục bạn vừa tạo ở Bước 1 !!!
            // Lưu ý: Dùng 2 dấu gạch chéo \\ trong chuỗi
            const backupPath = `C:\\SQLBackups\\${fileName}`; 

            const pool = await sql.connect(dbConfig);
            
            // 1. Thực hiện lệnh Backup thật của SQL Server
            await pool.request().query(`
                BACKUP DATABASE [dacn] 
                TO DISK = '${backupPath}' 
                WITH FORMAT, 
                MEDIANAME = 'DACN_Backup', 
                NAME = 'Full Backup of DACN';
            `);

            // 2. Lấy kích thước file vừa tạo (Optional - để ghi log cho đẹp)
            // (Ở đây mình tạm ghi cứng hoặc dùng fs.stat nếu muốn chính xác tuyệt đối)
            
            // 3. Ghi lịch sử vào DB
            await pool.request()
                .input('ten', sql.NVarChar, fileName)
                .input('size', sql.NVarChar, 'Unknown (Real File)') 
                .input('status', sql.NVarChar, 'Success')
                .input('user', sql.NVarChar, req.user.HoTen || 'Admin')
                .query("INSERT INTO BackupHistory (TenFile, KichThuoc, TrangThai, NguoiThucHien) VALUES (@ten, @size, @status, @user)");

            res.json({ message: `Sao lưu dữ liệu thành công! File đã lưu tại: ${backupPath}`, file: fileName });

        } catch (err) {
            console.error("Lỗi Backup:", err);
            // Ghi log lỗi vào lịch sử luôn
            const pool = await sql.connect(dbConfig);
             await pool.request()
                .input('ten', sql.NVarChar, 'Backup Failed')
                .input('size', sql.NVarChar, '0KB') 
                .input('status', sql.NVarChar, 'Failed')
                .input('user', sql.NVarChar, req.user.HoTen || 'Admin')
                .query("INSERT INTO BackupHistory (TenFile, KichThuoc, TrangThai, NguoiThucHien) VALUES (@ten, @size, @status, @user)");

            res.status(500).json({ message: 'Lỗi sao lưu: ' + err.message });
        }
    });

    // 6. LẤY LỊCH SỬ BACKUP
    router.get('/backups', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query("SELECT TOP 10 * FROM BackupHistory ORDER BY ThoiGian DESC");
            res.json(result.recordset);
        } catch (err) {
            res.status(500).json({ message: err.message });
        }
    });
    // ... (Các code cũ giữ nguyên) ...

   // 7. LẤY THỐNG KÊ DASHBOARD (PHIÊN BẢN TRỰC TIẾP - CHẮC CHẮN CHẠY)
    router.get('/dashboard-stats', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);

            // Chạy 3 câu lệnh song song (Bỏ qua việc kiểm tra cột, gọi thẳng luôn)
            const [totalUsersResult, newUsersResult, pendingServicesResult] = await Promise.all([
                
                // 1. Tổng số User (trừ Admin)
                pool.request().query("SELECT COUNT(*) AS Count FROM TaiKhoan WHERE VaiTro = 'User'"),
                
                // 2. User mới tháng này (Dựa vào cột NgayTao)
                pool.request().query(`
                    SELECT COUNT(*) AS Count 
                    FROM TaiKhoan 
                    WHERE VaiTro = 'User' 
                    AND MONTH(NgayTao) = MONTH(GETDATE()) 
                    AND YEAR(NgayTao) = YEAR(GETDATE())
                `),

                // 3. Hồ sơ DVC chờ xử lý
                pool.request().query("SELECT COUNT(*) AS Count FROM HoSoDichVuCong WHERE TrangThai = N'Chờ xử lý'")
            ]);

            // Lấy kết quả ra
            const stats = {
                totalUsers: totalUsersResult.recordset[0].Count || 0,
                newUsers: newUsersResult.recordset[0].Count || 0,
                pendingServices: pendingServicesResult.recordset[0].Count || 0
            };

            console.log("Server gửi về dashboard:", stats); // In ra console server để kiểm tra
            res.json(stats);

        } catch (err) { 
            console.error('Lỗi Dashboard API:', err);
            // Nếu lỗi SQL (ví dụ sai tên cột), trả về 0 để không sập web
            res.status(500).json({ message: err.message });
        }
    });
    // return router; (Dòng này nằm ở cuối file, không copy)
    return router;
};