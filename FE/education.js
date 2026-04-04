// frontend/education.js - PHIÊN BẢN DASHBOARD

// Biến global để lưu trữ hồ sơ giáo dục
let currentEducationProfile = {};
const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    // === SỬA LỖI: Tìm 'userToken' thay vì 'token' ===
    if (!localStorage.getItem('userToken')) {
        // Tự động chuyển về trang login nếu chưa đăng nhập
        window.location.href = 'login.html';
        return;
    }
    // === KẾT THÚC SỬA LỖI ===

    // Tải dữ liệu
    loadEducationData();

    // Gán sự kiện cho các nút
    document.getElementById('edit-level-1-btn').addEventListener('click', openLevel1Modal);
    document.getElementById('edit-level-2-btn').addEventListener('click', openLevel2Modal);
    
    document.getElementById('level1Form').addEventListener('submit', saveLevel1);
    document.getElementById('level2Form').addEventListener('submit', saveLevel2);

    // Nút Thêm mới
    document.getElementById('add-level-3-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLearningProcessModal('Cấp 3');
        return false;
    });
    document.getElementById('add-higher-ed-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLearningProcessModal('Đại học');
        return false;
    });
    document.getElementById('add-certificate-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCertificateModal();
        return false;
    });

    // Form
    document.getElementById('learningProcessForm').addEventListener('submit', saveLearningProcess);
    document.getElementById('certificateForm').addEventListener('submit', saveCertificate);
});

// =========================================
// TẢI VÀ HIỂN THỊ DỮ LIỆU (RENDER)
// =========================================

async function loadEducationData() {
    showLoading();
    try {
        // === BẮT ĐẦU SỬA ĐỔI ===
        // Sử dụng fetchWithToken để nó tự động xử lý lỗi 401/403 (hết hạn)
        currentEducationProfile = await fetchWithToken('/api/education/me', 'GET');
        
        // Nếu fetchWithToken thành công, chúng ta có dữ liệu
        // Nếu thất bại (hết hạn), fetchWithToken sẽ tự xử lý (hiện alert và chuyển trang)
        // === KẾT THÚC SỬA ĐỔI ===

        // 1. Render Cấp 1
        const level1School = document.getElementById('level-1-school');
        const level1Years = document.getElementById('level-1-years');
        level1School.textContent = currentEducationProfile.TruongCap1 || 'Chưa cập nhật';
        level1Years.textContent = currentEducationProfile.ThoiGianCap1 || 'Chưa cập nhật';
        level1School.classList.toggle('data-placeholder', !currentEducationProfile.TruongCap1);
        level1Years.classList.toggle('data-placeholder', !currentEducationProfile.ThoiGianCap1);


        // 2. Render Cấp 2
        const level2School = document.getElementById('level-2-school');
        const level2Years = document.getElementById('level-2-years');
        level2School.textContent = currentEducationProfile.TruongCap2 || 'Chưa cập nhật';
        level2Years.textContent = currentEducationProfile.ThoiGianCap2 || 'Chưa cập nhật';
        level2School.classList.toggle('data-placeholder', !currentEducationProfile.TruongCap2);
        level2Years.classList.toggle('data-placeholder', !currentEducationProfile.ThoiGianCap2);

        // 3. Render Cấp 3 và ĐH/CĐ
        const quaTrinhHocTap = currentEducationProfile.quaTrinhHocTap || [];
        const level3List = quaTrinhHocTap.filter(item => item.CapHoc === 'Cấp 3');
        const higherEdList = quaTrinhHocTap.filter(item => item.CapHoc !== 'Cấp 3');
        
        renderLearningProcessList('level-3-list', level3List);
        renderLearningProcessList('higher-ed-list', higherEdList);

        // 4. Render Chứng chỉ
        const chungChiList = currentEducationProfile.chungChiList || [];
        renderCertificateList('certificate-list', chungChiList);

    } catch (error) {
        // Chỉ hiển thị lỗi nếu đó không phải là lỗi "hết hạn"
        // (vì lỗi "hết hạn" đã được fetchWithToken xử lý rồi)
        if (error.message && error.message !== 'Phiên đăng nhập đã hết hạn.') {
            showToast(error.message, false);
        } else if (error.message) {
            // Hiển thị lỗi chung (nếu có) mà không phải lỗi hết hạn
            showToast(error.message, false);
        }
    } finally {
        hideLoading();
    }
}

// Hàm render Cấp 3 / ĐH / CĐ
function renderLearningProcessList(containerId, itemList) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Xóa list cũ

    if (itemList.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic">Không có dữ liệu.</p>';
        return;
    }

    itemList.forEach(item => {
        const itemCard = document.createElement('div');
        // Thêm padding-bottom để thẻ to ra 1 chút
        itemCard.className = 'border border-gray-200 rounded-lg p-4 pb-6 relative';
        
        // Thêm nút (bên phải)
        itemCard.innerHTML += `
            <div class="absolute top-4 right-4 flex space-x-2">
                <button title="Xem chi tiết" class="btn-view-details text-gray-500 hover:text-blue-500 p-2 rounded-md hover:bg-gray-100">
                    <i class="fas fa-eye"></i>
                </button>
                <button title="Chỉnh sửa" class="btn-edit-lp text-gray-500 hover:text-green-500 p-2 rounded-md hover:bg-gray-100">
                    <i class="fas fa-edit"></i>
                </button>
                <button title="Xóa" class="btn-delete-lp text-gray-500 hover:text-red-500 p-2 rounded-md hover:bg-gray-100">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Thêm nội dung (bên trái)
        let content = `<h3 class="text-lg font-semibold text-blue-600">${item.TenTruong}</h3>`;
        content += `<p class="text-sm text-gray-500 mb-2">${item.ThoiGian}</p>`;
        
        if (item.CapHoc === 'Cấp 3') {
            // === BẮT ĐẦU SỬA ĐỔI: Thêm điểm TB 10, 11, 12 ===
            content += `<p class="text-sm"><strong>Học lực:</strong> ${item.HocLuc || 'N/A'} - <strong>Hạnh kiểm:</strong> ${item.HanhKiem || 'N/A'}</p>`;
            // Thêm một dòng mới để hiển thị điểm
            content += `
                <div class="text-sm mt-2 pt-2 border-t border-gray-100">
                    <span class="mr-4"><strong>ĐTB Lớp 10:</strong> <span class="font-medium text-gray-700">${item.DiemTB_10 || 'N/A'}</span></span>
                    <span class="mr-4"><strong>ĐTB Lớp 11:</strong> <span class="font-medium text-gray-700">${item.DiemTB_11 || 'N/A'}</span></span>
                    <span><strong>ĐTB Lớp 12:</strong> <span class="font-medium text-gray-700">${item.DiemTB_12 || 'N/A'}</span></span>
                </div>
            `;
            // === KẾT THÚC SỬA ĐỔI ===
        } else {
            content += `<p class="text-sm"><strong>Ngành:</strong> ${item.NganhHoc || 'N/A'} - <strong>Hệ:</strong> ${item.HeDaoTao || 'N/A'}</p>`;
            content += `<p class="text-sm"><strong>GPA:</strong> ${item.GPA || 'N/A'} - <strong>Tốt nghiệp:</strong> ${item.LoaiTotNghiep || 'N/A'}</p>`;
        }
        itemCard.innerHTML += content;

        // Gán sự kiện cho các nút
        itemCard.querySelector('.btn-view-details').addEventListener('click', () => openViewDetailsModal(item));
        itemCard.querySelector('.btn-edit-lp').addEventListener('click', () => openLearningProcessModal(item.CapHoc, item));
        itemCard.querySelector('.btn-delete-lp').addEventListener('click', () => deleteLearningProcess(item.ID_HocTap));

        container.appendChild(itemCard);
    });
}

// Hàm render Chứng chỉ
function renderCertificateList(containerId, itemList) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Xóa list cũ

    if (itemList.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic">Không có dữ liệu.</p>';
        return;
    }

    itemList.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'border border-gray-200 rounded-lg p-4 relative';
        
        // Thêm nút (bên phải)
        itemCard.innerHTML += `
            <div class="absolute top-4 right-4 flex space-x-2">
                <button title="Xem chi tiết" class="btn-view-details text-gray-500 hover:text-blue-500 p-2 rounded-md hover:bg-gray-100">
                    <i class="fas fa-eye"></i>
                </button>
                <button title="Chỉnh sửa" class="btn-edit-cc text-gray-500 hover:text-green-500 p-2 rounded-md hover:bg-gray-100">
                    <i class="fas fa-edit"></i>
                </button>
                <button title="Xóa" class="btn-delete-cc text-gray-500 hover:text-red-500 p-2 rounded-md hover:bg-gray-100">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Thêm nội dung (bên trái)
        let content = `<h3 class="text-lg font-semibold text-blue-600">${item.TenChungChi}</h3>`;
        content += `<p class="text-sm text-gray-500 mb-2"><strong>Loại:</strong> ${item.LoaiVanBang}</p>`;
        content += `<p class="text-sm"><strong>Đơn vị cấp:</strong> ${item.DonViCap}</p>`;
        content += `<p class="text-sm"><strong>Ngày cấp:</strong> ${formatDate(item.NgayCap)}</p>`;
        itemCard.innerHTML += content;

        // Gán sự kiện cho các nút
        itemCard.querySelector('.btn-view-details').addEventListener('click', () => openViewDetailsModal(item));
        itemCard.querySelector('.btn-edit-cc').addEventListener('click', () => openCertificateModal(item));
        itemCard.querySelector('.btn-delete-cc').addEventListener('click', () => deleteCertificate(item.ID_ChungChi));

        container.appendChild(itemCard);
    });
}


// =========================================
// XỬ LÝ LƯU CẤP 1, CẤP 2
// =========================================

function openLevel1Modal() {
    document.getElementById('truongCap1').value = currentEducationProfile.TruongCap1 || '';
    document.getElementById('thoiGianCap1').value = currentEducationProfile.ThoiGianCap1 || '';
    document.getElementById('level1Modal').classList.remove('hidden');
}

function openLevel2Modal() {
    document.getElementById('truongCap2').value = currentEducationProfile.TruongCap2 || '';
    document.getElementById('thoiGianCap2').value = currentEducationProfile.ThoiGianCap2 || '';
    document.getElementById('level2Modal').classList.remove('hidden');
}

async function saveLevel1(e) {
    e.preventDefault();
    showLoading();
    const data = {
        id_gd: currentEducationProfile.ID_GD,
        truongCap1: document.getElementById('truongCap1').value,
        thoiGianCap1: document.getElementById('thoiGianCap1').value,
    };

    try {
        const res = await fetchWithToken('/api/education/level1', 'PUT', data);
        showToast(res.message, true);
        document.getElementById('level1Modal').classList.add('hidden');
        await loadEducationData(); // Tải lại
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

async function saveLevel2(e) {
    e.preventDefault();
    showLoading();
    const data = {
        id_gd: currentEducationProfile.ID_GD,
        truongCap2: document.getElementById('truongCap2').value,
        thoiGianCap2: document.getElementById('thoiGianCap2').value,
    };

    try {
        const res = await fetchWithToken('/api/education/level2', 'PUT', data);
        showToast(res.message, true);
        document.getElementById('level2Modal').classList.add('hidden');
        await loadEducationData(); // Tải lại
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

// =========================================
// XỬ LÝ CRUD QUÁ TRÌNH HỌC TẬP (C3, ĐH)
// =========================================

function openLearningProcessModal(capHoc, item = null) {
    const form = document.getElementById('learningProcessForm');
    form.reset(); // Xóa form
    
    // Ẩn/hiện các trường C3, ĐH
    document.getElementById('lp_fields_cap3').classList.toggle('hidden', capHoc !== 'Cấp 3');
    document.getElementById('lp_fields_daihoc').classList.toggle('hidden', capHoc === 'Cấp 3');

    document.getElementById('learningProcessCapHoc').value = capHoc;

    if (item) {
        // CHẾ ĐỘ SỬA
        document.getElementById('learningProcessModalTitle').textContent = `Chỉnh sửa: ${item.TenTruong}`;
        document.getElementById('learningProcessId').value = item.ID_HocTap;
        
        document.getElementById('lp_tenTruong').value = item.TenTruong || '';
        document.getElementById('lp_thoiGian').value = item.ThoiGian || '';
        
        if (capHoc === 'Cấp 3') {
            document.getElementById('lp_diem10').value = item.DiemTB_10 || '';
            document.getElementById('lp_diem11').value = item.DiemTB_11 || '';
            document.getElementById('lp_diem12').value = item.DiemTB_12 || '';
            document.getElementById('lp_hanhKiem').value = item.HanhKiem || '';
            document.getElementById('lp_hocLuc').value = item.HocLuc || '';
        } else {
            document.getElementById('lp_nganhHoc').value = item.NganhHoc || '';
            document.getElementById('lp_heDaoTao').value = item.HeDaoTao || '';
            document.getElementById('lp_gpa').value = item.GPA || '';
            document.getElementById('lp_loaiTotNghiep').value = item.LoaiTotNghiep || '';
        }
    } else {
        // CHẾ ĐỘ THÊM MỚI
        document.getElementById('learningProcessModalTitle').textContent = `Thêm mới ${capHoc}`;
        document.getElementById('learningProcessId').value = '';
    }

    document.getElementById('learningProcessModal').classList.remove('hidden');
}

async function saveLearningProcess(e) {
    e.preventDefault();
    showLoading();

    const id = document.getElementById('learningProcessId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/education/learning-process/${id}` : '/api/education/learning-process';
    const capHoc = document.getElementById('learningProcessCapHoc').value;

    const formData = new FormData();
    formData.append('id_gd', currentEducationProfile.ID_GD); // Lấy từ biến global
    formData.append('capHoc', capHoc);
    formData.append('tenTruong', document.getElementById('lp_tenTruong').value);
    formData.append('thoiGian', document.getElementById('lp_thoiGian').value);

    if (capHoc === 'Cấp 3') {
        formData.append('diem10', document.getElementById('lp_diem10').value);
        formData.append('diem11', document.getElementById('lp_diem11').value);
        formData.append('diem12', document.getElementById('lp_diem12').value);
        formData.append('hanhKiem', document.getElementById('lp_hanhKiem').value);
        formData.append('hocLuc', document.getElementById('lp_hocLuc').value);
        if (document.getElementById('lp_fileHocBa10').files[0]) formData.append('fileHocBa10', document.getElementById('lp_fileHocBa10').files[0]);
        if (document.getElementById('lp_fileHocBa11').files[0]) formData.append('fileHocBa11', document.getElementById('lp_fileHocBa11').files[0]);
        if (document.getElementById('lp_fileHocBa12').files[0]) formData.append('fileHocBa12', document.getElementById('lp_fileHocBa12').files[0]);
    } else {
        formData.append('nganhHoc', document.getElementById('lp_nganhHoc').value);
        formData.append('heDaoTao', document.getElementById('lp_heDaoTao').value);
        formData.append('gpa', document.getElementById('lp_gpa').value);
        formData.append('loaiTotNghiep', document.getElementById('lp_loaiTotNghiep').value);
        if (document.getElementById('lp_fileBangDiem').files[0]) formData.append('fileBangDiem', document.getElementById('lp_fileBangDiem').files[0]);
    }

    try {
        const res = await fetchWithToken(url, method, formData, true); // isFormData = true
        showToast(res.message, true);
        document.getElementById('learningProcessModal').classList.add('hidden');
        await loadEducationData(); // Tải lại
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

async function deleteLearningProcess(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa mục này?')) return;
    showLoading();
    try {
        const res = await fetchWithToken(`/api/education/learning-process/${id}`, 'DELETE');
        showToast(res.message, true);
        await loadEducationData(); // Tải lại
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

// =========================================
// XỬ LÝ CRUD CHỨNG CHỈ
// =========================================

function openCertificateModal(item = null) {
    const form = document.getElementById('certificateForm');
    form.reset();

    if (item) {
        // SỬA
        document.getElementById('certificateModalTitle').textContent = `Chỉnh sửa: ${item.TenChungChi}`;
        document.getElementById('certificateId').value = item.ID_ChungChi;
        document.getElementById('cc_ten').value = item.TenChungChi || '';
        document.getElementById('cc_donViCap').value = item.DonViCap || '';
        document.getElementById('cc_loai').value = item.LoaiVanBang || '';
        document.getElementById('cc_ngayCap').value = formatDate(item.NgayCap, 'YYYY-MM-DD');
        document.getElementById('cc_ngayHetHan').value = formatDate(item.NgayHetHan, 'YYYY-MM-DD');
    } else {
        // THÊM
        document.getElementById('certificateModalTitle').textContent = 'Thêm mới Văn bằng/Chứng chỉ';
        document.getElementById('certificateId').value = '';
    }
    
    document.getElementById('certificateModal').classList.remove('hidden');
}

async function saveCertificate(e) {
    e.preventDefault();
    showLoading();
    
    const id = document.getElementById('certificateId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/education/certificate/${id}` : '/api/education/certificate';

    const formData = new FormData();
    formData.append('id_gd', currentEducationProfile.ID_GD); // Lấy từ biến global
    formData.append('tenChungChi', document.getElementById('cc_ten').value);
    formData.append('donViCap', document.getElementById('cc_donViCap').value);
    formData.append('loaiVanBang', document.getElementById('cc_loai').value);
    formData.append('ngayCap', document.getElementById('cc_ngayCap').value);
    formData.append('ngayHetHan', document.getElementById('cc_ngayHetHan').value);
    
    if (document.getElementById('cc_file').files[0]) {
        formData.append('fileChungChi', document.getElementById('cc_file').files[0]);
    }

    try {
        const res = await fetchWithToken(url, method, formData, true); // isFormData = true
        showToast(res.message, true);
        document.getElementById('certificateModal').classList.add('hidden');
        await loadEducationData(); // Tải lại
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

async function deleteCertificate(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa chứng chỉ này?')) return;
    showLoading();
    try {
        const res = await fetchWithToken(`/api/education/certificate/${id}`, 'DELETE');
        showToast(res.message, true);
        await loadEducationData(); // Tải lại
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

// =========================================
// (MỚI) MODAL XEM CHI TIẾT
// =========================================

function openViewDetailsModal(item) {
    const modalContent = document.getElementById('viewDetailsModalContent');
    modalContent.innerHTML = ''; // Xóa nội dung cũ
    
    let filesToShow = [];
    
    if (item.CapHoc) { // Đây là Quá trình học tập
        document.getElementById('viewDetailsModalTitle').textContent = `Chi tiết: ${item.TenTruong}`;
        if (item.CapHoc === 'Cấp 3') {
            filesToShow = [
                { name: 'Học bạ Lớp 10', path: item.FileHocBa10 },
                { name: 'Học bạ Lớp 11', path: item.FileHocBa11 },
                { name: 'Học bạ Lớp 12', path: item.FileHocBa12 }
            ];
        } else {
             filesToShow = [
                { name: 'Bảng điểm / Bằng Tốt nghiệp', path: item.FileBangDiem }
            ];
        }
    } else { // Đây là Chứng chỉ
        document.getElementById('viewDetailsModalTitle').textContent = `Chi tiết: ${item.TenChungChi}`;
        filesToShow = [
            { name: 'File đính kèm', path: item.FilePath }
        ];
    }
    
    filesToShow = filesToShow.filter(f => f.path); // Lọc ra những file có đường dẫn

    if (filesToShow.length === 0) {
        modalContent.innerHTML = '<p class="text-gray-600">Không có file hình ảnh hoặc tài liệu nào được đính kèm.</p>';
    } else {
        filesToShow.forEach(file => {
            const fileUrl = `${API_URL}/${file.path}`;
            const fileContainer = document.createElement('div');
            fileContainer.className = 'mb-4 border rounded p-2';
            fileContainer.innerHTML = `<h4 class="font-semibold">${file.name}</h4>`;
            
            // Giả sử file là ảnh
            // (Trong thực tế, cần kiểm tra đuôi file để quyết định chèn <img>, <embed> cho PDF, hay chỉ là <a>)
            const filePreview = document.createElement('img');
            filePreview.src = fileUrl;
            filePreview.className = 'max-w-full h-auto rounded mt-2 border';
            filePreview.onerror = () => {
                filePreview.style.display = 'none';
                fileContainer.innerHTML += `<p class="text-red-500">Không thể tải ảnh. <a href="${fileUrl}" target="_blank" class="text-blue-500 underline">Mở trong tab mới</a></p>`;
            };
            
            fileContainer.appendChild(filePreview);
            modalContent.appendChild(fileContainer);
        });
    }
    
    document.getElementById('viewDetailsModal').classList.remove('hidden');
}

// =========================================
// CÁC HÀM TIỆN ÍCH (HELPER)
// =========================================

function showLoading() { document.getElementById('loading').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading').classList.add('hidden'); }

function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toastMessage.textContent = message;
    toast.className = 'fixed top-5 right-5 text-white py-2 px-4 rounded-lg shadow-md z-50'; // Reset
    toast.classList.add(isSuccess ? 'bg-green-500' : 'bg-red-500');
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Hàm fetch API (có chèn token)
async function fetchWithToken(url, method = 'GET', body = null, isFormData = false) {
    // === SỬA LỖI: Tìm 'userToken' thay vì 'token' ===
    const token = localStorage.getItem('userToken');
    // === KẾT THÚC SỬA LỖI ===
    
    const headers = {
        'Authorization': `Bearer ${token}`
    };

    const config = {
        method: method,
        headers: headers
    };

    if (body) {
        if (isFormData) {
            // Không set Content-Type, trình duyệt tự set (để bao gồm boundary)
            config.body = body;
        } else {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(body);
        }
    }

    const res = await fetch(`${API_URL}${url}`, config);
    
    // === SỬA LỖI: KIỂM TRA res.ok TRƯỚC KHI ĐỌC JSON ===

    if (!res.ok) {
        // Nếu server trả về lỗi (401, 403, 500...)
        
        // Cố gắng đọc lỗi dưới dạng JSON trước (vì server CÓ THỂ trả về JSON lỗi)
        let errorData;
        try {
            errorData = await res.json();
        } catch (e) {
            // Nếu không đọc được JSON (ví dụ server crash trả về HTML)
            errorData = { message: "Lỗi không xác định từ máy chủ." };
        }

        // === BẮT ĐẦU SỬA ĐỔI ===
        // Kiểm tra xem có phải lỗi 401 (Unauthorized) hoặc 403 (Forbidden) không
        if (res.status === 401 || res.status === 403) {
            
            // === SỬA LỖI: Xóa 'userToken' thay vì 'token' ===
            localStorage.removeItem('userToken');
            // === KẾT THÚC SỬA LỖI ===

            // Thông báo cho người dùng
            alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            // Tự động chuyển về trang đăng nhập
            window.location.href = 'login.html';
            throw new Error('Phiên đăng nhập đã hết hạn.'); // Dừng hàm
        }
        // === KẾT THÚC SỬA ĐỔI ===
        
        // Nếu là lỗi khác (ví dụ 500), ném ra message từ JSON
        throw new Error(errorData.message || 'Đã xảy ra lỗi máy chủ');
    }

    // Nếu res.ok (mã 200), lúc này chúng ta mới an toàn đọc JSON
    // Cần kiểm tra nếu body rỗng
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    
    return data;
}

// Hàm định dạng ngày
function formatDate(dateString, format = 'DD/MM/YYYY') {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (format === 'YYYY-MM-DD') {
        return date.toISOString().split('T')[0];
    }
    // Default 'DD/MM/YYYY'
    return date.toLocaleDateString('vi-VN');
}