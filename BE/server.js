// backend/server.js - PHIÊN BẢN HOÀN CHỈNH (NÂNG CẤP MODULE GIÁO DỤC + Y TẾ v2)

// =========================================
// 1. KHAI BÁO THƯ VIỆN & CẤU HÌNH
// =========================================
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); 

const app = express();
const port = 3000;
const JWT_SECRET = "DAY_LA_CHUOI_BI_MAT_MOI_123456789"; 

// Cấu hình DB (SQL Server)
const dbConfig = {
    server: 'LAPTOP-DCN2HG3F\\SQLEXPRESS',
    database: 'dacn',
    user: 'sa',
    password: 'Password123!',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Cấu hình Multer (Upload file)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;

// =========================================
// 2. MIDDLEWARE (CÁC HÀM TRUNG GIAN)
// =========================================
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); 

// Middleware xác thực token (Kiểm tra đăng nhập)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); 
        req.user = user; 
        next();
    });
}

// Middleware phân quyền Admin (Chỉ cho Admin đi qua)
function authorizeAdmin(req, res, next) {
    if (req.user && (req.user.role === 'Admin' || req.user.VaiTro === 'Admin')) {
        next();
    } else {
        res.status(403).json({ message: 'Truy cập bị từ chối!' });
    }
}

// =========================================
// 3. API PUBLIC (KHÔNG CẦN ĐĂNG NHẬP)
// =========================================

// --- ĐĂNG NHẬP ---
app.post('/api/login', async (req, res) => {
    try {
        const { soDinhDanh, matKhau } = req.body;
        if (!soDinhDanh || !matKhau) return res.status(400).json({ message: 'Thiếu thông tin đăng nhập.' });

        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('id_cd', sql.NVarChar, soDinhDanh)
            .query(`
                SELECT TK.ID_TK, TK.MatKhau, TK.VaiTro, TK.ID_CD, HS.HoTen
                FROM TaiKhoan AS TK
                JOIN HoSoCongDan AS HS ON TK.ID_CD = HS.ID_CD
                WHERE TK.ID_CD = @id_cd
            `);

        if (result.recordset.length === 0) return res.status(404).json({ message: 'Tài khoản không tồn tại.' });

        const user = result.recordset[0];
        if (matKhau !== user.MatKhau.trim()) return res.status(400).json({ message: 'Sai mật khẩu.' });
                // === [THÊM ĐOẠN NÀY] LƯU LỊCH SỬ ĐĂNG NHẬP ===
        try {
            const userAgent = req.headers['user-agent'] || 'Unknown Device';
            // Lấy IP (đơn giản hóa cho localhost)
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
            
            await pool.request()
                .input('id_tk', sql.Int, user.ID_TK)
                .input('thietBi', sql.NVarChar, userAgent)
                .input('ip', sql.NVarChar, ip)
                .query("INSERT INTO LichSuDangNhap (ID_TK, ThietBi, IPAddress) VALUES (@id_tk, @thietBi, @ip)");
        } catch (logErr) {
            console.error('Lỗi lưu log đăng nhập:', logErr);
            // Không return lỗi, vẫn cho đăng nhập bình thường
        }
        // ==============================================
        const payload = { 
            id: user.ID_TK, 
            role: user.VaiTro.trim(), 
            id_cd: user.ID_CD.trim(), 
            HoTen: user.HoTen.trim() 
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
        res.json({ message: 'Đăng nhập thành công!', token, user: payload });

    } catch (error) {
        console.error('Lỗi Đăng nhập:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// --- ĐĂNG KÝ ---
app.post('/api/register', async (req, res) => {
    try {
        const { hoTen, email, soDinhDanh, matKhau } = req.body;
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await transaction.request()
                .input('id_cd', sql.NVarChar, soDinhDanh)
                .input('hoTen', sql.NVarChar, hoTen)
                .input('email', sql.NVarChar, email)
                .input('trangThai', sql.NVarChar, 'Chưa định danh') 
                .query('INSERT INTO HoSoCongDan (ID_CD, HoTen, Email, TrangThaiDinhDanh) VALUES (@id_cd, @hoTen, @email, @trangThai)');
            
            const tenDangNhap = email.split('@')[0];
            const taiKhoanResult = await transaction.request()
                .input('id_cd', sql.NVarChar, soDinhDanh)
                .input('ten', sql.NVarChar, tenDangNhap)
                .input('mk', sql.NVarChar, matKhau)
                .query("INSERT INTO TaiKhoan (ID_CD, TenDangNhap, MatKhau, VaiTro) OUTPUT inserted.ID_TK VALUES (@id_cd, @ten, @mk, 'User')");
            
            const newUserIdTk = taiKhoanResult.recordset[0].ID_TK;

            await transaction.request()
                .input('id_tk', sql.Int, newUserIdTk)
                .query("INSERT INTO HoSoGiaoDuc (ID_TK) VALUES (@id_tk)");
            
            await transaction.request()
                .input('id_tk', sql.Int, newUserIdTk)
                .query("INSERT INTO HoSoYTe (ID_TK) VALUES (@id_tk)");

            await transaction.commit();
            res.status(201).json({ message: 'Đăng ký thành công.' });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error("Lỗi Đăng ký:", error);
        if (error.number === 2627 || error.number === 2601) return res.status(400).json({ message: 'Số định danh hoặc Email đã được sử dụng.' });
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// =========================================
// 4. API USER (CẦN ĐĂNG NHẬP)
// =========================================

// ... (Các đoạn code khác giữ nguyên)

// --- API USER: GỬI HỒ SƠ ĐỊNH DANH ---
// Tìm dòng: app.post('/api/identity/register', ...)
// --- API USER: LẤY THÔNG TIN ĐỊNH DANH (Cần thêm đoạn này) ---
app.get('/api/identity/me', authenticateToken, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('id_cd', sql.NVarChar, req.user.id_cd)
            .query(`
                SELECT HS.ID_CD, HS.HoTen, HS.NgaySinh, HS.GioiTinh, HS.QueQuan, HS.DC, 
                       HS.DanToc, HS.TonGiao, -- Lấy thêm 2 cột mới này
                       HS.TrangThaiDinhDanh,
                       DD.SoDinhDanh AS CCCD, DD.AnhMatTruoc, DD.AnhMatSau
                FROM HoSoCongDan HS
                LEFT JOIN DinhDanhSo DD ON HS.ID_CD = DD.ID_CD AND DD.LoaiGiayTo = 'CCCD'
                WHERE HS.ID_CD = @id_cd
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy hồ sơ.' });
        }
        res.json(result.recordset[0]);
    } catch (error) {
        console.error('Lỗi lấy thông tin:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// ... (Sau đó mới đến đoạn const cpUpload = ... và app.post('/api/identity/register'...) như bạn đã có)
const cpUpload = upload.fields([{ name: 'anhMatTruoc', maxCount: 1 }, { name: 'anhMatSau', maxCount: 1 }]);
app.post('/api/identity/register', authenticateToken, cpUpload, async (req, res) => {
    try {
        const id_cd = req.user.id_cd;
        // 1. THÊM danToc, tonGiao VÀO BODY REQUEST
        const { cccd, ngaySinh, gioiTinh, queQuan, thuongTru, danToc, tonGiao } = req.body;
        
        const anhMatTruocPath = normalizePath(req.files['anhMatTruoc'] ? req.files['anhMatTruoc'][0].path : null);
        const anhMatSauPath = normalizePath(req.files['anhMatSau'] ? req.files['anhMatSau'][0].path : null);

        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            // 2. CẬP NHẬT CÂU QUERY SQL
            await transaction.request()
                .input('id_cd', sql.NVarChar, id_cd)
                .input('ngaySinh', sql.NVarChar, ngaySinh)
                .input('gioiTinh', sql.NVarChar, gioiTinh)
                .input('queQuan', sql.NVarChar, queQuan)
                .input('dc', sql.NVarChar, thuongTru)
                .input('danToc', sql.NVarChar, danToc)   // <--- Mới
                .input('tonGiao', sql.NVarChar, tonGiao) // <--- Mới
                .input('trangThai', sql.NVarChar, 'Chờ duyệt') 
                .query(`
                    UPDATE HoSoCongDan 
                    SET NgaySinh = @ngaySinh, GioiTinh = @gioiTinh, 
                        QueQuan = @queQuan, DC = @dc, 
                        DanToc = @danToc, TonGiao = @tonGiao, -- <--- Thêm vào đây
                        TrangThaiDinhDanh = @trangThai 
                    WHERE ID_CD = @id_cd
                `);

            // ... (Phần xử lý DinhDanhSo / CCCD giữ nguyên không đổi) ...
            const checkDD = await transaction.request()
                .input('id_cd', sql.NVarChar, id_cd)
                .query("SELECT * FROM DinhDanhSo WHERE ID_CD = @id_cd AND LoaiGiayTo = 'CCCD'");
            
            if (checkDD.recordset.length > 0) {
                 // ... code cũ giữ nguyên
                 let updateQuery = "UPDATE DinhDanhSo SET SoDinhDanh = @cccd";
                 if (anhMatTruocPath) updateQuery += ", AnhMatTruoc = @anhTruoc";
                 if (anhMatSauPath) updateQuery += ", AnhMatSau = @anhSau";
                 updateQuery += " WHERE ID_CD = @id_cd AND LoaiGiayTo = 'CCCD'";
                 const reqUpdate = transaction.request().input('id_cd', sql.NVarChar, id_cd).input('cccd', sql.NVarChar, cccd);
                 if (anhMatTruocPath) reqUpdate.input('anhTruoc', sql.NVarChar, anhMatTruocPath);
                 if (anhMatSauPath) reqUpdate.input('anhSau', sql.NVarChar, anhMatSauPath);
                 await reqUpdate.query(updateQuery);
            } else {
                 // ... code cũ giữ nguyên
                 const newIdDinhDanh = `${id_cd}_CCCD`;
                 await transaction.request()
                    .input('id_dd', sql.NVarChar, newIdDinhDanh)
                    .input('id_cd', sql.NVarChar, id_cd)
                    .input('cccd', sql.NVarChar, cccd)
                    .input('anhTruoc', sql.NVarChar, anhMatTruocPath)
                    .input('anhSau', sql.NVarChar, anhMatSauPath)
                    .query("INSERT INTO DinhDanhSo (ID_DinhDanh, ID_CD, SoDinhDanh, LoaiGiayTo, AnhMatTruoc, AnhMatSau) VALUES (@id_dd, @id_cd, @cccd, 'CCCD', @anhTruoc, @anhSau)");
            }

            await transaction.commit();
            res.json({ message: 'Gửi hồ sơ thành công!' });
        } catch (err) {
            await transaction.rollback(); throw err;
        }
    } catch (error) {
        console.error('Lỗi gửi định danh:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// ...

// --- API ADMIN: LẤY DANH SÁCH ---
// --- FILE: be/server.js ---

// --- FILE: be/server.js ---

app.get('/api/admin/identities/all', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT HS.ID_CD, HS.HoTen, HS.NgaySinh, HS.GioiTinh, HS.QueQuan, HS.DC, 
                       HS.SDT, HS.DanToc, HS.TonGiao, -- (Đã có đủ các cột mới)
                       LTRIM(RTRIM(HS.TrangThaiDinhDanh)) AS TrangThaiDinhDanh,
                       DD.SoDinhDanh AS CCCD, DD.AnhMatTruoc, DD.AnhMatSau
                FROM HoSoCongDan HS
                LEFT JOIN DinhDanhSo DD ON HS.ID_CD = DD.ID_CD AND DD.LoaiGiayTo = 'CCCD'
                
                -- ĐÂY LÀ PHẦN QUAN TRỌNG ĐỂ SẮP XẾP --
                ORDER BY 
                    CASE 
                        -- Ưu tiên 1: Hồ sơ Chờ duyệt lên đầu
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Chờ duyệt' THEN 1
                        -- Ưu tiên 2: Hồ sơ Bị từ chối (để Admin xem lại nếu cần)
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Bị từ chối' THEN 2
                        -- Ưu tiên 3: Hồ sơ Đã hủy
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Đã hủy' THEN 3
                        -- Ưu tiên 4: Hồ sơ Đã duyệt (đã xong, để xuống dưới)
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Đã duyệt' THEN 4
                        -- Các trạng thái khác (Null, Chưa định danh...) xuống cuối cùng
                        ELSE 5 
                    END,
                    HS.HoTen ASC -- Nếu cùng trạng thái thì sắp xếp theo Tên A->Z
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Lỗi Admin lấy danh sách:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});
// =========================================
// 5. API QUẢN LÝ GIÁO DỤC (BỘ API MỚI)
// =========================================
// (Giữ nguyên toàn bộ API Giáo dục, từ /api/education/me đến /api/education/certificate/:id)

// --- LẤY TOÀN BỘ HỒ SƠ GIÁO DỤC (User) ---
app.get('/api/education/me', authenticateToken, async (req, res) => {
    try {
        const id_tk = req.user.id; 
        const pool = await sql.connect(dbConfig);
        let educationProfile = {};

        const hsResult = await pool.request()
            .input('id_tk', sql.Int, id_tk)
            .query("SELECT * FROM HoSoGiaoDuc WHERE ID_TK = @id_tk");

        if (hsResult.recordset.length === 0) {
            const newHS = await pool.request()
                .input('id_tk', sql.Int, id_tk)
                .query("INSERT INTO HoSoGiaoDuc (ID_TK) OUTPUT inserted.* VALUES (@id_tk)");
            educationProfile = newHS.recordset[0];
        } else {
            educationProfile = hsResult.recordset[0];
        }
        
        const id_gd = educationProfile.ID_GD;

        const qtResult = await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .query("SELECT * FROM QuaTrinhHocTap WHERE ID_GD = @id_gd ORDER BY ThoiGian");
        educationProfile.quaTrinhHocTap = qtResult.recordset;

        const ccResult = await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .query(`
                SELECT C.* FROM ChiTietChungChi CT
                JOIN ChungChi C ON CT.ID_ChungChi = C.ID_ChungChi
                WHERE CT.ID_GD = @id_gd
                ORDER BY C.NgayCap DESC
            `);
        educationProfile.chungChiList = ccResult.recordset;

        res.json(educationProfile); 

    } catch (error) {
        console.error('Lỗi /api/education/me:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy hồ sơ giáo dục.' });
    }
});

// --- (SỬA) CẬP NHẬT HỌC TẬP CẤP 1 ---
app.put('/api/education/level1', authenticateToken, async (req, res) => {
    try {
        const { id_gd, truongCap1, thoiGianCap1 } = req.body;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .input('truong1', sql.NVarChar, truongCap1)
            .input('time1', sql.NVarChar, thoiGianCap1)
            .query(`
                UPDATE HoSoGiaoDuc SET
                    TruongCap1 = @truong1, ThoiGianCap1 = @time1
                WHERE ID_GD = @id_gd
            `);
        res.json({ message: 'Cập nhật Cấp 1 thành công!' });
    } catch (error) {
        console.error('Lỗi /api/education/level1:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// --- (SỬA) CẬP NHẬT HỌC TẬP CẤP 2 ---
app.put('/api/education/level2', authenticateToken, async (req, res) => {
    try {
        const { id_gd, truongCap2, thoiGianCap2 } = req.body;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .input('truong2', sql.NVarChar, truongCap2)
            .input('time2', sql.NVarChar, thoiGianCap2)
            .query(`
                UPDATE HoSoGiaoDuc SET
                    TruongCap2 = @truong2, ThoiGianCap2 = @time2
                WHERE ID_GD = @id_gd
            `);
        res.json({ message: 'Cập nhật Cấp 2 thành công!' });
    } catch (error) {
        console.error('Lỗi /api/education/level2:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});


// --- (CRUD) QUÁ TRÌNH HỌC TẬP (CẤP 3, ĐH...) ---
const hocTapUpload = upload.fields([
    { name: 'fileHocBa10', maxCount: 1 }, { name: 'fileHocBa11', maxCount: 1 },
    { name: 'fileHocBa12', maxCount: 1 }, { name: 'fileBangDiem', maxCount: 1 }
]);

function prepareHocTapRequest(request, body, files = {}) {
    const normalizePath = (p) => p ? p.replace(/\\/g, '/') : null;
    
    // Thêm các trường text
    request
        .input('capHoc', sql.NVarChar, body.capHoc)
        .input('tenTruong', sql.NVarChar, body.tenTruong)
        .input('thoiGian', sql.NVarChar, body.thoiGian)
        .input('nganhHoc', sql.NVarChar, body.nganhHoc || null)
        .input('heDaoTao', sql.NVarChar, body.heDaoTao || null)
        .input('diem10', sql.Float, body.diem10 || null)
        .input('diem11', sql.Float, body.diem11 || null)
        .input('diem12', sql.Float, body.diem12 || null)
        .input('hanhKiem', sql.NVarChar, body.hanhKiem || null)
        .input('hocLuc', sql.NVarChar, body.hocLuc || null)
        .input('gpa', sql.Float, body.gpa || null)
        .input('loaiTotNghiep', sql.NVarChar, body.loaiTotNghiep || null);

    // Thêm các file (nếu có)
    const filesNorm = {
        file10: files['fileHocBa10'] ? normalizePath(files['fileHocBa10'][0].path) : null,
        file11: files['fileHocBa11'] ? normalizePath(files['fileHocBa11'][0].path) : null,
        file12: files['fileHocBa12'] ? normalizePath(files['fileHocBa12'][0].path) : null,
        fileBD: files['fileBangDiem'] ? normalizePath(files['fileBangDiem'][0].path) : null
    };
    
    // Gán input file chỉ khi file đó tồn tại
    if (filesNorm.file10) request.input('file10', sql.NVarChar, filesNorm.file10);
    if (filesNorm.file11) request.input('file11', sql.NVarChar, filesNorm.file11);
    if (filesNorm.file12) request.input('file12', sql.NVarChar, filesNorm.file12);
    if (filesNorm.fileBD) request.input('fileBangDiem', sql.NVarChar, filesNorm.fileBD);

    return { request, filesNorm }; // Trả về cả file paths để dùng cho query
}

app.post('/api/education/learning-process', authenticateToken, hocTapUpload, async (req, res) => {
    try {
        const id_gd = req.body.id_gd;
        const pool = await sql.connect(dbConfig);
        
        let { request, filesNorm } = prepareHocTapRequest(pool.request().input('id_gd', sql.Int, id_gd), req.body, req.files);
        
        await request.query(`
            INSERT INTO QuaTrinhHocTap (
                ID_GD, CapHoc, TenTruong, ThoiGian, NganhHoc, HeDaoTao,
                DiemTB_10, DiemTB_11, DiemTB_12, HanhKiem, HocLuc,
                GPA, LoaiTotNghiep, 
                FileHocBa10, FileHocBa11, FileHocBa12, FileBangDiem
            ) VALUES (
                @id_gd, @capHoc, @tenTruong, @thoiGian, @nganhHoc, @heDaoTao,
                @diem10, @diem11, @diem12, @hanhKiem, @hocLuc,
                @gpa, @loaiTotNghiep, 
                ${filesNorm.file10 ? '@file10' : 'NULL'}, 
                ${filesNorm.file11 ? '@file11' : 'NULL'}, 
                ${filesNorm.file12 ? '@file12' : 'NULL'}, 
                ${filesNorm.fileBD ? '@fileBangDiem' : 'NULL'}
            )
        `);
        res.status(201).json({ message: 'Thêm quá trình học tập thành công!' });
    } catch (error) {
        console.error('Lỗi /api/education/learning-process (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

app.put('/api/education/learning-process/:id', authenticateToken, hocTapUpload, async (req, res) => {
    try {
        const id_hoctap = req.params.id;
        const pool = await sql.connect(dbConfig);
        
        let updateQuery = `
            UPDATE QuaTrinhHocTap SET
                CapHoc = @capHoc, TenTruong = @tenTruong, ThoiGian = @thoiGian,
                NganhHoc = @nganhHoc, HeDaoTao = @heDaoTao, DiemTB_10 = @diem10,
                DiemTB_11 = @diem11, DiemTB_12 = @diem12, HanhKiem = @hanhKiem,
                HocLuc = @hocLuc, GPA = @gpa, LoaiTotNghiep = @loaiTotNghiep
        `;
        
        let { request, filesNorm } = prepareHocTapRequest(pool.request().input('id_hoctap', sql.Int, id_hoctap), req.body, req.files);
        
        if (filesNorm.file10) updateQuery += ", FileHocBa10 = @file10";
        if (filesNorm.file11) updateQuery += ", FileHocBa11 = @file11";
        if (filesNorm.file12) updateQuery += ", FileHocBa12 = @file12";
        if (filesNorm.fileBD) updateQuery += ", FileBangDiem = @fileBangDiem";
        
        updateQuery += " WHERE ID_HocTap = @id_hoctap";
                
        await request.query(updateQuery);
        res.json({ message: 'Cập nhật quá trình học tập thành công!' });

    } catch (error) {
        console.error('Lỗi /api/education/learning-process (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

app.delete('/api/education/learning-process/:id', authenticateToken, async (req, res) => {
    try {
        const id_hoctap = req.params.id;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_hoctap', sql.Int, id_hoctap)
            .query("DELETE FROM QuaTrinhHocTap WHERE ID_HocTap = @id_hoctap");
            
        res.json({ message: 'Xóa quá trình học tập thành công.' });
    } catch (error) {
        console.error('Lỗi /api/education/learning-process (DELETE):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// --- (CRUD) VĂN BẰNG & CHỨNG CHỈ ---
app.post('/api/education/certificate', authenticateToken, upload.single('fileChungChi'), async (req, res) => {
    try {
        const { id_gd, tenChungChi, donViCap, ngayCap, ngayHetHan, loaiVanBang } = req.body;
        const filePath = req.file ? normalizePath(req.file.path) : null;

        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const certResult = await transaction.request()
                .input('ten', sql.NVarChar, tenChungChi)
                .input('donVi', sql.NVarChar, donViCap)
                .input('ngayCap', sql.Date, ngayCap)
                .input('ngayHH', sql.Date, ngayHetHan || null)
                .input('loai', sql.NVarChar, loaiVanBang)
                .input('path', sql.NVarChar, filePath)
                .query(`
                    INSERT INTO ChungChi (TenChungChi, DonViCap, NgayCap, NgayHetHan, LoaiVanBang, FilePath)
                    OUTPUT inserted.ID_ChungChi
                    VALUES (@ten, @donVi, @ngayCap, @ngayHH, @loai, @path)
                `);
            const newCertId = certResult.recordset[0].ID_ChungChi;

            await transaction.request()
                .input('id_gd', sql.Int, id_gd)
                .input('id_cc', sql.Int, newCertId)
                .query("INSERT INTO ChiTietChungChi (ID_GD, ID_ChungChi) VALUES (@id_gd, @id_cc)");

            await transaction.commit();
            res.status(201).json({ message: 'Thêm văn bằng/chứng chỉ thành công!' });
        } catch (err) {
            await transaction.rollback(); throw err;
        }
    } catch (error) {
        console.error('Lỗi /api/education/certificate (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

app.put('/api/education/certificate/:id', authenticateToken, upload.single('fileChungChi'), async (req, res) => {
    try {
        const id_chungchi = req.params.id;
        const { tenChungChi, donViCap, ngayCap, ngayHetHan, loaiVanBang } = req.body;
        const filePath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        
        let updateQuery = `
            UPDATE ChungChi SET
                TenChungChi = @ten, DonViCap = @donVi, NgayCap = @ngayCap,
                NgayHetHan = @ngayHH, LoaiVanBang = @loai
        `;
        if (filePath) updateQuery += ", FilePath = @path";
        updateQuery += " WHERE ID_ChungChi = @id_cc";
        
        const request = pool.request()
            .input('id_cc', sql.Int, id_chungchi)
            .input('ten', sql.NVarChar, tenChungChi)
            .input('donVi', sql.NVarChar, donViCap)
            .input('ngayCap', sql.Date, ngayCap)
            .input('ngayHH', sql.Date, ngayHetHan || null)
            .input('loai', sql.NVarChar, loaiVanBang);
        
        if (filePath) request.input('path', sql.NVarChar, filePath);
        
        await request.query(updateQuery);
        
        res.json({ message: 'Cập nhật chứng chỉ thành công!' });

    } catch (error) {
        console.error('Lỗi /api/education/certificate (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

app.delete('/api/education/certificate/:id', authenticateToken, async (req, res) => {
    try {
        const id_chungchi = req.params.id;
        const id_tk = req.user.id;
        
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const hsResult = await transaction.request().input('id_tk', sql.Int, id_tk).query("SELECT ID_GD FROM HoSoGiaoDuc WHERE ID_TK = @id_tk");
            if (hsResult.recordset.length === 0) throw new Error('Không tìm thấy hồ sơ.');
            const id_gd = hsResult.recordset[0].ID_GD;
            
            const deleteLink = await transaction.request()
                .input('id_gd', sql.Int, id_gd)
                .input('id_cc', sql.Int, id_chungchi)
                .query("DELETE FROM ChiTietChungChi WHERE ID_GD = @id_gd AND ID_ChungChi = @id_cc");
            
            if (deleteLink.rowsAffected[0] === 0) throw new Error('Bạn không sở hữu chứng chỉ này.');
            
            await transaction.request()
                .input('id_cc', sql.Int, id_chungchi)
                .query("DELETE FROM ChungChi WHERE ID_ChungChi = @id_cc");

            await transaction.commit();
            res.json({ message: 'Đã xóa chứng chỉ thành công.' });
        } catch (err) {
            await transaction.rollback(); throw err;
        }
    } catch (error) {
        console.error('Lỗi /api/education/certificate (DELETE):', error);
        res.status(500).json({ message: error.message || 'Lỗi server.' });
    }
});


// ========================================================
// === (CẬP NHẬT) BỘ API QUẢN LÝ Y TẾ (USER) ===
// ========================================================

// (CẬP NHẬT) Hàm helper để tìm (hoặc tạo) ID_YTe
// (Sửa lỗi: Đổi tên cột CSDL về lại VKBamSinh và ThoiGian)
async function getHoSoYTe(pool, id_tk) {
    let hsResult = await pool.request()
        .input('id_tk', sql.Int, id_tk)
        .query("SELECT * FROM HoSoYTe WHERE ID_TK = @id_tk"); // Lấy tất cả cột
    
    if (hsResult.recordset.length === 0) {
        hsResult = await pool.request()
            .input('id_tk', sql.Int, id_tk)
            .query("INSERT INTO HoSoYTe (ID_TK) OUTPUT inserted.* VALUES (@id_tk)");
    }
    
    // Đổi tên cột thủ công để gửi về frontend
    const healthProfile = hsResult.recordset[0];
    
    // === BẮT ĐẦU SỬA LỖI: Đổi tên CSDL -> Tên Frontend ===
    // (CSDL của bạn bây giờ là TienSuBenh và ThoiGianCapNhat)
    if (healthProfile.TienSuBenh !== undefined) {
         healthProfile.TienSuBenh = healthProfile.TienSuBenh; // (Tên đã khớp)
    }
    if (healthProfile.ThoiGianCapNhat !== undefined) {
         healthProfile.ThoiGianCapNhat = healthProfile.ThoiGianCapNhat; // (Tên đã khớp)
    }
    // === KẾT THÚC SỬA LỖI LOGIC ===
    
    return healthProfile;
}

// 1. LẤY TOÀN BỘ HỒ SƠ Y TẾ (User)
app.get('/api/health/me', authenticateToken, async (req, res) => {
    try {
        const id_tk = req.user.id; 
        const pool = await sql.connect(dbConfig);
        
        const healthProfile = await getHoSoYTe(pool, id_tk); // Đã bao gồm đổi tên
        const id_yte = healthProfile.ID_YTe;
        
        // console.log(`GET /api/health/me - ID_TK: ${id_tk}`);
        // console.log('Health profile (đã đổi tên) gửi về client:', healthProfile);
        
        const examResult = await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .query("SELECT * FROM DuLieuKhamBenh WHERE ID_YTe = @id_yte ORDER BY NgayKham DESC");
        
        healthProfile.khamBenhList = examResult.recordset.map(item => {
            try {
                item.FileDinhKem = JSON.parse(item.FileDinhKem);
            } catch (e) {
                item.FileDinhKem = []; 
            }
            return item;
        });
        
        const vaccResult = await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .query("SELECT * FROM DuLieuTiemChung WHERE ID_YTe = @id_yte ORDER BY NgayTiem DESC");
        healthProfile.tiemChungList = vaccResult.recordset;
        
        res.json(healthProfile);
    
    } catch (error) {
        console.error('Lỗi /api/health/me:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy hồ sơ y tế.' });
    }
});

// 2. CẬP NHẬT HỒ SƠ Y TẾ CHUNG (Nhóm máu, Tiền sử)
app.put('/api/health/general', authenticateToken, async (req, res) => {
    try {
        const { id_yte, nhomMau, tienSuBenh } = req.body;
        // console.log('PUT /api/health/general - Data nhận:', req.body); // DEBUG
        
        const pool = await sql.connect(dbConfig);
        
        // === BẮT ĐẦU SỬA LỖI: Đổi tên cột (LẦN 3) ===
        // (Sử dụng tên cột CSDL bạn đã xác nhận: TienSuBenh và ThoiGianCapNhat)
        await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('nhomMau', sql.NVarChar, nhomMau)
            .input('tienSuBenh', sql.NVarChar, tienSuBenh) 
            .input('thoiGian', sql.DateTime, new Date()) 
            .query(`
                UPDATE HoSoYTe SET
                    NhomMau = @nhomMau,
                    TienSuBenh = @tienSuBenh,      -- Sửa: Gán vào cột TienSuBenh
                    ThoiGianCapNhat = @thoiGian  -- Sửa: Cập nhật cột ThoiGianCapNhat
                WHERE ID_YTe = @id_yte
            `);
        // === KẾT THÚC SỬA LỖI ===
            
        res.json({ message: 'Cập nhật thông tin chung thành công!' });
    } catch (error) {
        console.error('Lỗi /api/health/general:', error);
        res.status(500).json({ message: error.message || 'Lỗi server.' });
    }
});

// (MỚI) 2.1. CẬP NHẬT BẢO HIỂM Y TẾ (BHYT)
app.put('/api/health/bhyt', authenticateToken, upload.single('anhBHYT'), async (req, res) => {
    try {
        const { id_yte, soBHYT, noiDangKyKCB, ngayHetHanBHYT } = req.body;
        const anhBHYTPath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `UPDATE HoSoYTe SET
                        SoBHYT = @soBHYT,
                        NoiDangKyKCB = @noiDangKyKCB,
                        NgayHetHanBHYT = @ngayHetHanBHYT
                    `;
        
        const request = pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('soBHYT', sql.NVarChar, soBHYT)
            .input('noiDangKyKCB', sql.NVarChar, noiDangKyKCB)
            .input('ngayHetHanBHYT', sql.Date, ngayHetHanBHYT || null);
            
        // Chỉ cập nhật ảnh nếu có file mới
        if (anhBHYTPath) {
            query += `, AnhBHYT = @anhBHYT`;
            request.input('anhBHYT', sql.NVarChar, anhBHYTPath);
        }
        
        query += ` WHERE ID_YTe = @id_yte`;
        
        await request.query(query);
        
        res.json({ message: 'Cập nhật BHYT thành công!' });
    } catch (error) {
        console.error('Lỗi /api/health/bhyt:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});


// 3. CRUD LỊCH SỬ KHÁM BỆNH

// (MỚI) Middleware cho upload nhiều file khám bệnh
const examUpload = upload.array('filesDinhKem', 5); // Tối đa 5 file

// 3.1. Thêm Lịch sử khám (CẬP NHẬT)
app.post('/api/health/exam', authenticateToken, examUpload, async (req, res) => {
    try {
        const { id_yte, ngayKham, bacSi, coSoYTe, chanDoan, phacDoDieuTri } = req.body;
        
        const filePaths = req.files ? req.files.map(file => normalizePath(file.path)) : [];
        const fileDinhKemJson = JSON.stringify(filePaths);
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('ngayKham', sql.Date, ngayKham)
            .input('bacSi', sql.NVarChar, bacSi)
            .input('coSoYTe', sql.NVarChar, coSoYTe)
            .input('chanDoan', sql.NVarChar, chanDoan)
            .input('phacDo', sql.NVarChar, phacDoDieuTri)
            .input('fileDinhKem', sql.NVarChar, fileDinhKemJson) // Lưu chuỗi JSON
            .query(`
                INSERT INTO DuLieuKhamBenh 
                (ID_YTe, NgayKham, BacSi, CoSoYTe, ChanDoan, PhacDoDieuTri, FileDinhKem)
                VALUES (@id_yte, @ngayKham, @bacSi, @coSoYTe, @chanDoan, @phacDo, @fileDinhKem)
            `);
        res.status(201).json({ message: 'Thêm lịch sử khám bệnh thành công!' });
    } catch (error) {
        console.error('Lỗi /api/health/exam (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 3.2. Sửa Lịch sử khám (CẬP NHẬT)
app.put('/api/health/exam/:id_khambenh', authenticateToken, examUpload, async (req, res) => {
    try {
        const { id_khambenh } = req.params;
        const { ngayKham, bacSi, coSoYTe, chanDoan, phacDoDieuTri, existingFiles } = req.body;
        const pool = await sql.connect(dbConfig);

        let newFilePaths = req.files ? req.files.map(file => normalizePath(file.path)) : [];
        
        let oldFilePaths = [];
        if (existingFiles) {
            oldFilePaths = Array.isArray(existingFiles) ? existingFiles : [existingFiles];
        }

        const allFilePaths = [...oldFilePaths, ...newFilePaths];
        const fileDinhKemJson = JSON.stringify(allFilePaths);

        await pool.request()
            .input('id', sql.Int, id_khambenh)
            .input('ngayKham', sql.Date, ngayKham)
            .input('bacSi', sql.NVarChar, bacSi)
            .input('coSoYTe', sql.NVarChar, coSoYTe)
            .input('chanDoan', sql.NVarChar, chanDoan)
            .input('phacDo', sql.NVarChar, phacDoDieuTri)
            .input('fileDinhKem', sql.NVarChar, fileDinhKemJson)
            .query(`
                UPDATE DuLieuKhamBenh SET 
                    NgayKham = @ngayKham, BacSi = @bacSi, CoSoYTe = @coSoYTe,
                    ChanDoan = @chanDoan, PhacDoDieuTri = @phacDo, FileDinhKem = @fileDinhKem
                WHERE ID_KhamBenh = @id
            `);
        res.json({ message: 'Cập nhật lịch sử khám bệnh thành công!' });
    } catch (error) {
        console.error('Lỗi /api/health/exam (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 3.3. Xóa Lịch sử khám (Giữ nguyên)
app.delete('/api/health/exam/:id_khambenh', authenticateToken, async (req, res) => {
    try {
        const { id_khambenh } = req.params;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, id_khambenh)
            .query("DELETE FROM DuLieuKhamBenh WHERE ID_KhamBenh = @id");
        res.json({ message: 'Xóa lịch sử khám bệnh thành công.' });
    } catch (error) {
        console.error('Lỗi /api/health/exam (DELETE):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});


// 4. CRUD LỊCH SỬ TIÊM CHỦNG

// (MỚI) Middleware cho upload 1 file tiêm chủng
const vaccUpload = upload.single('fileXacMinh');

// 4.1. Thêm Lịch sử tiêm (CẬP NHẬT)
app.post('/api/health/vaccination', authenticateToken, vaccUpload, async (req, res) => {
    try {
        const { id_yte, tenVacXin, donVi, ngayTiem } = req.body;
        const fileXacMinhPath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('tenVacXin', sql.NVarChar, tenVacXin)
            .input('donVi', sql.NVarChar, donVi)
            .input('ngayTiem', sql.Date, ngayTiem)
            .input('fileXacMinh', sql.NVarChar, fileXacMinhPath)
            .query(`
                INSERT INTO DuLieuTiemChung (ID_YTe, TenVacXin, DonVi, NgayTiem, FileXacMinh)
                VALUES (@id_yte, @tenVacXin, @donVi, @ngayTiem, @fileXacMinh)
            `);
        res.status(201).json({ message: 'Thêm lịch sử tiêm chủng thành công!' });
    } catch (error) {
        console.error('Lỗi /api/health/vaccination (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 4.2. Sửa Lịch sử tiêm (CẬP NHẬT)
app.put('/api/health/vaccination/:id_tiemchung', authenticateToken, vaccUpload, async (req, res) => {
    try {
        const { id_tiemchung } = req.params;
        const { tenVacXin, donVi, ngayTiem } = req.body;
        const fileXacMinhPath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `UPDATE DuLieuTiemChung SET 
                        TenVacXin = @tenVacXin, DonVi = @donVi, NgayTiem = @ngayTiem
                    `;
        
        const request = pool.request()
            .input('id', sql.Int, id_tiemchung)
            .input('tenVacXin', sql.NVarChar, tenVacXin)
            .input('donVi', sql.NVarChar, donVi)
            .input('ngayTiem', sql.Date, ngayTiem);
            
        // Chỉ cập nhật ảnh nếu có file mới
        if (fileXacMinhPath) {
            query += `, FileXacMinh = @fileXacMinh`;
            request.input('fileXacMinh', sql.NVarChar, fileXacMinhPath);
        }
        
        query += ` WHERE ID_TiemChung = @id`;
        
        await request.query(query);
        res.json({ message: 'Cập nhật lịch sử tiêm chủng thành công!' });
    } catch (error) {
        console.error('Lỗi /api/health/vaccination (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 4.3. Xóa Lịch sử tiêm (Giữ nguyên)
app.delete('/api/health/vaccination/:id_tiemchung', authenticateToken, async (req, res) => {
    try {
        const { id_tiemchung } = req.params;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, id_tiemchung)
            .query("DELETE FROM DuLieuTiemChung WHERE ID_TiemChung = @id");
        res.json({ message: 'Xóa lịch sử tiêm chủng thành công.' });
    } catch (error) {
        console.error('Lỗi /api/health/vaccination (DELETE):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});


// =========================================
// 6. API ADMIN (CHỈ ADMIN ĐƯỢC DÙNG)
// =========================================
// (Giữ nguyên toàn bộ API Admin)

// --- (MỚI) LẤY TẤT CẢ HỒ SƠ CÔNG DÂN (ĐỊNH DANH) ---
app.get('/api/admin/identities/all', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT HS.ID_CD, HS.HoTen, HS.NgaySinh, HS.GioiTinh, HS.QueQuan, HS.DC, 
                       LTRIM(RTRIM(HS.TrangThaiDinhDanh)) AS TrangThaiDinhDanh,
                       DD.SoDinhDanh AS CCCD, DD.AnhMatTruoc, DD.AnhMatSau
                FROM HoSoCongDan HS
                LEFT JOIN DinhDanhSo DD ON HS.ID_CD = DD.ID_CD AND DD.LoaiGiayTo = 'CCCD'
                ORDER BY 
                    CASE 
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Chờ duyệt' THEN 1
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Bị từ chối' THEN 2
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Đã hủy' THEN 3
                        WHEN LTRIM(RTRIM(HS.TrangThaiDinhDanh)) = N'Đã duyệt' THEN 4
                        ELSE 5 
                    END,
                    HS.HoTen ASC
            `);
        res.json(result.recordset);
    } catch (error) {
        console.error('Lỗi Admin lấy tất cả danh sách:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});


// --- (CẬP NHẬT) DUYỆT/TỪ CHỐI/HỦY/KHÔI PHỤC HỒ SƠ (ĐỊNH DANH) ---
app.put('/api/admin/identities/:id/status', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const id_cd = req.params.id;
        const { status } = req.body;
        
        const validStatuses = ['Đã duyệt', 'Bị từ chối', 'Đã hủy'];
        
        // (Sửa lỗi logic: Cho phép khôi phục)
        if (!validStatuses.includes(status)) {
             // Nếu là khôi phục
            if (status === 'Chờ duyệt') {
                // Cho phép khôi phục về "Chờ duyệt"
            } else {
                 return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
            }
        }

        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_cd', sql.NVarChar, id_cd)
            .input('trangThai', sql.NVarChar, status) 
            .query("UPDATE HoSoCongDan SET TrangThaiDinhDanh = @trangThai WHERE ID_CD = @id_cd");

        res.json({ message: `Đã cập nhật trạng thái thành công: ${status}` });
    } catch (error) {
        console.error('Lỗi Admin cập nhật:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// --- (CẬP NHẬT) LẤY THỐNG KÊ TRẠNG THÁI ĐỊNH DANH ---
app.get('/api/admin/identities/stats', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        const result = await pool.request()
            .query(`
                SELECT 
                    SUM(CASE WHEN LTRIM(RTRIM(TrangThaiDinhDanh)) = N'Đã duyệt' THEN 1 ELSE 0 END) AS approved,
                    SUM(CASE WHEN LTRIM(RTRIM(TrangThaiDinhDanh)) = N'Chờ duyệt' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN LTRIM(RTRIM(TrangThaiDinhDanh)) = N'Bị từ chối' THEN 1 ELSE 0 END) AS rejected,
                    SUM(CASE WHEN LTRIM(RTRIM(TrangThaiDinhDanh)) = N'Đã hủy' THEN 1 ELSE 0 END) AS revoked, -- (MỚI)
                    SUM(CASE WHEN LTRIM(RTRIM(TrangThaiDinhDanh)) = N'Chưa định danh' OR TrangThaiDinhDanh IS NULL THEN 1 ELSE 0 END) AS nullStatus,
                    COUNT(*) as total
                FROM HoSoCongDan
            `);
        
        const stats = {
            approved: result.recordset[0].approved || 0,
            pending: result.recordset[0].pending || 0,
            rejected: result.recordset[0].rejected || 0,
            revoked: result.recordset[0].revoked || 0, // (MỚI)
            nullStatus: result.recordset[0].nullStatus || 0,
            total: result.recordset[0].total || 0 
        };
        res.json(stats);

    } catch (error) {
        console.error('Lỗi Admin lấy thống kê định danh:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});


// --- API QUẢN LÝ GIÁO DỤC (ADMIN) ---

// 1. TÌM KIẾM CÔNG DÂN
app.get('/api/admin/citizens/search', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.status(400).json({ message: 'Thiếu từ khóa tìm kiếm.' });
        }
        
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('term', sql.NVarChar, `%${searchTerm}%`)
            .query(`
                SELECT ID_CD, HoTen, NgaySinh, Email 
                FROM HoSoCongDan 
                WHERE HoTen LIKE @term OR ID_CD LIKE @term
            `);
            
        res.json(result.recordset);
    } catch (error) {
        console.error('Lỗi Admin tìm kiếm công dân:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 2. LẤY THỐNG KÊ GIÁO DỤC (PHẢI Ở TRƯỚC ROUTE PARAMETERIZED)
app.get('/api/admin/education/stats', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // Đếm các cấp học
        const hocVanResult = await pool.request()
            .query(`
                SELECT 
                    CapHoc, COUNT(*) AS SoLuong
                FROM QuaTrinhHocTap
                GROUP BY CapHoc
            `);
            
        // Đếm tổng số chứng chỉ
        const chungChiResult = await pool.request()
            .query("SELECT COUNT(*) AS TongChungChi FROM ChungChi");
            
        let stats = {
            level3: 0,
            university: 0,
            college: 0,
            certificates: chungChiResult.recordset[0].TongChungChi || 0
        };

        // Xử lý kết quả học vấn
        hocVanResult.recordset.forEach(item => {
            const capHocTrimmed = item.CapHoc ? item.CapHoc.trim() : '';
            if (capHocTrimmed === 'Cấp 3') {
                stats.level3 = item.SoLuong;
            } else if (capHocTrimmed === 'Đại học') {
                stats.university = item.SoLuong;
            } else if (capHocTrimmed === 'Cao đẳng') {
                stats.college = item.SoLuong;
            }
        });
        
        res.json(stats);

    } catch (error) {
        console.error('Lỗi Admin lấy thống kê giáo dục:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// (MỚI) 4. LẤY THỐNG KÊ Y TẾ
app.get('/api/admin/health/stats', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        
        // === BẮT ĐẦU SỬA ĐỔI: Chỉ đếm BHYT và Tổng số ===
        const [bhytResult, totalResult] = await Promise.all([
            // Đếm số người có BHYT
            pool.request().query("SELECT COUNT(*) AS Total FROM HoSoYTe WHERE SoBHYT IS NOT NULL AND SoBHYT != ''"),
            // Đếm tổng số hồ sơ y tế (để tính %)
            pool.request().query("SELECT COUNT(*) AS Total FROM HoSoYTe")
        ]);
            
        const stats = {
            bhyt: bhytResult.recordset[0].Total || 0,
            totalHoSoYTe: totalResult.recordset[0].Total || 0 // (MỚI)
        };
        // === KẾT THÚC SỬA ĐỔI ===
        
        res.json(stats);

    } catch (error) {
        console.error('Lỗi Admin lấy thống kê y tế:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});


// 5. LẤY HỒ SƠ GIÁO DỤC CHI TIẾT CỦA 1 CÔNG DÂN
app.get('/api/admin/education/:id_cd', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const id_cd = req.params.id_cd;
        const pool = await sql.connect(dbConfig);
        
        // B1: Tìm ID_TK từ ID_CD
        const tkResult = await pool.request()
            .input('id_cd', sql.NVarChar, id_cd)
            .query("SELECT ID_TK FROM TaiKhoan WHERE ID_CD = @id_cd");
            
        if (tkResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản cho công dân này.' });
        }
        const id_tk = tkResult.recordset[0].ID_TK;

        // B2: Lấy hồ sơ giáo dục (Giống hệt API /api/education/me)
        let educationProfile = {};

        // 2.1. Lấy HoSoGiaoDuc (chứa Cấp 1, 2)
        const hsResult = await pool.request()
            .input('id_tk', sql.Int, id_tk)
            .query("SELECT * FROM HoSoGiaoDuc WHERE ID_TK = @id_tk");

        if (hsResult.recordset.length === 0) {
             return res.status(404).json({ message: 'Công dân này chưa có hồ sơ giáo dục.' });
        }
        
        educationProfile = hsResult.recordset[0];
        const id_gd = educationProfile.ID_GD;

        // 2.2. Lấy Quá Trình Học Tập (Cấp 3, ĐH, CĐ...)
        const qtResult = await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .query("SELECT * FROM QuaTrinhHocTap WHERE ID_GD = @id_gd ORDER BY ThoiGian");
        educationProfile.quaTrinhHocTap = qtResult.recordset;

        // 2.3. Lấy Văn bằng & Chứng chỉ
        const ccResult = await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .query(`
                SELECT C.* FROM ChiTietChungChi CT
                JOIN ChungChi C ON CT.ID_ChungChi = C.ID_ChungChi
                WHERE CT.ID_GD = @id_gd
                ORDER BY C.NgayCap DESC
            `);
        educationProfile.chungChiList = ccResult.recordset;

        res.json(educationProfile); // Trả về 1 object lớn

    } catch (error) {
        console.error(`Lỗi Admin /api/admin/education/${req.params.id_cd}:`, error);
        res.status(500).json({ message: 'Lỗi server khi lấy hồ sơ giáo dục chi tiết.' });
    }
});


// ========================================================
// === (MỚI) BỘ API CHỈNH SỬA GIÁO DỤC (ADMIN) ===
// ========================================================
// (Giữ nguyên)

// 1. Admin cập nhật Cấp 1
app.put('/api/admin/education/level1', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id_gd, truongCap1, thoiGianCap1 } = req.body; 
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .input('truong1', sql.NVarChar, truongCap1)
            .input('time1', sql.NVarChar, thoiGianCap1)
            .query(`
                UPDATE HoSoGiaoDuc SET
                    TruongCap1 = @truong1, ThoiGianCap1 = @time1
                WHERE ID_GD = @id_gd
            `);
        res.json({ message: 'Admin cập nhật Cấp 1 thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/level1:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 2. Admin cập nhật Cấp 2
app.put('/api/admin/education/level2', authenticateToken, authorizeAdmin, async (req, res) => {
     try {
        const { id_gd, truongCap2, thoiGianCap2 } = req.body;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_gd', sql.Int, id_gd)
            .input('truong2', sql.NVarChar, truongCap2)
            .input('time2', sql.NVarChar, thoiGianCap2)
            .query(`
                UPDATE HoSoGiaoDuc SET
                    TruongCap2 = @truong2, ThoiGianCap2 = @time2
                WHERE ID_GD = @id_gd
            `);
        res.json({ message: 'Admin cập nhật Cấp 2 thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/level2:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 3. Admin THÊM MỚI Quá trình học tập (C3, ĐH...)
app.post('/api/admin/education/learning-process', authenticateToken, authorizeAdmin, hocTapUpload, async (req, res) => {
    try {
        const id_gd = req.body.id_gd; // Admin gửi id_gd
        const pool = await sql.connect(dbConfig);
        
        let { request, filesNorm } = prepareHocTapRequest(pool.request().input('id_gd', sql.Int, id_gd), req.body, req.files);
        
        await request.query(`
            INSERT INTO QuaTrinhHocTap (
                ID_GD, CapHoc, TenTruong, ThoiGian, NganhHoc, HeDaoTao,
                DiemTB_10, DiemTB_11, DiemTB_12, HanhKiem, HocLuc,
                GPA, LoaiTotNghiep, 
                FileHocBa10, FileHocBa11, FileHocBa12, FileBangDiem
            ) VALUES (
                @id_gd, @capHoc, @tenTruong, @thoiGian, @nganhHoc, @heDaoTao,
                @diem10, @diem11, @diem12, @hanhKiem, @hocLuc,
                @gpa, @loaiTotNghiep, 
                ${filesNorm.file10 ? '@file10' : 'NULL'}, 
                ${filesNorm.file11 ? '@file11' : 'NULL'}, 
                ${filesNorm.file12 ? '@file12' : 'NULL'}, 
                ${filesNorm.fileBD ? '@fileBangDiem' : 'NULL'}
            )
        `);
        res.status(201).json({ message: 'Admin thêm quá trình học tập thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/learning-process (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 4. Admin SỬA Quá trình học tập (C3, ĐH...)
app.put('/api/admin/education/learning-process/:id_hoctap', authenticateToken, authorizeAdmin, hocTapUpload, async (req, res) => {
    try {
        const id_hoctap = req.params.id_hoctap; // Admin sửa 1 ID_HocTap cụ thể
        const pool = await sql.connect(dbConfig);
        
        let updateQuery = `
            UPDATE QuaTrinhHocTap SET
                CapHoc = @capHoc, TenTruong = @tenTruong, ThoiGian = @thoiGian,
                NganhHoc = @nganhHoc, HeDaoTao = @heDaoTao, DiemTB_10 = @diem10,
                DiemTB_11 = @diem11, DiemTB_12 = @diem12, HanhKiem = @hanhKiem,
                HocLuc = @hocLuc, GPA = @gpa, LoaiTotNghiep = @loaiTotNghiep
        `;
        
        let { request, filesNorm } = prepareHocTapRequest(pool.request().input('id_hoctap', sql.Int, id_hoctap), req.body, req.files);
        
        if (filesNorm.file10) updateQuery += ", FileHocBa10 = @file10";
        if (filesNorm.file11) updateQuery += ", FileHocBa11 = @file11";
        if (filesNorm.file12) updateQuery += ", FileHocBa12 = @file12";
        if (filesNorm.fileBD) updateQuery += ", FileBangDiem = @fileBangDiem";
        
        updateQuery += " WHERE ID_HocTap = @id_hoctap";
                
        await request.query(updateQuery);
        res.json({ message: 'Admin cập nhật quá trình học tập thành công!' });

    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/learning-process (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 5. Admin XÓA Quá trình học tập (C3, ĐH...)
app.delete('/api/admin/education/learning-process/:id_hoctap', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const id_hoctap = req.params.id_hoctap;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_hoctap', sql.Int, id_hoctap)
            .query("DELETE FROM QuaTrinhHocTap WHERE ID_HocTap = @id_hoctap");
            
        res.json({ message: 'Admin xóa quá trình học tập thành công.' });
    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/learning-process (DELETE):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 6. Admin THÊM MỚI Chứng chỉ
app.post('/api/admin/education/certificate', authenticateToken, authorizeAdmin, upload.single('fileChungChi'), async (req, res) => {
    try {
        const { id_gd, tenChungChi, donViCap, ngayCap, ngayHetHan, loaiVanBang } = req.body; // Admin gửi id_gd
        const filePath = req.file ? normalizePath(req.file.path) : null;

        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const certResult = await transaction.request()
                .input('ten', sql.NVarChar, tenChungChi)
                .input('donVi', sql.NVarChar, donViCap)
                .input('ngayCap', sql.Date, ngayCap)
                .input('ngayHH', sql.Date, ngayHetHan || null)
                .input('loai', sql.NVarChar, loaiVanBang)
                .input('path', sql.NVarChar, filePath)
                .query(`
                    INSERT INTO ChungChi (TenChungChi, DonViCap, NgayCap, NgayHetHan, LoaiVanBang, FilePath)
                    OUTPUT inserted.ID_ChungChi
                    VALUES (@ten, @donVi, @ngayCap, @ngayHH, @loai, @path)
                `);
            const newCertId = certResult.recordset[0].ID_ChungChi;

            await transaction.request()
                .input('id_gd', sql.Int, id_gd)
                .input('id_cc', sql.Int, newCertId)
                .query("INSERT INTO ChiTietChungChi (ID_GD, ID_ChungChi) VALUES (@id_gd, @id_cc)");

            await transaction.commit();
            res.status(201).json({ message: 'Admin thêm văn bằng/chứng chỉ thành công!' });
        } catch (err) {
            await transaction.rollback(); throw err;
        }
    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/certificate (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 7. Admin SỬA Chứng chỉ
app.put('/api/admin/education/certificate/:id_chungchi', authenticateToken, authorizeAdmin, upload.single('fileChungChi'), async (req, res) => {
    try {
        const id_chungchi = req.params.id_chungchi;
        const { tenChungChi, donViCap, ngayCap, ngayHetHan, loaiVanBang } = req.body;
        const filePath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        
        let updateQuery = `
            UPDATE ChungChi SET
                TenChungChi = @ten, DonViCap = @donVi, NgayCap = @ngayCap,
                NgayHetHan = @ngayHH, LoaiVanBang = @loai
        `;
        if (filePath) updateQuery += ", FilePath = @path";
        updateQuery += " WHERE ID_ChungChi = @id_cc";
        
        const request = pool.request()
            .input('id_cc', sql.Int, id_chungchi)
            .input('ten', sql.NVarChar, tenChungChi)
            .input('donVi', sql.NVarChar, donViCap)
            .input('ngayCap', sql.Date, ngayCap)
            .input('ngayHH', sql.Date, ngayHetHan || null)
            .input('loai', sql.NVarChar, loaiVanBang);
        
        if (filePath) request.input('path', sql.NVarChar, filePath);
        
        await request.query(updateQuery);
        
        res.json({ message: 'Admin cập nhật chứng chỉ thành công!' });

    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/certificate (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 8. Admin XÓA Chứng chỉ
app.delete('/api/admin/education/certificate/:id_chungchi', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const id_chungchi = req.params.id_chungchi;
        
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            // Admin có thể xóa của bất kỳ ai
            // B1: Xóa liên kết
            await transaction.request()
                .input('id_cc', sql.Int, id_chungchi)
                .query("DELETE FROM ChiTietChungChi WHERE ID_ChungChi = @id_cc");
            
            // B2: Xóa bản ghi
            await transaction.request()
                .input('id_cc', sql.Int, id_chungchi)
                .query("DELETE FROM ChungChi WHERE ID_ChungChi = @id_cc");

            await transaction.commit();
            res.json({ message: 'Admin đã xóa chứng chỉ thành công.' });
        } catch (err) {
            await transaction.rollback(); throw err;
        }
    } catch (error) {
        console.error('Lỗi Admin /api/admin/education/certificate (DELETE):', error);
        res.status(500).json({ message: error.message || 'Lỗi server.' });
    }
});
// ========================================================
// === KẾT THÚC BỘ API CHỈNH SỬA GIÁO DỤC (ADMIN) ===
// ========================================================


// ========================================================
// === (MỚI) BỘ API CHỈNH SỬA Y TẾ (ADMIN) ===
// ========================================================

// 1. Admin LẤY HỒ SƠ Y TẾ CHI TIẾT CỦA 1 CÔNG DÂN
app.get('/api/admin/health/:id_cd', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const id_cd = req.params.id_cd;
        const pool = await sql.connect(dbConfig);
        
        // B1: Tìm ID_TK từ ID_CD
        const tkResult = await pool.request()
            .input('id_cd', sql.NVarChar, id_cd)
            .query("SELECT ID_TK FROM TaiKhoan WHERE ID_CD = @id_cd");
            
        if (tkResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tài khoản cho công dân này.' });
        }
        const id_tk = tkResult.recordset[0].ID_TK;

        // B2: Lấy hồ sơ y tế (Giống hệt API /api/health/me)
        const healthProfile = await getHoSoYTe(pool, id_tk); // (đã bao gồm đổi tên cột)
        const id_yte = healthProfile.ID_YTe;
        
        const examResult = await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .query("SELECT * FROM DuLieuKhamBenh WHERE ID_YTe = @id_yte ORDER BY NgayKham DESC");
        
        healthProfile.khamBenhList = examResult.recordset.map(item => {
            try {
                item.FileDinhKem = JSON.parse(item.FileDinhKem);
            } catch (e) {
                item.FileDinhKem = []; 
            }
            return item;
        });
        
        const vaccResult = await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .query("SELECT * FROM DuLieuTiemChung WHERE ID_YTe = @id_yte ORDER BY NgayTiem DESC");
        healthProfile.tiemChungList = vaccResult.recordset;
        
        res.json(healthProfile);

    } catch (error) {
        console.error(`Lỗi Admin /api/admin/health/${req.params.id_cd}:`, error);
        res.status(500).json({ message: 'Lỗi server khi lấy hồ sơ y tế chi tiết.' });
    }
});

// 2. Admin CẬP NHẬT HỒ SƠ Y TẾ CHUNG
app.put('/api/admin/health/general', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id_yte, nhomMau, tienSuBenh } = req.body;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('nhomMau', sql.NVarChar, nhomMau)
            .input('tienSuBenh', sql.NVarChar, tienSuBenh) 
            .input('thoiGian', sql.DateTime, new Date()) 
            .query(`
                UPDATE HoSoYTe SET
                    NhomMau = @nhomMau,
                    TienSuBenh = @tienSuBenh,      -- Sửa: Gán vào cột TienSuBenh
                    ThoiGianCapNhat = @thoiGian  -- Sửa: Cập nhật cột ThoiGianCapNhat
                WHERE ID_YTe = @id_yte
            `);
            
        res.json({ message: 'Admin cập nhật thông tin chung thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/admin/health/general:', error);
        res.status(500).json({ message: error.message || 'Lỗi server.' });
    }
});

// 3. Admin CẬP NHẬT BẢO HIỂM Y TẾ (BHYT)
app.put('/api/admin/health/bhyt', authenticateToken, authorizeAdmin, upload.single('anhBHYT'), async (req, res) => {
    try {
        const { id_yte, soBHYT, noiDangKyKCB, ngayHetHanBHYT } = req.body;
        const anhBHYTPath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `UPDATE HoSoYTe SET
                        SoBHYT = @soBHYT,
                        NoiDangKyKCB = @noiDangKyKCB,
                        NgayHetHanBHYT = @ngayHetHanBHYT
                    `;
        
        const request = pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('soBHYT', sql.NVarChar, soBHYT)
            .input('noiDangKyKCB', sql.NVarChar, noiDangKyKCB)
            .input('ngayHetHanBHYT', sql.Date, ngayHetHanBHYT || null);
            
        if (anhBHYTPath) {
            query += `, AnhBHYT = @anhBHYT`;
            request.input('anhBHYT', sql.NVarChar, anhBHYTPath);
        }
        
        query += ` WHERE ID_YTe = @id_yte`;
        
        await request.query(query);
        
        res.json({ message: 'Admin cập nhật BHYT thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/admin/health/bhyt:', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 4. Admin THÊM Lịch sử khám
app.post('/api/admin/health/exam', authenticateToken, authorizeAdmin, examUpload, async (req, res) => {
    try {
        const { id_yte, ngayKham, bacSi, coSoYTe, chanDoan, phacDoDieuTri } = req.body;
        
        const filePaths = req.files ? req.files.map(file => normalizePath(file.path)) : [];
        const fileDinhKemJson = JSON.stringify(filePaths);
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('ngayKham', sql.Date, ngayKham)
            .input('bacSi', sql.NVarChar, bacSi)
            .input('coSoYTe', sql.NVarChar, coSoYTe)
            .input('chanDoan', sql.NVarChar, chanDoan)
            .input('phacDo', sql.NVarChar, phacDoDieuTri)
            .input('fileDinhKem', sql.NVarChar, fileDinhKemJson) 
            .query(`
                INSERT INTO DuLieuKhamBenh 
                (ID_YTe, NgayKham, BacSi, CoSoYTe, ChanDoan, PhacDoDieuTri, FileDinhKem)
                VALUES (@id_yte, @ngayKham, @bacSi, @coSoYTe, @chanDoan, @phacDo, @fileDinhKem)
            `);
        res.status(201).json({ message: 'Admin thêm lịch sử khám bệnh thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/health/exam (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 5. Admin SỬA Lịch sử khám
app.put('/api/admin/health/exam/:id_khambenh', authenticateToken, authorizeAdmin, examUpload, async (req, res) => {
    try {
        const { id_khambenh } = req.params;
        const { ngayKham, bacSi, coSoYTe, chanDoan, phacDoDieuTri, existingFiles } = req.body;
        const pool = await sql.connect(dbConfig);

        let newFilePaths = req.files ? req.files.map(file => normalizePath(file.path)) : [];
        
        let oldFilePaths = [];
        if (existingFiles) {
            oldFilePaths = Array.isArray(existingFiles) ? existingFiles : [existingFiles];
        }

        const allFilePaths = [...oldFilePaths, ...newFilePaths];
        const fileDinhKemJson = JSON.stringify(allFilePaths);

        await pool.request()
            .input('id', sql.Int, id_khambenh)
            .input('ngayKham', sql.Date, ngayKham)
            .input('bacSi', sql.NVarChar, bacSi)
            .input('coSoYTe', sql.NVarChar, coSoYTe)
            .input('chanDoan', sql.NVarChar, chanDoan)
            .input('phacDo', sql.NVarChar, phacDoDieuTri)
            .input('fileDinhKem', sql.NVarChar, fileDinhKemJson)
            .query(`
                UPDATE DuLieuKhamBenh SET 
                    NgayKham = @ngayKham, BacSi = @bacSi, CoSoYTe = @coSoYTe,
                    ChanDoan = @chanDoan, PhacDoDieuTri = @phacDo, FileDinhKem = @fileDinhKem
                WHERE ID_KhamBenh = @id
            `);
        res.json({ message: 'Admin cập nhật lịch sử khám bệnh thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/health/exam (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 6. Admin XÓA Lịch sử khám
app.delete('/api/admin/health/exam/:id_khambenh', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id_khambenh } = req.params;
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id', sql.Int, id_khambenh)
            .query("DELETE FROM DuLieuKhamBenh WHERE ID_KhamBenh = @id");
        res.json({ message: 'Admin xóa lịch sử khám bệnh thành công.' });
    } catch (error) {
        console.error('Lỗi Admin /api/health/exam (DELETE):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 7. Admin THÊM Lịch sử tiêm
app.post('/api/admin/health/vaccination', authenticateToken, authorizeAdmin, vaccUpload, async (req, res) => {
    try {
        const { id_yte, tenVacXin, donVi, ngayTiem } = req.body;
        const fileXacMinhPath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('id_yte', sql.Int, id_yte)
            .input('tenVacXin', sql.NVarChar, tenVacXin)
            .input('donVi', sql.NVarChar, donVi)
            .input('ngayTiem', sql.Date, ngayTiem)
            .input('fileXacMinh', sql.NVarChar, fileXacMinhPath)
            .query(`
                INSERT INTO DuLieuTiemChung (ID_YTe, TenVacXin, DonVi, NgayTiem, FileXacMinh)
                VALUES (@id_yte, @tenVacXin, @donVi, @ngayTiem, @fileXacMinh)
            `);
        res.status(201).json({ message: 'Admin thêm lịch sử tiêm chủng thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/health/vaccination (POST):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 8. Admin SỬA Lịch sử tiêm
app.put('/api/admin/health/vaccination/:id_tiemchung', authenticateToken, authorizeAdmin, vaccUpload, async (req, res) => {
    try {
        const { id_tiemchung } = req.params;
        const { tenVacXin, donVi, ngayTiem } = req.body;
        const fileXacMinhPath = req.file ? normalizePath(req.file.path) : null;
        
        const pool = await sql.connect(dbConfig);
        
        let query = `UPDATE DuLieuTiemChung SET 
                        TenVacXin = @tenVacXin, DonVi = @donVi, NgayTiem = @ngayTiem
                    `;
        
        const request = pool.request()
            .input('id', sql.Int, id_tiemchung)
            .input('tenVacXin', sql.NVarChar, tenVacXin)
            .input('donVi', sql.NVarChar, donVi)
            .input('ngayTiem', sql.Date, ngayTiem);
            
        if (fileXacMinhPath) {
            query += `, FileXacMinh = @fileXacMinh`;
            request.input('fileXacMinh', sql.NVarChar, fileXacMinhPath);
        }
        
        query += ` WHERE ID_TiemChung = @id`;
        
        await request.query(query);
        res.json({ message: 'Admin cập nhật lịch sử tiêm chủng thành công!' });
    } catch (error) {
        console.error('Lỗi Admin /api/health/vaccination (PUT):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});

// 9. Admin XÓA Lịch sử tiêm
app.delete('/api/admin/health/vaccination/:id_tiemchung', authenticateToken, authorizeAdmin, async (req, res) => {
    try {
        const { id_tiemchung } = req.params;
        const pool = await sql.connect(dbConfig);
        
        await pool.request()
            .input('id', sql.Int, id_tiemchung)
            .query("DELETE FROM DuLieuTiemChung WHERE ID_TiemChung = @id");
        res.json({ message: 'Admin xóa lịch sử tiêm chủng thành công.' });
    } catch (error) {
        console.error('Lỗi Admin /api/health/vaccination (DELETE):', error);
        res.status(500).json({ message: 'Lỗi server.' });
    }
});
// ========================================================
// === KẾT THÚC BỘ API CHỈNH SỬA Y TẾ (ADMIN) ===
// ========================================================
require('./routes/job.routes.js')(app, authenticateToken, dbConfig);
require('./routes/admin.job.routes.js')(app, authenticateToken, authorizeAdmin, dbConfig);
require('./routes/security.routes.js')(app, authenticateToken, dbConfig);
// Truyền dbConfig vào hàm
const publicServiceRoutes = require('./routes/public_service.routes.js')(dbConfig);
app.use('/api/public-service', authenticateToken, publicServiceRoutes);
const systemRoutes = require('./routes/system.routes.js')(dbConfig);
app.use('/api/admin/system', authenticateToken, systemRoutes);
// =========================================
// 7. KHỞI ĐỘNG SERVER (LUÔN Ở CUỐI CÙNG)
// =========================================
app.listen(port, () => {
    console.log(`Backend server đang chạy tại http://localhost:${port}`);
});