-- ============================================
-- SETUP DATABASE VÀ TÀI KHOẢN TEST
-- ============================================
-- Chạy script này bằng SQL Server Management Studio 
-- hoặc: sqlcmd -S .\SQLEXPRESS -E -i setup.sql

-- Tạo database nếu chưa tồn tại
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'dacn')
BEGIN
    CREATE DATABASE dacn;
    PRINT 'Database dacn created successfully!';
END
ELSE
    PRINT 'Database dacn already exists!';

GO

USE dacn;

-- ============================================
-- TẠO CÁC BẢNG
-- ============================================

-- Bảng Hộ Sơ Công Dân
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'HoSoCongDan')
CREATE TABLE HoSoCongDan (
    ID_CD NVARCHAR(20) PRIMARY KEY,
    HoTen NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100),
    NgaySinh DATE,
    GioiTinh NVARCHAR(10),
    QueQuan NVARCHAR(100),
    DC NVARCHAR(200),
    SDT NVARCHAR(20),
    DanToc NVARCHAR(50),
    TonGiao NVARCHAR(50),
    TrangThaiDinhDanh NVARCHAR(50) DEFAULT 'Chưa định danh'
);

-- Bảng Tài Khoản
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TaiKhoan')
CREATE TABLE TaiKhoan (
    ID_TK INT IDENTITY(1,1) PRIMARY KEY,
    ID_CD NVARCHAR(20) FOREIGN KEY REFERENCES HoSoCongDan(ID_CD),
    TenDangNhap NVARCHAR(100) UNIQUE,
    MatKhau NVARCHAR(100),
    VaiTro NVARCHAR(50) DEFAULT 'User'
);

-- Bảng Hộ Sơ Giáo Dục
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'HoSoGiaoDuc')
CREATE TABLE HoSoGiaoDuc (
    ID_GD INT IDENTITY(1,1) PRIMARY KEY,
    ID_TK INT FOREIGN KEY REFERENCES TaiKhoan(ID_TK),
    TruongCap1 NVARCHAR(200),
    ThoiGianCap1 NVARCHAR(100),
    TruongCap2 NVARCHAR(200),
    ThoiGianCap2 NVARCHAR(100)
);

-- Bảng Quá Trình Học Tập
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'QuaTrinhHocTap')
CREATE TABLE QuaTrinhHocTap (
    ID_HocTap INT IDENTITY(1,1) PRIMARY KEY,
    ID_GD INT FOREIGN KEY REFERENCES HoSoGiaoDuc(ID_GD),
    CapHoc NVARCHAR(50),
    TenTruong NVARCHAR(200),
    ThoiGian NVARCHAR(100),
    NganhHoc NVARCHAR(100),
    HeDaoTao NVARCHAR(100),
    DiemTB_10 FLOAT,
    DiemTB_11 FLOAT,
    DiemTB_12 FLOAT,
    HanhKiem NVARCHAR(50),
    HocLuc NVARCHAR(50),
    GPA FLOAT,
    LoaiTotNghiep NVARCHAR(100),
    FileHocBa10 NVARCHAR(500),
    FileHocBa11 NVARCHAR(500),
    FileHocBa12 NVARCHAR(500),
    FileBangDiem NVARCHAR(500)
);

-- Bảng Chứng Chỉ
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ChungChi')
CREATE TABLE ChungChi (
    ID_ChungChi INT IDENTITY(1,1) PRIMARY KEY,
    TenChungChi NVARCHAR(200),
    DonViCap NVARCHAR(200),
    NgayCap DATE,
    NgayHetHan DATE,
    LoaiVanBang NVARCHAR(100),
    FilePath NVARCHAR(500)
);

-- Bảng Chi Tiết Chứng Chỉ
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ChiTietChungChi')
CREATE TABLE ChiTietChungChi (
    ID_CTCC INT IDENTITY(1,1) PRIMARY KEY,
    ID_GD INT FOREIGN KEY REFERENCES HoSoGiaoDuc(ID_GD),
    ID_ChungChi INT FOREIGN KEY REFERENCES ChungChi(ID_ChungChi)
);

-- Bảng Định Danh Số
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DinhDanhSo')
CREATE TABLE DinhDanhSo (
    ID_DinhDanh NVARCHAR(50) PRIMARY KEY,
    ID_CD NVARCHAR(20) FOREIGN KEY REFERENCES HoSoCongDan(ID_CD),
    SoDinhDanh NVARCHAR(50),
    LoaiGiayTo NVARCHAR(50),
    AnhMatTruoc NVARCHAR(500),
    AnhMatSau NVARCHAR(500)
);

-- Bảng Hộ Sơ Y Tế
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'HoSoYTe')
CREATE TABLE HoSoYTe (
    ID_YTe INT IDENTITY(1,1) PRIMARY KEY,
    ID_TK INT FOREIGN KEY REFERENCES TaiKhoan(ID_TK),
    NhomMau NVARCHAR(10),
    TienSuBenh NVARCHAR(500),
    ThoiGianCapNhat DATETIME DEFAULT GETDATE(),
    BHYT NVARCHAR(100),
    AnhBHYT NVARCHAR(500)
);

-- Bảng Dữ Liệu Khám Bệnh
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DuLieuKhamBenh')
CREATE TABLE DuLieuKhamBenh (
    ID_KhamBenh INT IDENTITY(1,1) PRIMARY KEY,
    ID_YTe INT FOREIGN KEY REFERENCES HoSoYTe(ID_YTe),
    NgayKham DATE,
    CoSoKham NVARCHAR(200),
    ChanDoan NVARCHAR(500),
    TrieUChung NVARCHAR(500),
    FileDinhKem NVARCHAR(500)
);

-- Bảng Dữ Liệu Tiêm Chủng
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DuLieuTiemChung')
CREATE TABLE DuLieuTiemChung (
    ID_TiemChung INT IDENTITY(1,1) PRIMARY KEY,
    ID_YTe INT FOREIGN KEY REFERENCES HoSoYTe(ID_YTe),
    TenVacxin NVARCHAR(200),
    NgayTiem DATE,
    CoSoTiem NVARCHAR(200),
    LieuLuong NVARCHAR(100),
    MuiTiem INT
);

-- Bảng Công Việc
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Job')
CREATE TABLE Job (
    ID_Job INT IDENTITY(1,1) PRIMARY KEY,
    TenViecLam NVARCHAR(200),
    MoTa NVARCHAR(500),
    NoiLamViec NVARCHAR(200),
    MucLuong NVARCHAR(50),
    TrangThai NVARCHAR(50)
);

-- Bảng Lịch Sử Đăng Nhập
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LichSuDangNhap')
CREATE TABLE LichSuDangNhap (
    ID_LS INT IDENTITY(1,1) PRIMARY KEY,
    ID_TK INT FOREIGN KEY REFERENCES TaiKhoan(ID_TK),
    ThoiGianDangNhap DATETIME DEFAULT GETDATE(),
    ThietBi NVARCHAR(500),
    IPAddress NVARCHAR(50)
);

PRINT 'All tables created successfully!';

GO

-- ============================================
-- CHÈN DỮ LIỆU TEST
-- ============================================

-- Xóa dữ liệu cũ (nếu có)
DELETE FROM LichSuDangNhap;
DELETE FROM DuLieuTiemChung;
DELETE FROM DuLieuKhamBenh;
DELETE FROM HoSoYTe;
DELETE FROM ChiTietChungChi;
DELETE FROM ChungChi;
DELETE FROM QuaTrinhHocTap;
DELETE FROM HoSoGiaoDuc;
DELETE FROM TaiKhoan;
DELETE FROM DinhDanhSo;
DELETE FROM HoSoCongDan;

-- Tạo hộ sơ công dân test
INSERT INTO HoSoCongDan VALUES 
    ('001234567890', N'Nguyễn Văn Admin', 'admin@test.com', '1990-01-01', N'Nam', N'Hà Nội', N'123 Đường Láng', '0123456789', N'Kinh', N'Không', N'Đã duyệt'),
    ('001234567891', N'Trần Thị User', 'user@test.com', '1995-05-15', N'Nữ', N'TP HCM', N'456 Nguyễn Huệ', '0987654321', N'Kinh', N'Không', N'Chờ duyệt'),
    ('001234567892', N'Lê Minh Guest', 'guest@test.com', '1992-03-20', N'Nam', N'Đà Nẵng', N'789 Hải Phòng', '0912345678', N'Kinh', N'Không', N'Chưa định danh');

-- Tạo tài khoản test
INSERT INTO TaiKhoan VALUES 
    ('001234567890', 'admin', 'Admin@123', N'Admin'),
    ('001234567891', 'user', 'User@123', N'User'),
    ('001234567892', 'guest', 'Guest@123', N'User');

-- Tạo hộ sơ giáo dục cho các user
INSERT INTO HoSoGiaoDuc VALUES 
    (1, N'Trường THPT Nguyễn Trãi', N'2012-2015', N'Trường THPT Nguyễn Trãi', N'2015-2018'),
    (2, N'Trường THPT Lê Quý Đôn', N'2011-2014', N'Trường THPT Lê Quý Đôn', N'2014-2017'),
    (3, NULL, NULL, NULL, NULL);

-- Tạo hộ sơ y tế
INSERT INTO HoSoYTe VALUES 
    (1, N'O', N'Không có tiền sử bệnh', GETDATE(), N'TS123456', NULL),
    (2, N'B', N'Dị ứng phấn hoa', GETDATE(), N'TS789012', NULL),
    (3, N'AB', N'Bình thường', GETDATE(), NULL, NULL);

-- Tạo công việc mẫu
INSERT INTO Job VALUES 
    (N'Lập trình viên', N'Tuyển dụng lập trình viên Full Stack', N'Hà Nội', N'15-20 triệu', N'Đang tuyển'),
    (N'Designer', N'Tuyển dụng UI/UX Designer', N'TP HCM', N'12-18 triệu', N'Đang tuyển');

PRINT 'Test data inserted successfully!';
PRINT '';
PRINT '============================================';
PRINT 'TÀI KHOẢN TEST ĐƯỢC TẠO:';
PRINT '============================================';
PRINT 'Admin:';
PRINT '  Username: admin';
PRINT '  Password: Admin@123';
PRINT '  Role: Admin';
PRINT '';
PRINT 'User:';
PRINT '  Username: user';
PRINT '  Password: User@123';
PRINT '  Role: User';
PRINT '';
PRINT 'Guest:';
PRINT '  Username: guest';
PRINT '  Password: Guest@123';
PRINT '  Role: User';
PRINT '============================================';
