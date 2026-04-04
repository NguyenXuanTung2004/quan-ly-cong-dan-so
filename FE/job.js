// frontend/job.js - Module Quản lý Việc làm

const API_URL = 'http://localhost:3000';
let currentJobHistoryList = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Kiểm tra đăng nhập
    if (!localStorage.getItem('userToken')) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Tải dữ liệu ban đầu
    loadJobStatus();
    loadJobHistory();
    loadJobList(); // Tải danh sách việc làm gợi ý

    // 3. Gán sự kiện (Event Listeners)
    
    // -- Trạng thái & BHTN --
    const updateStatusBtn = document.getElementById('update-status-btn');
    if (updateStatusBtn) updateStatusBtn.addEventListener('click', openStatusModal);
    
    const registerInsuranceBtn = document.getElementById('register-insurance-btn');
    if (registerInsuranceBtn) registerInsuranceBtn.addEventListener('click', openInsuranceModal);
    
    const statusForm = document.getElementById('statusForm');
    if (statusForm) statusForm.addEventListener('submit', saveStatus);
    
    const insuranceForm = document.getElementById('insuranceForm');
    if (insuranceForm) insuranceForm.addEventListener('submit', saveInsurance);

    // -- Lịch sử làm việc --
    const addJobHistoryBtn = document.getElementById('add-job-history-btn');
    if (addJobHistoryBtn) addJobHistoryBtn.addEventListener('click', () => openJobHistoryModal());
    
    const jobHistoryForm = document.getElementById('jobHistoryForm');
    if (jobHistoryForm) jobHistoryForm.addEventListener('submit', saveJobHistory);

    // -- Tìm kiếm việc làm --
    const searchInput = document.getElementById('job-search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') searchJobs(searchInput.value);
        });
    }
    
    // -- (MỚI) Form Ứng tuyển (Upload CV) --
    const applyForm = document.getElementById('applyForm');
    if (applyForm) applyForm.addEventListener('submit', submitApplication);
});

// ===================================================
// 1. QUẢN LÝ TRẠNG THÁI & BẢO HIỂM THẤT NGHIỆP
// ===================================================

async function loadJobStatus() {
    try {
        const res = await fetchWithToken('/api/jobs/status', 'GET');
        const status = res.status; // 1: Đang làm, 0: Thất nghiệp
        
        renderStatus(status);
    } catch (error) {
        console.error(error);
    }
}

function renderStatus(status) {
    const badge = document.getElementById('current-status-badge');
    const unemploymentActions = document.getElementById('unemployment-actions');
    
    if (!badge) return;

    // Reset classes
    badge.className = 'status-badge';
    
    if (status === 1) {
        badge.textContent = 'Đang làm việc';
        badge.classList.add('status-working'); // Xanh lá
        if (unemploymentActions) unemploymentActions.classList.add('hidden'); // Ẩn nút BHTN
    } else {
        badge.textContent = 'Đang thất nghiệp';
        badge.classList.add('status-unemployed'); // Đỏ
        if (unemploymentActions) unemploymentActions.classList.remove('hidden'); // Hiện nút BHTN
    }

    // Cập nhật radio button trong modal cho đúng với hiện tại
    const radios = document.getElementsByName('jobStatus');
    for(const radio of radios) {
        if (parseInt(radio.value) === status) radio.checked = true;
    }
}

function openStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) modal.classList.remove('hidden');
}

async function saveStatus(e) {
    e.preventDefault();
    showLoading();
    
    // Lấy giá trị radio đã chọn
    const radios = document.getElementsByName('jobStatus');
    let selectedValue = 1;
    for (const radio of radios) {
        if (radio.checked) {
            selectedValue = parseInt(radio.value);
            break;
        }
    }

    try {
        await fetchWithToken('/api/jobs/status', 'PUT', { status: selectedValue });
        showToast('Cập nhật trạng thái thành công!', true);
        
        const modal = document.getElementById('statusModal');
        if (modal) modal.classList.add('hidden');
        
        renderStatus(selectedValue); // Cập nhật UI ngay lập tức
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

// --- Bảo hiểm thất nghiệp ---

function openInsuranceModal() {
    const form = document.getElementById('insuranceForm');
    if (form) form.reset();
    
    const modal = document.getElementById('insuranceModal');
    if (modal) modal.classList.remove('hidden');
}

async function saveInsurance(e) {
    e.preventDefault();
    showLoading();

    const data = {
        soThangDong: document.getElementById('bhtn_months').value,
        lyDo: document.getElementById('bhtn_reason').value,
        noiNhan: document.getElementById('bhtn_place').value
    };

    try {
        const res = await fetchWithToken('/api/jobs/insurance', 'POST', data);
        showToast(res.message, true);
        
        const modal = document.getElementById('insuranceModal');
        if (modal) modal.classList.add('hidden');
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

// ===================================================
// 2. QUẢN LÝ LỊCH SỬ LÀM VIỆC (CRUD)
// ===================================================

async function loadJobHistory() {
    try {
        const list = await fetchWithToken('/api/jobs/history', 'GET');
        currentJobHistoryList = list;
        renderJobHistory(list);
    } catch (error) {
        console.error(error);
    }
}

function renderJobHistory(list) {
    const container = document.getElementById('job-history-list');
    if (!container) return;
    
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic text-center">Chưa có kinh nghiệm làm việc nào.</p>';
        return;
    }

    list.forEach(item => {
        const div = document.createElement('div');
        div.className = 'job-card p-4 relative group';
        
        // Tính thời gian làm việc
        const startDate = formatDate(item.NgayBD);
        const endDate = item.NgayKT ? formatDate(item.NgayKT) : 'Hiện tại';
        
        div.innerHTML = `
            <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button class="text-blue-600 hover:bg-blue-50 p-2 rounded-md mr-1 btn-edit-job">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="text-red-600 hover:bg-red-50 p-2 rounded-md btn-delete-job">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <h3 class="font-bold text-lg text-gray-800">${item.TenCV}</h3>
            <div class="text-gray-600 font-medium mb-2">${item.NoiLamViec}</div>
            <div class="flex items-center text-sm text-gray-500 gap-4">
                <span><i class="far fa-calendar-alt mr-1"></i> ${startDate} - ${endDate}</span>
                <span class="bg-gray-100 px-2 py-1 rounded text-xs">${item.LoaiCV || 'Full-time'}</span>
            </div>
        `;

        // Gán sự kiện
        const editBtn = div.querySelector('.btn-edit-job');
        if (editBtn) editBtn.addEventListener('click', () => openJobHistoryModal(item));
        
        const deleteBtn = div.querySelector('.btn-delete-job');
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteJobHistory(item.ID_ViecLam));

        container.appendChild(div);
    });
}

function openJobHistoryModal(item = null) {
    const form = document.getElementById('jobHistoryForm');
    if (form) form.reset();
    
    // Reset trạng thái checkbox và input ngày kết thúc
    const endDateInput = document.getElementById('job_end_date');
    const currentCheckbox = document.getElementById('job_current');
    if (endDateInput) {
        endDateInput.disabled = false;
        endDateInput.classList.remove('bg-gray-100');
    }

    if (item) {
        // Chế độ Sửa
        const modalTitle = document.getElementById('jobHistoryModalTitle');
        if (modalTitle) modalTitle.textContent = 'Chỉnh sửa kinh nghiệm';
        
        document.getElementById('job_id').value = item.ID_ViecLam;
        document.getElementById('job_title').value = item.TenCV;
        document.getElementById('job_company').value = item.NoiLamViec;
        document.getElementById('job_type').value = item.LoaiCV || 'Toàn thời gian';
        document.getElementById('job_start_date').value = formatDateForInput(item.NgayBD);
        
        if (item.NgayKT) {
            if (endDateInput) document.getElementById('job_end_date').value = formatDateForInput(item.NgayKT);
            if (currentCheckbox) currentCheckbox.checked = false;
        } else {
            if (currentCheckbox) currentCheckbox.checked = true;
            if (endDateInput) {
                endDateInput.disabled = true;
                endDateInput.classList.add('bg-gray-100');
            }
        }
    } else {
        // Chế độ Thêm mới
        const modalTitle = document.getElementById('jobHistoryModalTitle');
        if (modalTitle) modalTitle.textContent = 'Thêm kinh nghiệm';
        document.getElementById('job_id').value = '';
    }

    const modal = document.getElementById('jobHistoryModal');
    if (modal) modal.classList.remove('hidden');
}

async function saveJobHistory(e) {
    e.preventDefault();
    showLoading();

    const id = document.getElementById('job_id').value;
    const isCurrent = document.getElementById('job_current').checked;
    
    const data = {
        tenCV: document.getElementById('job_title').value,
        loaiCV: document.getElementById('job_type').value,
        noiLamViec: document.getElementById('job_company').value,
        ngayBD: document.getElementById('job_start_date').value,
        ngayKT: isCurrent ? null : document.getElementById('job_end_date').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/jobs/history/${id}` : '/api/jobs/history';

    try {
        await fetchWithToken(url, method, data);
        showToast(id ? 'Cập nhật thành công!' : 'Thêm mới thành công!', true);
        
        const modal = document.getElementById('jobHistoryModal');
        if (modal) modal.classList.add('hidden');
        
        loadJobHistory(); 
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

async function deleteJobHistory(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa kinh nghiệm này?')) return;
    showLoading();
    try {
        await fetchWithToken(`/api/jobs/history/${id}`, 'DELETE');
        showToast('Đã xóa thành công!', true);
        loadJobHistory();
    } catch (error) {
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

// ===================================================
// 3. TÌM KIẾM VIỆC LÀM & ỨNG TUYỂN (CÓ UPLOAD CV)
// ===================================================

async function loadJobList() {
    searchJobs(''); // Tải tất cả lúc đầu
}

async function searchJobs(keyword) {
    const container = document.getElementById('job-search-results');
    if (!container) return;
    
    container.innerHTML = '<div class="animate-pulse h-10 bg-gray-200 rounded"></div>'; // Loading skeleton

    try {
        const list = await fetchWithToken(`/api/jobs/search?q=${encodeURIComponent(keyword)}`, 'GET');
        renderJobList(list);
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="text-red-500 text-sm">Lỗi khi tải việc làm.</p>';
    }
}

function renderJobList(list) {
    const container = document.getElementById('job-search-results');
    if (!container) return;
    
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Không tìm thấy việc làm phù hợp.</p>';
        return;
    }

    list.forEach(job => {
        const div = document.createElement('div');
        div.className = 'bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors';
        
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">${job.TieuDe}</h4>
                    <p class="text-blue-600 font-medium">${job.TenCongTy}</p>
                </div>
                <span class="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">
                    ${job.MucLuong}
                </span>
            </div>
            <div class="mt-3 flex items-center text-sm text-gray-500 gap-4">
                <span><i class="fas fa-map-marker-alt mr-1"></i> ${job.DiaDiem}</span>
                <span><i class="fas fa-briefcase mr-1"></i> ${job.NganhNghe}</span>
                <span><i class="far fa-clock mr-1"></i> Hạn: ${formatDate(job.HanNopHoSo)}</span>
            </div>
            
            <!-- (MỚI) Nút "Ứng tuyển ngay" gọi hàm mở Modal -->
            <button class="mt-4 w-full btn btn-outline text-sm py-1.5 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors btn-apply" 
                onclick="openApplyModal(${job.ID_Tin}, '${job.TieuDe}')">
                Ứng tuyển ngay
            </button>
        `;

        container.appendChild(div);
    });
}

// === (MỚI) CÁC HÀM XỬ LÝ ỨNG TUYỂN CÓ FILE CV ===

// 1. Mở modal khi nhấn nút "Ứng tuyển ngay"
// Hàm này phải là GLOBAL (window.xxx) để gọi được từ trong chuỗi HTML ở trên
window.openApplyModal = function(idTin, tieuDe) {
    const modal = document.getElementById('applyModal');
    if(!modal) return;

    // Reset form
    const form = document.getElementById('applyForm');
    if(form) form.reset();

    // Gán ID tin tuyển dụng vào input hidden
    document.getElementById('apply_job_id').value = idTin;
    
    // Hiển thị tên công việc lên modal cho người dùng biết
    const titleEl = document.getElementById('apply_job_title');
    if(titleEl) titleEl.textContent = tieuDe;

    // Hiện modal
    modal.classList.remove('hidden');
}

// 2. Xử lý khi nhấn nút "Nộp đơn" trong Modal
async function submitApplication(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('apply_cv_file');
    // Kiểm tra xem người dùng đã chọn file chưa
    if (fileInput.files.length === 0) {
        showToast('Vui lòng chọn file CV để tải lên!', false);
        return;
    }

    showLoading();
    
    // Dùng FormData để gửi file + dữ liệu text
    const formData = new FormData();
    // QUAN TRỌNG: Append các trường text TRƯỚC trường file để Multer xử lý tốt hơn
    const idTin = document.getElementById('apply_job_id').value;
    formData.append('id_tin', idTin); 
    formData.append('fileCV', fileInput.files[0]); // Key 'fileCV' phải khớp với backend

    console.log("Submitting application for Job ID:", idTin); // Debug log

    try {
        // Gọi API với isFormData = true
        const res = await fetchWithToken('/api/jobs/apply', 'POST', formData, true);
        
        showToast(res.message, true);
        document.getElementById('applyModal').classList.add('hidden');
    } catch (error) {
        console.error("Lỗi submit:", error);
        showToast(error.message, false);
    } finally {
        hideLoading();
    }
}

// ===================================================
// HELPER FUNCTIONS
// ===================================================

function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.remove('hidden');
}
function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('hidden');
}

// Hàm showToast an toàn (đã sửa lỗi null)
function showToast(message, isSuccess = true) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastMessage) {
        console.error("Lỗi: Không tìm thấy phần tử thông báo (toast) trong HTML.");
        alert(message); 
        return;
    }
    
    const toastContent = toast.firstElementChild;
    const iconDiv = toastContent ? toastContent.firstElementChild : null; 
    
    toastMessage.textContent = message;
    
    if (toastContent) {
        if (isSuccess) {
            toastContent.className = 'bg-white border-l-4 border-green-500 shadow-lg rounded-lg p-4 flex items-center';
            if (iconDiv) {
                iconDiv.className = 'text-green-500 mr-3';
                iconDiv.innerHTML = '<i class="fas fa-check-circle text-xl"></i>';
            }
        } else {
            toastContent.className = 'bg-white border-l-4 border-red-500 shadow-lg rounded-lg p-4 flex items-center';
            if (iconDiv) {
                iconDiv.className = 'text-red-500 mr-3';
                iconDiv.innerHTML = '<i class="fas fa-exclamation-circle text-xl"></i>';
            }
        }
    }
    
    toast.classList.remove('hidden');
    
    toast.style.opacity = '0';
    setTimeout(() => toast.style.opacity = '1', 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// Hàm fetch API (Cập nhật để hỗ trợ FormData)
async function fetchWithToken(url, method = 'GET', body = null, isFormData = false) {
    const token = localStorage.getItem('userToken');
    const headers = {
        'Authorization': `Bearer ${token}`
    };

    const config = { method, headers };
    
    if (body) {
        if (isFormData) {
            // QUAN TRỌNG: Khi gửi FormData, KHÔNG được set Content-Type thủ công.
            // Trình duyệt sẽ tự động set Content-Type là multipart/form-data kèm theo boundary.
            config.body = body;
        } else {
            headers['Content-Type'] = 'application/json';
            config.body = JSON.stringify(body);
        }
    }

    const res = await fetch(`${API_URL}${url}`, config);
    
    if (!res.ok) {
        let errorData;
        try { errorData = await res.json(); } catch (e) { errorData = { message: "Lỗi server." }; }
        
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('userToken');
            window.location.href = 'login.html';
            throw new Error('Phiên đăng nhập hết hạn.');
        }
        throw new Error(errorData.message || 'Có lỗi xảy ra.');
    }

    return await res.json();
}

// Format ngày hiển thị (DD/MM/YYYY)
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

// Format ngày cho input (YYYY-MM-DD)
function formatDateForInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}