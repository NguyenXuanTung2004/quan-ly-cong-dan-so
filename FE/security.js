// frontend/security.js

const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('userToken');
    if (!token) {
        alert('Phiên đăng nhập hết hạn.');
        window.location.href = 'login.html';
        return;
    }

    // Khởi tạo các chức năng
    initProfileData(token);
    initChangePassword(token);
    loadLoginHistory(token);
});

// --- 1. QUẢN LÝ THÔNG TIN CÁ NHÂN ---
async function initProfileData(token) {
    // Tải dữ liệu
    try {
        const res = await fetch(`${API_URL}/api/security/info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            // Điền dữ liệu nếu element tồn tại
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val || '';
            };
            
            setVal('profileName', data.HoTen);
            setVal('profileEmail', data.Email);
            setVal('profilePhone', data.SDT);
            setVal('profileReligion', data.TonGiao);
            setVal('profileAddress', data.DC);
        }
    } catch (error) {
        console.error("Lỗi tải thông tin:", error);
    }

    // Xử lý Lưu
    const form = document.getElementById('updateProfileForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const getVal = (id) => document.getElementById(id).value;
        const payload = {
            email: getVal('profileEmail'),
            sdt: getVal('profilePhone'),
            tonGiao: getVal('profileReligion'),
            diaChi: getVal('profileAddress')
        };

        try {
            const res = await fetch(`${API_URL}/api/security/info`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (res.ok) alert('Cập nhật thông tin thành công!');
            else alert(result.message || 'Lỗi cập nhật.');
        } catch (error) {
            alert('Lỗi kết nối server.');
        }
    });
}

// --- 2. ĐỔI MẬT KHẨU ---
function initChangePassword(token) {
    const form = document.getElementById('changePassForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPass = document.getElementById('currentPass').value;
        const newPass = document.getElementById('newPass').value;
        const confirmPass = document.getElementById('confirmPass').value;

        if (newPass !== confirmPass) {
            alert('Mật khẩu xác nhận không khớp.');
            return;
        }
        if (newPass.length < 6) {
            alert('Mật khẩu mới quá ngắn (tối thiểu 6 ký tự).');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/security/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ matKhauCu: currentPass, matKhauMoi: newPass })
            });
            const result = await res.json();
            
            if (res.ok) {
                alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
                localStorage.clear();
                window.location.href = 'login.html';
            } else {
                alert(result.message || 'Lỗi đổi mật khẩu.');
            }
        } catch (error) {
            alert('Lỗi kết nối server.');
        }
    });
}

// --- 3. LỊCH SỬ ĐĂNG NHẬP ---
async function loadLoginHistory(token) {
    const container = document.getElementById('historyListContainer');
    
    try {
        const res = await fetch(`${API_URL}/api/security/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed');
        const list = await res.json();

        container.innerHTML = '';
        if (list.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px;">Chưa có lịch sử.</div>';
            return;
        }

        list.forEach(item => {
            const date = new Date(item.ThoiGian).toLocaleString('vi-VN');
            
            // Phân loại thiết bị để hiện icon
            let iconClass = 'fa-desktop';
            let deviceName = 'Máy tính';
            const userAgent = (item.ThietBi || '').toLowerCase();

            if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
                iconClass = 'fa-mobile-screen';
                deviceName = 'Điện thoại';
            }

            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="device-icon">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div class="history-info">
                    <h4>${deviceName}</h4>
                    <p>${date}</p>
                </div>
                <div class="history-ip">
                    ${item.IPAddress}
                </div>
            `;
            container.appendChild(div);
        });

    } catch (error) {
        container.innerHTML = '<div style="text-align:center; color:red;">Không thể tải dữ liệu.</div>';
    }
}