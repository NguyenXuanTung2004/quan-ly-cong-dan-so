// frontend/auth.js

// 1. Chờ cho HTML tải xong
document.addEventListener('DOMContentLoaded', () => {

    // === PHẦN 1: XỬ LÝ FORM ĐĂNG NHẬP ===
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const soDinhDanh = document.getElementById('soDinhDanh').value;
            const matKhau = document.getElementById('matKhau').value;
            const messageDiv = document.getElementById('message');

            const loginData = { soDinhDanh, matKhau };

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginData)
                });

                const data = await response.json();

                if (response.ok) {
                    messageDiv.textContent = data.message;
                    messageDiv.style.color = 'green';
                    
                    localStorage.setItem('userToken', data.token);
                    localStorage.setItem('userInfo', JSON.stringify(data.user));

                   setTimeout(() => {
        if (data.user.role === 'Admin') {
            window.location.href = 'admin.html'; // Nếu là Admin -> sang trang Admin
        } else {
            window.location.href = 'dashboard.html'; // Nếu là User -> sang trang chủ
        }
    }, 2000);
                    messageDiv.textContent = data.message;
                    messageDiv.style.color = 'green';
                }
            } catch (error) {
                console.error('Lỗi khi gọi API:', error);
                messageDiv.textContent = 'Không thể kết nối đến server. Vui lòng thử lại!';
                messageDiv.style.color = 'red';
            }
        });
    }

    // === PHẦN 2: XỬ LÝ FORM ĐĂNG KÝ (MỚI) ===
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Lấy tất cả dữ liệu từ formdashboard.html
            const hoTen = document.getElementById('hoTen').value;
            const email = document.getElementById('email').value;
            const soDinhDanh = document.getElementById('soDinhDanh').value;
            const matKhau = document.getElementById('matKhau').value;
            const xacNhanMatKhau = document.getElementById('xacNhanMatKhau').value;
            const messageDiv = document.getElementById('message');

            // 2. Kiểm tra mật khẩu có khớp không
            if (matKhau !== xacNhanMatKhau) {
                messageDiv.textContent = 'Mật khẩu xác nhận không khớp!';
                messageDiv.style.color = 'red';
                return; // Dừng lại nếu không khớp
            }

            // 3. Chuẩn bị dữ liệu gửi lên server
            // (Chỉ gửi 1 mật khẩu, vì đã kiểm tra khớp)
            const registerData = { hoTen, email, soDinhDanh, matKhau };

            try {
                // 4. Gọi API Đăng ký
                const response = await fetch('http://localhost:3000/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(registerData)
                });

                const data = await response.json();

                if (response.ok) { // Mã 2xx (Đăng ký thành công)
                    // Hiện thông báo màu xanh
                    messageDiv.textContent = '🎉 Đăng ký thành công! Đang chuyển đến trang đăng nhập...';
                    messageDiv.style.color = 'green';
                    // Nếu bạn đã cập nhật CSS message-box thì dùng:
                    // messageDiv.className = 'message-box success'; 

                    registerForm.reset(); // Xóa trắng form

                    // Chờ 2 giây để người dùng đọc thông báo, rồi chuyển trang
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1000);

                } else { // Mã lỗi (4xx, 5xx)
                    messageDiv.textContent = data.message || 'Đăng ký thất bại.';
                    messageDiv.style.color = 'red';
                     // Nếu đã cập nhật CSS: messageDiv.className = 'message-box error';
                }
            } catch (error) {
                console.error('Lỗi khi gọi API:', error);
                messageDiv.textContent = 'Không thể kết nối đến server. Vui lòng thử lại!';
                messageDiv.style.color = 'red';
            }
        });
    }
});