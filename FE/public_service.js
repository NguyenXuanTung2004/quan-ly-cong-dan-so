// public_service.js

const API_BASE = 'http://localhost:3000'; // Đảm bảo đúng cổng backend

document.addEventListener('DOMContentLoaded', () => {
    // --- SỬA Ở ĐÂY: Đổi 'token' thành 'userToken' ---
    const token = localStorage.getItem('userToken'); 
    
    // DEBUG: Kiểm tra xem đã lấy được chưa
    console.log("Token hiện tại:", token);

    if (!token) {
        alert('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại!');
        window.location.href = 'login.html';
        return;
    }

    loadServices();
    loadMyHistory();
});

// Hàm hỗ trợ gọi API có kèm Token
async function fetchWithAuth(url, options = {}) {
    // --- SỬA Ở ĐÂY NỮA: Đổi 'token' thành 'userToken' ---
    const token = localStorage.getItem('userToken');
    
    const headers = {
        'Authorization': `Bearer ${token}`, // Gửi token lên server
        ...options.headers
    };
    
    // ... phần còn lại giữ nguyên
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        alert('Phiên đăng nhập hết hạn.');
        // Xóa token cũ đi để tránh lỗi lặp
        localStorage.removeItem('userToken');
        localStorage.removeItem('userInfo');
        window.location.href = 'login.html';
        return null;
    }
    return response;
}

// ... (Các hàm switchTab, loadServices, submitDVC... giữ nguyên như cũ)
function switchTab(tabName) {
    const btnServices = document.getElementById('tab-services');
    const btnRecords = document.getElementById('tab-records');
    const contentServices = document.getElementById('content-services');
    const contentRecords = document.getElementById('content-records');

    if (tabName === 'services') {
        btnServices.className = 'inline-block p-4 text-red-600 border-b-2 border-red-600 rounded-t-lg active group';
        btnRecords.className = 'inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 group';
        contentServices.classList.remove('hidden');
        contentRecords.classList.add('hidden');
    } else {
        btnRecords.className = 'inline-block p-4 text-red-600 border-b-2 border-red-600 rounded-t-lg active group';
        btnServices.className = 'inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 group';
        contentRecords.classList.remove('hidden');
        contentServices.classList.add('hidden');
        loadMyHistory();
    }
}

async function loadServices() {
    try {
        document.getElementById('service-loading').classList.remove('hidden');
        // Gọi API với hàm fetchWithAuth
        const response = await fetchWithAuth('/api/public-service/categories');
        if(!response) return;

        const services = await response.json();
        document.getElementById('service-loading').classList.add('hidden');

        const container = document.getElementById('service-groups-container');
        container.innerHTML = '';

        const groupConfig = {
            'CuTru': { title: 'Phần 1: Quản lý Cư trú', icon: 'fa-house-user' },
            'CanCuoc': { title: 'Phần 2: Quản lý Căn cước công dân', icon: 'fa-id-card' },
            'TuPhap': { title: 'Phần 3: Dịch vụ công Tư pháp', icon: 'fa-gavel' },
            'Khac': { title: 'Phần 4: Dịch vụ khác', icon: 'fa-folder-open' }
        };

        const groupedData = { 'CuTru': [], 'CanCuoc': [], 'TuPhap': [], 'Khac': [] };
        services.forEach(svc => {
            if (groupedData[svc.NhomDichVu]) groupedData[svc.NhomDichVu].push(svc);
        });

        Object.keys(groupConfig).forEach(key => {
            const groupItems = groupedData[key];
            if (groupItems.length > 0) {
                let itemsHtml = '';
                groupItems.forEach(item => {
                    const itemString = encodeURIComponent(JSON.stringify(item));
                    itemsHtml += `
                        <div onclick="openModal('${itemString}')" 
                             class="flex items-center p-4 bg-white border rounded-lg shadow-sm hover:shadow-md hover:border-red-300 cursor-pointer transition">
                            <div class="flex-shrink-0 mr-4 text-red-600">
                                <i class="fas fa-file-contract fa-lg"></i>
                            </div>
                            <div>
                                <h4 class="font-semibold text-gray-800">${item.TenDichVu}</h4>
                                <p class="text-xs text-gray-500 mt-1 truncate w-64">Bấm để thực hiện</p>
                            </div>
                        </div>
                    `;
                });
                container.innerHTML += `
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 class="text-lg font-bold text-gray-800 mb-4 border-l-4 border-red-600 pl-3">
                            <i class="fas ${groupConfig[key].icon} mr-2 text-gray-500"></i>${groupConfig[key].title}
                        </h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${itemsHtml}</div>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error(error);
        document.getElementById('service-groups-container').innerHTML = '<p class="text-red-500 text-center">Lỗi kết nối server.</p>';
    }
}

function openModal(itemString) {
    const item = JSON.parse(decodeURIComponent(itemString));
    
    document.getElementById('modalTitle').innerText = item.TenDichVu;
    document.getElementById('inputMaDichVu').value = item.MaDichVu;
    document.getElementById('modalLegalBase').innerText = item.CoSoPhapLy || "Đang cập nhật...";
    
    // --- THAY ĐỔI Ở ĐÂY: Gọi hàm renderFormFields ---
    const formContainer = document.getElementById('dynamic-form-fields');
    formContainer.innerHTML = renderFormFields(item.MaDichVu);
    
    document.getElementById('dvcForm').reset();
    document.getElementById('applyModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('applyModal').classList.add('hidden');
}

async function submitDVC(event) {
    event.preventDefault();
    const form = document.getElementById('dvcForm');
    
    // Tạo FormData chứa file và các input cơ bản (nguoiNop, cccd...)
    const formData = new FormData(form);

    // --- THAY ĐỔI Ở ĐÂY: Thu thập dữ liệu từ các ô input động ---
    const detailData = {};
    const dynamicContainer = document.getElementById('dynamic-form-fields');
    
    // Lấy tất cả input, select, textarea trong phần động
    const inputs = dynamicContainer.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.name) {
            detailData[input.name] = input.value;
        }
    });
    
    // Thêm thời gian nộp
    detailData['ThoiGianNop'] = new Date().toISOString();

    // Đóng gói thành JSON string gửi lên server
    // (Server sẽ lưu chuỗi này vào cột DuLieuChiTiet)
    formData.append('duLieuChiTiet', JSON.stringify(detailData));

    // --- PHẦN GỬI API (GIỮ NGUYÊN) ---
    try {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerText = 'Đang gửi...';
        submitBtn.disabled = true;

        const token = localStorage.getItem('userToken'); // Nhớ dùng đúng key userToken nhé
        const response = await fetch(`${API_BASE}/api/public-service/submit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData 
        });

        const result = await response.json();

        if (result.success) {
            alert('Nộp hồ sơ thành công!');
            closeModal();
            switchTab('records');
        } else {
            alert('Lỗi: ' + (result.message || 'Không xác định'));
        }
    } catch (error) {
        console.error(error);
        alert('Có lỗi xảy ra khi gửi hồ sơ.');
    } finally {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerText = 'Gửi hồ sơ';
        submitBtn.disabled = false;
    }
}

async function loadMyHistory() {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Đang tải...</td></tr>';

    try {
        const response = await fetchWithAuth('/api/public-service/my-history');
        if(!response) return;
        
        const data = await response.json();
        tbody.innerHTML = '';
        
        if (data.length === 0) {
            document.getElementById('history-empty').classList.remove('hidden');
        } else {
            document.getElementById('history-empty').classList.add('hidden');
            data.forEach(row => {
                let statusColor = 'text-yellow-600 bg-yellow-100';
                if (row.TrangThai === 'Hoàn thành') statusColor = 'text-green-600 bg-green-100';
                if (row.TrangThai === 'Từ chối') statusColor = 'text-red-600 bg-red-100';
                const dateStr = new Date(row.NgayGui).toLocaleDateString('vi-VN');

                tbody.innerHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">#${row.ID_HoSo}</td>
                        <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm font-medium">${row.LoaiDichVu}</td>
                        <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">${dateStr}</td>
                        <td class="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                            <span class="px-3 py-1 font-semibold ${statusColor} rounded-full text-xs">${row.TrangThai}</span>
                        </td>
                    </tr>`;
            });
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-red-500 py-4">Lỗi tải dữ liệu</td></tr>';
    }
}
// --- HÀM VẼ FORM CHI TIẾT THEO TỪNG DỊCH VỤ ---
f// --- HÀM VẼ FORM CHI TIẾT "FULL OPTION" THEO VNEID ---
function renderFormFields(maDichVu) {
    let html = '';

    switch (maDichVu) {
        // --- NHÓM 1: CƯ TRÚ ---
        
        case 'ThongBaoLuuTru':
            html = `
                <div class="bg-red-50 p-2 rounded mb-3 border-l-4 border-red-500"><p class="text-sm text-red-700 font-bold">Thông tin lưu trú</p></div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Loại hình cơ sở</label>
                        <select name="LoaiHinh" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                            <option value="Hộ gia đình">Hộ gia đình</option>
                            <option value="Nhà trọ/Nhà nghỉ">Nhà trọ / Nhà nghỉ</option>
                            <option value="Cơ sở chữa bệnh">Cơ sở chữa bệnh</option>
                        </select>
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Số lượng người</label>
                        <input type="number" name="SoLuongNguoi" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Địa chỉ lưu trú</label>
                    <input type="text" name="DiaChiLuuTru" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required placeholder="Số nhà, đường, xã/phường...">
                </div>
            `;
            break;

        case 'DangKyThuongTru':
            html = `
                <div class="bg-blue-50 p-2 rounded mb-3 border-l-4 border-blue-500"><p class="text-sm text-blue-700 font-bold">Thông tin đăng ký thường trú</p></div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Trường hợp đăng ký</label>
                        <select name="TruongHop" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                            <option value="NhaO_HopPhap">Chỗ ở hợp pháp thuộc quyền sở hữu</option>
                            <option value="NhaO_ThueMuon">Chỗ ở do thuê, mượn, ở nhờ</option>
                            <option value="Ve_NhaChongVo">Về ở với chồng/vợ, cha mẹ, con</option>
                        </select>
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Quan hệ với chủ hộ</label>
                        <input type="text" name="QuanHeChuHo" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" placeholder="VD: Chủ hộ, Vợ, Con...">
                    </div>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Địa chỉ thường trú cũ (Nơi đi)</label>
                    <input type="text" name="DiaChiCu" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Địa chỉ đăng ký mới (Nơi đến)</label>
                    <input type="text" name="DiaChiMoi" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required>
                </div>
            `;
            break;

        case 'DangKyTamTru':
            html = `
                <div class="bg-green-50 p-2 rounded mb-3 border-l-4 border-green-500"><p class="text-sm text-green-700 font-bold">Thông tin đăng ký tạm trú</p></div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Địa chỉ tạm trú</label>
                    <input type="text" name="DiaChiTamTru" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required placeholder="Nơi bạn đang sinh sống thực tế...">
                </div>
                <div class="grid grid-cols-2 gap-4 mt-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Thời hạn tạm trú (Tháng)</label>
                        <input type="number" name="ThoiHan" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" value="12">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Ngày bắt đầu</label>
                        <input type="date" name="NgayBatDau" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Họ tên chủ hộ nơi tạm trú</label>
                    <input type="text" name="ChuHoTamTru" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                </div>
            `;
            break;

        case 'KhaiBaoTamVang':
            html = `
                 <div class="bg-yellow-50 p-2 rounded mb-3 border-l-4 border-yellow-500"><p class="text-sm text-yellow-700 font-bold">Khai báo tạm vắng</p></div>
                 <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Từ ngày</label>
                        <input type="date" name="TuNgay" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Đến ngày</label>
                        <input type="date" name="DenNgay" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required>
                    </div>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Nơi đến (Địa chỉ cụ thể)</label>
                    <input type="text" name="NoiDen" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" placeholder="Nơi bạn sẽ đến ở..." required>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Lý do tạm vắng</label>
                    <textarea name="LyDoTamVang" rows="2" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" placeholder="VD: Đi làm ăn xa, Đi học..."></textarea>
                </div>
            `;
            break;

        // --- NHÓM 2: CĂN CƯỚC ---

        case 'CapTheCCCD':
        case 'DoiTheCCCD':
            html = `
                <div class="bg-indigo-50 p-2 rounded mb-3 border-l-4 border-indigo-500"><p class="text-sm text-indigo-700 font-bold">Yêu cầu cấp/đổi thẻ</p></div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Lý do thực hiện</label>
                    <select name="LyDoCap" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                        <option value="CapMoi">Cấp mới (Chưa có thẻ)</option>
                        <option value="HuHong">Thẻ bị hư hỏng</option>
                        <option value="HetHan">Thẻ hết hạn</option>
                        <option value="ThayDoiTT">Thay đổi thông tin nhân thân</option>
                        <option value="MatThe">Bị mất thẻ (Cấp lại)</option>
                    </select>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Cơ quan tiếp nhận hồ sơ</label>
                    <select name="NoiNop" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                        <option value="CA_Huyen">Công an Quận/Huyện (Nơi thường trú/tạm trú)</option>
                        <option value="CA_Tinh">Phòng PC06 - Công an Tỉnh/TP</option>
                    </select>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Đăng ký nhận kết quả</label>
                    <select name="NhanKetQua" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                        <option value="TrucTiep">Đến nơi nộp để nhận</option>
                        <option value="BuuDien">Gửi qua bưu điện (Trả phí ship)</option>
                    </select>
                </div>
            `;
            break;

        // --- NHÓM 3: TƯ PHÁP ---
        
        case 'LyLichTuPhap':
             html = `
                <div class="bg-gray-100 p-2 rounded mb-3 border-l-4 border-gray-600"><p class="text-sm text-gray-700 font-bold">Phiếu lý lịch tư pháp</p></div>
                <div class="grid grid-cols-2 gap-4">
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Yêu cầu cấp phiếu</label>
                        <select name="LoaiPhieu" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                            <option value="So1">Phiếu số 1 (Cá nhân, xin việc)</option>
                            <option value="So2">Phiếu số 2 (Tố tụng, Định cư)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Số lượng bản</label>
                        <input type="number" name="SoLuongBan" value="1" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Mục đích yêu cầu</label>
                    <textarea name="MucDich" rows="2" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" placeholder="VD: Để bổ sung hồ sơ xin việc làm..."></textarea>
                </div>
                <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Quá trình cư trú (Ngắn gọn)</label>
                    <textarea name="QuaTrinhCuTru" rows="2" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" placeholder="Ghi rõ quá trình cư trú từ năm 14 tuổi đến nay..."></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4 mt-3">
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Họ tên Cha</label>
                        <input type="text" name="TenCha" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Họ tên Mẹ</label>
                        <input type="text" name="TenMe" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                </div>
             `;
            break;

        // --- NHÓM 4: DỊCH VỤ KHÁC ---

        case 'KhaiSinh':
            html = `
                <div class="bg-blue-100 p-2 rounded mb-3"><p class="text-sm text-blue-800 font-bold">1. Thông tin trẻ</p></div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Họ và tên trẻ</label>
                        <input type="text" name="HoTenTre" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg uppercase" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Ngày sinh</label>
                        <input type="date" name="NgaySinhTre" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required>
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Giới tính</label>
                        <select name="GioiTinhTre" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                        </select>
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Dân tộc</label>
                        <input type="text" name="DanToc" value="Kinh" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                </div>
                <div class="mt-3">
                     <label class="block text-sm font-medium text-gray-700">Nơi sinh (Bệnh viện/Cơ sở y tế)</label>
                     <input type="text" name="NoiSinh" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                </div>

                <div class="bg-blue-100 p-2 rounded mb-3 mt-4"><p class="text-sm text-blue-800 font-bold">2. Thông tin Cha Mẹ</p></div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                         <label class="block text-sm font-medium text-gray-700">Họ tên Cha</label>
                         <input type="text" name="HoTenCha" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                    <div>
                         <label class="block text-sm font-medium text-gray-700">Họ tên Mẹ</label>
                         <input type="text" name="HoTenMe" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required>
                    </div>
                </div>
            `;
            break;

        case 'DatDai':
             html = `
                <div class="bg-green-100 p-2 rounded mb-3 border-l-4 border-green-600"><p class="text-sm text-green-800 font-bold">Thông tin đất đai</p></div>
                <div>
                     <label class="block text-sm font-medium text-gray-700">Loại thủ tục</label>
                     <select name="LoaiThuTucDat" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                        <option value="CapMoi">Cấp GCN quyền sử dụng đất (Lần đầu)</option>
                        <option value="SangTen">Đăng ký sang tên (Chuyển nhượng, tặng cho)</option>
                        <option value="CapDoi">Cấp đổi GCN (Bị rách, ố, cũ)</option>
                    </select>
                </div>
                <div class="grid grid-cols-3 gap-4 mt-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">Số tờ bản đồ</label>
                        <input type="text" name="SoTo" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Số thửa</label>
                        <input type="text" name="SoThua" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                     <div>
                        <label class="block text-sm font-medium text-gray-700">Diện tích (m2)</label>
                        <input type="number" name="DienTich" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg">
                    </div>
                </div>
                 <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Địa chỉ thửa đất</label>
                    <input type="text" name="DiaChiDat" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" required>
                </div>
                 <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700">Số GCN (Sổ đỏ/Sổ hồng) - Nếu có</label>
                    <input type="text" name="SoGCN" class="mt-1 block w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg" placeholder="Nhập nếu đang làm thủ tục sang tên/cấp đổi">
                </div>
             `;
            break;

        default:
            html = `
                <div>
                    <label class="block mb-2 text-sm font-medium text-gray-900">Nội dung đề nghị</label>
                    <textarea name="NoiDungChung" rows="4" class="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-red-500 focus:border-red-500" placeholder="Nhập nội dung yêu cầu chi tiết..."></textarea>
                </div>
            `;
    }
    return html;
}