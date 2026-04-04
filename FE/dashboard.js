// frontend/dashboard.js

(function checkAuthentication() {
    const token = localStorage.getItem('userToken');
    if (!token) window.location.href = 'login.html';
})();

document.addEventListener('DOMContentLoaded', () => {
    const userInfo = JSON.parse(localStorage.getItem('userInfo')) || {};
    
    if (userInfo.HoTen) {
        document.getElementById('header-username').textContent = userInfo.HoTen;
    }

    setupLogout();
    checkIdentityStatus();
});

function setupLogout() {
    const btn = document.getElementById('logoutButton');
    const modal = document.getElementById('logoutModal');
    const btnYes = document.getElementById('confirmLogoutYes');
    const btnNo = document.getElementById('confirmLogoutNo');

    btn.addEventListener('click', () => modal.classList.add('active'));
    btnNo.addEventListener('click', () => modal.classList.remove('active'));
    btnYes.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });
}

async function checkIdentityStatus() {
    // ID MỚI TRONG HTML
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const restrictedCards = document.querySelectorAll('.card.requires-identity');

    try {
        const token = localStorage.getItem('userToken');
        const response = await fetch('http://localhost:3000/api/identity/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const status = data.TrangThaiDinhDanh;

        // Cập nhật tên chính xác
        if (data.HoTen) {
            document.getElementById('header-username').textContent = data.HoTen;
        }

        let isVerified = false;

        // Xử lý logic hiển thị chấm màu và text
        if (status === 'Đã duyệt') {
            isVerified = true;
            statusText.textContent = 'Đã định danh ';
            statusText.style.color = '#4ade80'; // Xanh lá sáng
            statusDot.style.backgroundColor = '#4ade80';
            statusDot.style.boxShadow = '0 0 10px #4ade80';
        } else if (status === 'Chờ duyệt') {
            statusText.textContent = 'Đang chờ phê duyệt';
            statusText.style.color = '#fbbf24'; // Vàng
            statusDot.style.backgroundColor = '#fbbf24';
            statusDot.style.boxShadow = '0 0 10px #fbbf24';
        } else if (status === 'Bị từ chối') {
            statusText.textContent = 'Hồ sơ bị từ chối';
            statusText.style.color = '#f87171'; // Đỏ nhạt
            statusDot.style.backgroundColor = '#f87171';
            statusDot.style.boxShadow = '0 0 10px #f87171';
        } else {
            statusText.textContent = 'Chưa định danh';
            statusText.style.color = '#cbd5e1'; // Xám
            statusDot.style.backgroundColor = '#cbd5e1';
            statusDot.style.boxShadow = 'none';
            statusDot.style.animation = 'none';
        }

        // Mở khóa chức năng
        restrictedCards.forEach(card => {
            if (isVerified) {
                card.classList.remove('disabled');
            } else {
                card.classList.add('disabled');
                card.addEventListener('click', (e) => { e.preventDefault(); });
            }
        });

    } catch (error) {
        // Mặc định khi lỗi
        statusText.textContent = 'Chưa định danh';
        restrictedCards.forEach(c => c.classList.add('disabled'));
    }
}