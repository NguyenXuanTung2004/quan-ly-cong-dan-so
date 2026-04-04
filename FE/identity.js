// frontend/identity.js

const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('userToken');
    if (!token) window.location.href = 'login.html';

    loadIdentityStatus();

    // Preview ảnh khi upload
    window.previewImage = function(input, imgId) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.getElementById(imgId);
                img.src = e.target.result;
                img.style.display = 'block';
            }
            reader.readAsDataURL(input.files[0]);
        }
    };

    const form = document.getElementById('identityForm');
    form.addEventListener('submit', handleIdentitySubmit);
});

async function loadIdentityStatus() {
    try {
        const token = localStorage.getItem('userToken');
        const res = await fetch(`${API_URL}/api/identity/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const formSection = document.getElementById('form-section');
        const viewSection = document.getElementById('view-section');

        if (!res.ok) {
            formSection.style.display = 'block';
            viewSection.style.display = 'none';
            const user = JSON.parse(localStorage.getItem('userInfo'));
            if(user && user.HoTen) document.getElementById('hoTen').value = user.HoTen;
            return;
        }

        const data = await res.json();
        const status = data.TrangThaiDinhDanh;

        if (status === 'Đã duyệt' || status === 'Chờ duyệt') {
            formSection.style.display = 'none';
            viewSection.style.display = 'block';

            // Điền thông tin văn bản
            document.getElementById('view-name').textContent = (data.HoTen || '').toUpperCase();
            document.getElementById('view-cccd').textContent = data.CCCD || '---';
            document.getElementById('view-dob').textContent = data.NgaySinh ? formatDate(data.NgaySinh) : '---';
            document.getElementById('view-gender').textContent = data.GioiTinh || '---';
            document.getElementById('view-nation').textContent = data.DanToc || '---';
            document.getElementById('view-religion').textContent = data.TonGiao || '---';
            document.getElementById('view-hometown').textContent = data.QueQuan || '---';
            document.getElementById('view-address').textContent = data.DC || '---';

            // --- XỬ LÝ HIỂN THỊ ẢNH ---
            const imgTruoc = document.getElementById('view-img-truoc');
            const imgSau = document.getElementById('view-img-sau');
            const avatarImg = document.getElementById('view-avatar');
            const avatarIcon = document.getElementById('view-avatar-icon');

            // Lưu ý: Đường dẫn ảnh từ server thường là "uploads/..."
            // Cần thêm API_URL vào trước nếu server trả về đường dẫn tương đối
            if (data.AnhMatTruoc) {
                // Xử lý dấu gạch chéo ngược nếu có (do Windows path)
                const pathTruoc = data.AnhMatTruoc.replace(/\\/g, '/'); 
                const fullPathTruoc = `${API_URL}/${pathTruoc}`;
                
                imgTruoc.src = fullPathTruoc;
                
                // Dùng ảnh mặt trước làm Avatar luôn cho đẹp
                avatarImg.src = fullPathTruoc;
                avatarImg.style.display = 'block';
                avatarIcon.style.display = 'none';
            } else {
                imgTruoc.alt = "Không có ảnh mặt trước";
            }

            if (data.AnhMatSau) {
                const pathSau = data.AnhMatSau.replace(/\\/g, '/');
                const fullPathSau = `${API_URL}/${pathSau}`;
                imgSau.src = fullPathSau;
            } else {
                imgSau.alt = "Không có ảnh mặt sau";
            }
            // ---------------------------

            const badge = document.getElementById('view-status');
            if (status === 'Chờ duyệt') {
                badge.textContent = 'Đang chờ duyệt';
                badge.className = 'status-badge pending';
            } else {
                badge.textContent = 'Đã định danh';
                badge.className = 'status-badge approved';
            }

        } else {
            formSection.style.display = 'block';
            viewSection.style.display = 'none';
            if (data.CCCD) document.getElementById('cccd').value = data.CCCD;
            if (data.HoTen) document.getElementById('hoTen').value = data.HoTen;
            
            if (status === 'Bị từ chối') {
                alert('Hồ sơ của bạn đã bị từ chối. Vui lòng cập nhật lại thông tin chính xác.');
            }
        }

    } catch (error) {
        console.error("Lỗi tải định danh:", error);
    }
}

async function handleIdentitySubmit(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btnSubmit');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('cccd', document.getElementById('cccd').value);
    // Nếu API backend tự lấy HoTen từ bảng TaiKhoan thì không cần gửi, 
    // nhưng nếu cần cập nhật lại thì gửi. Ở đây tôi gửi luôn để chắc chắn.
    // Lưu ý: Cần kiểm tra Backend server.js xem có nhận 'hoTen' không.
    // Nếu server chỉ update info định danh, thì hoTen có thể bị bỏ qua.
    
    formData.append('ngaySinh', document.getElementById('ngaySinh').value);
    formData.append('gioiTinh', document.getElementById('gioiTinh').value);
    formData.append('danToc', document.getElementById('danToc').value);
    formData.append('tonGiao', document.getElementById('tonGiao').value);
    formData.append('queQuan', document.getElementById('queQuan').value);
    formData.append('thuongTru', document.getElementById('thuongTru').value);

    const fileTruoc = document.getElementById('anhMatTruoc').files[0];
    const fileSau = document.getElementById('anhMatSau').files[0];

    if (fileTruoc) formData.append('anhMatTruoc', fileTruoc);
    if (fileSau) formData.append('anhMatSau', fileSau);

    try {
        const token = localStorage.getItem('userToken');
        const res = await fetch(`${API_URL}/api/identity/register`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await res.json();

        if (res.ok) {
            alert('Gửi hồ sơ thành công! Vui lòng chờ xét duyệt.');
            window.location.reload();
        } else {
            alert(result.message || 'Có lỗi xảy ra.');
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi hồ sơ định danh';
            btn.disabled = false;
        }
    } catch (error) {
        console.error(error);
        alert('Lỗi kết nối server.');
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi hồ sơ định danh';
        btn.disabled = false;
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}