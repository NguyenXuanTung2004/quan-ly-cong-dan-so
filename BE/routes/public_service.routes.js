const express = require('express');
const router = express.Router();
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

module.exports = function(dbConfig) { // <--- NHẬN dbConfig TỪ SERVER

    // --- CẤU HÌNH UPLOAD FILE ---
    const uploadDir = path.join(__dirname, '../uploads/dichvucong');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    });
    const upload = multer({ storage: storage });

    // --- API 1: LẤY DANH SÁCH DỊCH VỤ ---
    router.get('/categories', async (req, res) => {
        try {
            // KẾT NỐI DB TRƯỚC KHI QUERY
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query(`
                SELECT MaDichVu, TenDichVu, NhomDichVu, CoSoPhapLy, MoTa 
                FROM DanhMucDichVu 
                ORDER BY NhomDichVu, TenDichVu
            `);
            res.json(result.recordset);
        } catch (err) {
            console.error('Lỗi lấy danh mục DVC:', err);
            res.status(500).send('Lỗi server');
        }
    });

    // --- API 2: NỘP HỒ SƠ ---
    router.post('/submit', upload.single('fileDinhKem'), async (req, res) => {
        try {
            const userId = req.user.id; 
            const { maDichVu, nguoiNop, cccdNguoiNop, duLieuChiTiet } = req.body;
            
            const filePath = req.file ? `/uploads/dichvucong/${req.file.filename}` : null;

            // KẾT NỐI DB
            const pool = await sql.connect(dbConfig);

            // Lấy tên dịch vụ
            const request = pool.request();
            request.input('MaDichVu', sql.NVarChar, maDichVu);
            const serviceInfo = await request.query("SELECT TenDichVu FROM DanhMucDichVu WHERE MaDichVu = @MaDichVu");
            
            let tenDichVu = maDichVu;
            if(serviceInfo.recordset.length > 0) tenDichVu = serviceInfo.recordset[0].TenDichVu;

            // Lưu hồ sơ
            const insertReq = pool.request();
            insertReq.input('ID_TK', sql.Int, userId);
            insertReq.input('LoaiDichVu', sql.NVarChar, tenDichVu);
            insertReq.input('NguoiNop', sql.NVarChar, nguoiNop);
            insertReq.input('CCCDNguoiNop', sql.NVarChar, cccdNguoiNop);
            insertReq.input('DuLieuChiTiet', sql.NVarChar, duLieuChiTiet);
            insertReq.input('FileDinhKem', sql.NVarChar, filePath);
            
            await insertReq.query(`
                INSERT INTO HoSoDichVuCong 
                (ID_TK, LoaiDichVu, NguoiNop, CCCDNguoiNop, DuLieuChiTiet, FileDinhKem, TrangThai)
                VALUES 
                (@ID_TK, @LoaiDichVu, @NguoiNop, @CCCDNguoiNop, @DuLieuChiTiet, @FileDinhKem, N'Chờ xử lý')
            `);

            res.json({ success: true, message: 'Nộp hồ sơ thành công!' });

        } catch (err) {
            console.error('Lỗi nộp hồ sơ:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    });

    // --- API 3: LẤY LỊCH SỬ HỒ SƠ ---
    router.get('/my-history', async (req, res) => {
        try {
            const userId = req.user.id;
            
            // KẾT NỐI DB
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            request.input('ID_TK', sql.Int, userId);
            
            const result = await request.query(`
                SELECT ID_HoSo, LoaiDichVu, NgayGui, TrangThai, GhiChuXuLy
                FROM HoSoDichVuCong
                WHERE ID_TK = @ID_TK
                ORDER BY NgayGui DESC
            `);
            
            res.json(result.recordset);
        } catch (err) {
            console.error('Lỗi lấy lịch sử:', err);
            res.status(500).send('Lỗi server');
        }
    });
    // ... (Các API của User giữ nguyên) ...

    // ==========================================
    // --- API ADMIN (QUẢN LÝ DỊCH VỤ CÔNG) ---
    // ==========================================

    // 4. Admin lấy danh sách tất cả hồ sơ
    // GET /api/public-service/admin/list
    router.get('/admin/list', async (req, res) => {
        try {
            // Kiểm tra quyền Admin (Middleware authorizeAdmin đã check ở server.js rồi, 
            // nhưng kiểm tra lại role trong req.user cho chắc chắn nếu cần)
            if (req.user.role !== 'Admin' && req.user.VaiTro !== 'Admin') {
                return res.status(403).send('Không có quyền truy cập');
            }

            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query(`
                SELECT HS.*, CD.HoTen, CD.Email
                FROM HoSoDichVuCong HS
                LEFT JOIN TaiKhoan TK ON HS.ID_TK = TK.ID_TK
                LEFT JOIN HoSoCongDan CD ON TK.ID_CD = CD.ID_CD
                ORDER BY 
                    CASE WHEN HS.TrangThai = N'Chờ xử lý' THEN 0 ELSE 1 END, -- Ưu tiên chờ xử lý lên đầu
                    HS.NgayGui DESC
            `);
            res.json(result.recordset);
        } catch (err) {
            console.error('Lỗi Admin lấy danh sách DVC:', err);
            res.status(500).send('Lỗi server');
        }
    });

    // 5. Admin duyệt / từ chối hồ sơ
    // PUT /api/public-service/admin/status
    router.put('/admin/status', async (req, res) => {
        try {
            if (req.user.role !== 'Admin' && req.user.VaiTro !== 'Admin') {
                return res.status(403).send('Không có quyền truy cập');
            }

            const { id_hoso, trangThai, ghiChu } = req.body;
            
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            request.input('ID_HoSo', sql.Int, id_hoso);
            request.input('TrangThai', sql.NVarChar, trangThai);
            request.input('GhiChu', sql.NVarChar, ghiChu);

            await request.query(`
                UPDATE HoSoDichVuCong
                SET TrangThai = @TrangThai, GhiChuXuLy = @GhiChu
                WHERE ID_HoSo = @ID_HoSo
            `);

            res.json({ success: true, message: 'Cập nhật trạng thái thành công!' });
        } catch (err) {
            console.error('Lỗi cập nhật trạng thái DVC:', err);
            res.status(500).send('Lỗi server');
        }
    });
    return router;
};