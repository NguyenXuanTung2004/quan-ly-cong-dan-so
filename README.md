# QLCD - Quản Lý Công Dân Số

Hệ thống quản lý hộ sơ công dân số với các tính năng định danh, quản lý giáo dục, y tế, và công việc.

---
**Tài khoản test:**
- Admin: `ADMIN01` / `123`
- User: `012345678911` / `123`
---

### Sửa cấu hình Database trong `BE/server.js`

Mở file `BE/server.js`, tìm dòng:

```javascript
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


### Chạy Backend

```bash
cd BE
npm install
node server.js
```

Backend chạy tại: `http://localhost:3000`

---

## 📝 Ghi chú

- Sửa lại `server.js` để khớp với SQL Server trước khi chạy
- Chạy `setup.sql` để tạo database và tài khoản test
- Tài khoản test sẽ reset nếu chạy lại `setup.sql`
