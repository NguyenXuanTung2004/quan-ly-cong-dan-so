const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ==========================================
// CẤU HÌNH UPLOAD FILE (MULTER)
// ==========================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'uploads/cv/';
        // Tạo thư mục nếu chưa tồn tại
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Tạo tên file duy nhất: cv-[thời gian]-[số ngẫu nhiên].[đuôi file]
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'cv-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Chỉ cho phép file PDF, DOC, DOCX, ảnh
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG) hoặc tài liệu (PDF, DOC)!'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
    fileFilter: fileFilter
});

const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;


// ==========================================
// ĐỊNH NGHĨA CÁC ROUTE
// ==========================================
module.exports = function(app, authenticateToken, dbConfig) {

    // ------------------------------------------
    // 1. QUẢN LÝ TRẠNG THÁI & BẢO HIỂM
    // ------------------------------------------

    // Lấy trạng thái làm việc
    app.get('/api/jobs/status', authenticateToken, async (req, res) => {
        try {
            const id_tk = req.user.id;
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id', sql.Int, id_tk)
                .query("SELECT TinhTrangViecLam FROM TaiKhoan WHERE ID_TK = @id");
            
            const status = result.recordset[0]?.TinhTrangViecLam; 
            res.json({ status: status !== null && status !== undefined ? status : 1 }); 
        } catch (error) {
            console.error('Lỗi GET /api/jobs/status:', error);
            res.status(500).json({ message: 'Lỗi server khi lấy trạng thái.' });
        }
    });

    // Cập nhật trạng thái làm việc
    app.put('/api/jobs/status', authenticateToken, async (req, res) => {
        try {
            const id_tk = req.user.id;
            const { status } = req.body; 
            
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.Int, id_tk)
                .input('st', sql.Int, status)
                .query("UPDATE TaiKhoan SET TinhTrangViecLam = @st WHERE ID_TK = @id");
            
            res.json({ message: 'Cập nhật trạng thái thành công!' });
        } catch (error) {
            console.error('Lỗi PUT /api/jobs/status:', error);
            res.status(500).json({ message: 'Lỗi server khi cập nhật trạng thái.' });
        }
    });

    // Đăng ký Bảo hiểm thất nghiệp
    app.post('/api/jobs/insurance', authenticateToken, async (req, res) => {
        try {
            const id_tk = req.user.id;
            const { soThangDong, lyDo, noiNhan } = req.body;

            const pool = await sql.connect(dbConfig);
            
            // Validate: Phải đang thất nghiệp
            const userCheck = await pool.request()
                .input('id', sql.Int, id_tk)
                .query("SELECT TinhTrangViecLam FROM TaiKhoan WHERE ID_TK = @id");

            if (userCheck.recordset[0].TinhTrangViecLam !== 0) {
                return res.status(400).json({ message: 'Bạn phải cập nhật trạng thái là "Thất nghiệp" trước khi đăng ký BHTN.' });
            }

            // Validate: Chưa có đơn đang chờ
            const existingApp = await pool.request()
                .input('id', sql.Int, id_tk)
                .query("SELECT * FROM BaoHiemThatNghiep WHERE ID_TK = @id AND TrangThaiDuyet = N'Chờ duyệt'");
            
            if (existingApp.recordset.length > 0) {
                return res.status(400).json({ message: 'Bạn đang có hồ sơ BHTN đang chờ duyệt.' });
            }

            await pool.request()
                .input('id', sql.Int, id_tk)
                .input('soThang', sql.Int, soThangDong)
                .input('lyDo', sql.NVarChar, lyDo)
                .input('noiNhan', sql.NVarChar, noiNhan)
                .query(`
                    INSERT INTO BaoHiemThatNghiep (ID_TK, SoThangDongBH, LyDoThatNghiep, NoiNhanTroCap)
                    VALUES (@id, @soThang, @lyDo, @noiNhan)
                `);
            
            res.json({ message: 'Gửi đăng ký Bảo hiểm thất nghiệp thành công!' });

        } catch (error) {
            console.error('Lỗi POST /api/jobs/insurance:', error);
            res.status(500).json({ message: 'Lỗi server khi đăng ký BHTN.' });
        }
    });

    // ------------------------------------------
    // 2. QUẢN LÝ LỊCH SỬ LÀM VIỆC (CRUD)
    // ------------------------------------------

    app.get('/api/jobs/history', authenticateToken, async (req, res) => {
        try {
            const id_tk = req.user.id;
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id_tk', sql.Int, id_tk)
                .query("SELECT * FROM HoSoViecLam WHERE ID_TK = @id_tk ORDER BY NgayBD DESC");
            
            res.json(result.recordset);
        } catch (error) {
            console.error('Lỗi GET /api/jobs/history:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    app.post('/api/jobs/history', authenticateToken, async (req, res) => {
        try {
            const id_tk = req.user.id;
            const { tenCV, loaiCV, noiLamViec, ngayBD, ngayKT } = req.body;

            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id_tk', sql.Int, id_tk)
                .input('tenCV', sql.NVarChar, tenCV)
                .input('loaiCV', sql.NVarChar, loaiCV)
                .input('noiLamViec', sql.NVarChar, noiLamViec)
                .input('ngayBD', sql.Date, ngayBD)
                .input('ngayKT', sql.Date, ngayKT || null)
                .query(`
                    INSERT INTO HoSoViecLam (ID_TK, TenCV, LoaiCV, NoiLamViec, NgayBD, NgayKT)
                    VALUES (@id_tk, @tenCV, @loaiCV, @noiLamViec, @ngayBD, @ngayKT)
                `);
            
            res.status(201).json({ message: 'Thêm kinh nghiệm làm việc thành công!' });
        } catch (error) {
            console.error('Lỗi POST /api/jobs/history:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    app.put('/api/jobs/history/:id', authenticateToken, async (req, res) => {
        try {
            const id_viec = req.params.id;
            const { tenCV, loaiCV, noiLamViec, ngayBD, ngayKT } = req.body;

            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.Int, id_viec)
                .input('tenCV', sql.NVarChar, tenCV)
                .input('loaiCV', sql.NVarChar, loaiCV)
                .input('noiLamViec', sql.NVarChar, noiLamViec)
                .input('ngayBD', sql.Date, ngayBD)
                .input('ngayKT', sql.Date, ngayKT || null)
                .query(`
                    UPDATE HoSoViecLam 
                    SET TenCV = @tenCV, LoaiCV = @loaiCV, NoiLamViec = @noiLamViec, 
                        NgayBD = @ngayBD, NgayKT = @ngayKT
                    WHERE ID_ViecLam = @id
                `);
            
            res.json({ message: 'Cập nhật thành công!' });
        } catch (error) {
            console.error('Lỗi PUT /api/jobs/history:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    app.delete('/api/jobs/history/:id', authenticateToken, async (req, res) => {
        try {
            const id_viec = req.params.id;
            const pool = await sql.connect(dbConfig);
            await pool.request()
                .input('id', sql.Int, id_viec)
                .query("DELETE FROM HoSoViecLam WHERE ID_ViecLam = @id");
            
            res.json({ message: 'Đã xóa thành công.' });
        } catch (error) {
            console.error('Lỗi DELETE /api/jobs/history:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // ------------------------------------------
    // 3. TÌM KIẾM & ỨNG TUYỂN (CÓ UPLOAD CV)
    // ------------------------------------------

    // Tìm kiếm việc làm
    app.get('/api/jobs/search', authenticateToken, async (req, res) => {
        try {
            const keyword = req.query.q || '';
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('kw', sql.NVarChar, `%${keyword}%`)
                .query(`
                    SELECT * FROM TinTuyenDung 
                    WHERE TieuDe LIKE @kw OR TenCongTy LIKE @kw OR NganhNghe LIKE @kw
                    ORDER BY NgayDang DESC
                `);
            res.json(result.recordset);
        } catch (error) {
            console.error('Lỗi GET /api/jobs/search:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // Xem chi tiết tin tuyển dụng
    app.get('/api/jobs/detail/:id', authenticateToken, async (req, res) => {
        try {
            const id_tin = req.params.id;
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('id', sql.Int, id_tin)
                .query("SELECT * FROM TinTuyenDung WHERE ID_Tin = @id");
            
            if (result.recordset.length === 0) {
                return res.status(404).json({ message: 'Không tìm thấy tin tuyển dụng.' });
            }
            res.json(result.recordset[0]);
        } catch (error) {
            console.error('Lỗi GET /api/jobs/detail:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });

    // === (CẬP NHẬT) API ỨNG TUYỂN CÓ FILE CV ===
app.post('/api/jobs/apply', authenticateToken, upload.single('fileCV'), async (req, res) => {
    try {
        const id_tk = req.user?.id;

        // Kiểm tra body có tồn tại không
        if (!req.body) {
            return res.status(400).json({ message: 'Dữ liệu gửi lên không hợp lệ.' });
        }

        const id_tin = req.body.id_tin;

        // Kiểm tra id_tin
        if (!id_tin) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Thiếu thông tin id_tin.' });
        }

        // Kiểm tra file CV
        if (!req.file) {
            return res.status(400).json({ message: 'Vui lòng tải lên CV của bạn.' });
        }

        const fileCVPath = normalizePath(req.file.path);

        const pool = await sql.connect(dbConfig);

        // Kiểm tra xem đã ứng tuyển trước đó chưa
        const check = await pool.request()
            .input('id_tk', sql.Int, id_tk)
            .input('id_tin', sql.Int, id_tin)
            .query(`
                SELECT * FROM UngTuyen 
                WHERE ID_TK = @id_tk AND ID_Tin = @id_tin
            `);

        if (check.recordset.length > 0) {
            // Xóa file upload thừa
            if (req.file) fs.unlinkSync(req.file.path);

            return res.status(400).json({ message: 'Bạn đã ứng tuyển tin này rồi.' });
        }

        // Lưu vào DB
        await pool.request()
            .input('id_tk', sql.Int, id_tk)
            .input('id_tin', sql.Int, id_tin)
            .input('fileCV', sql.NVarChar, fileCVPath)
            .query(`
                INSERT INTO UngTuyen (ID_TK, ID_Tin, FileCV)
                VALUES (@id_tk, @id_tin, @fileCV)
            `);

        return res.json({ message: 'Ứng tuyển và nộp CV thành công!' });

    } catch (error) {
        console.error('Lỗi Apply:', error);

        // Nếu upload nhưng lỗi -> xóa file
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch {}
        }

        return res.status(500).json({ message: 'Lỗi server khi ứng tuyển.' });
    }
});


    // Lấy danh sách các công việc đã ứng tuyển
    app.get('/api/jobs/applications', authenticateToken, async (req, res) => {
        try {
            const id_tk = req.user.id;
            const pool = await sql.connect(dbConfig);
            
            const result = await pool.request()
                .input('id_tk', sql.Int, id_tk)
                .query(`
                    SELECT UT.*, Tin.TieuDe, Tin.TenCongTy, Tin.MucLuong, Tin.DiaDiem 
                    FROM UngTuyen UT
                    JOIN TinTuyenDung Tin ON UT.ID_Tin = Tin.ID_Tin
                    WHERE UT.ID_TK = @id_tk
                    ORDER BY UT.NgayUngTuyen DESC
                `);
            
            res.json(result.recordset);
        } catch (error) {
            console.error('Lỗi GET /api/jobs/applications:', error);
            res.status(500).json({ message: 'Lỗi server.' });
        }
    });
};
