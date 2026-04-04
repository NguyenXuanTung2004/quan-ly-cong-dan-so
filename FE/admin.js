// =========================================
// --- CẤU HÌNH CHUNG & BIẾN TOÀN CỤC ---
// =========================================
const API_URL = 'http://localhost:3000'; 

// Biến cho Định danh
let currentList = [];         
let currentSelectedId = null; 

// Biến cho Giáo dục
let currentAdminEditingGD_ID = null;
let currentAdminEducationProfile = {}; 

// Biến cho Y tế
let currentAdminEditingYTe_ID = null;
let currentAdminHealthProfile = {};

// Biến cho Việc làm
let currentAdminJobPosts = [];

// Biến cho Dịch vụ công
let currentPublicServiceList = [];
let currentSelectedPSID = null;

// --- SỰ KIỆN KHỞI TẠO (CHẠY KHI WEB TẢI XONG) ---
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    setupNavigation();
    
    // 1. Module Định danh (Mặc định tải đầu tiên)
    loadIdentityData(); 
    setupModalIdentity(); 
    setupIdentitySearch(); 
    
    // 2. Module Giáo dục
    loadEducationStats(); 
    setupEducationSearch();
    setupAdminEducationModals();

    // 3. Module Y tế
    loadHealthStats();
    setupHealthSearch();
    setupAdminHealthModals();
    
    // 4. Module Việc làm
    loadJobStats();      
    setupJobSearch();    
    loadJobPosts();      
    setupJobModals();
    loadDashboardStats();
    // 5. Module Dịch vụ công (MỚI)
    initPublicServiceModule(); 
    initSystemModule();
});

// =========================================
// --- 1. HỆ THỐNG (AUTH & NAV) ---
// =========================================
function checkAdminAuth() {
    const token = localStorage.getItem('userToken'); 
    const userInfo = localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null;
    
    // Kiểm tra role Admin (đảm bảo cả 2 trường hợp tên biến)
    const userRole = userInfo?.role || userInfo?.VaiTro;

    if (!token || !userInfo || userRole !== 'Admin') {
        alert('Bạn không có quyền truy cập trang này!');
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('admin-name').textContent = userInfo.HoTen || userInfo.id_cd || 'Admin';

    const btnLogout = document.getElementById('adminLogoutBtn');
    if(btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
                localStorage.clear();
                window.location.href = 'login.html';
            }
        });
    }
}

function setupNavigation() {
    const menuLinks = document.querySelectorAll('.sidebar-menu li a:not(.disabled)');
    const sections = document.querySelectorAll('.admin-content section');
    const pageTitle = document.getElementById('admin-page-title'); 

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('.sidebar-menu li.active')?.classList.remove('active');
            sections.forEach(sec => sec.classList.remove('active-section'));

            link.parentElement.classList.add('active');
            const targetId = link.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if(targetSection) {
                targetSection.classList.add('active-section');
            }
            if(pageTitle) {
                pageTitle.textContent = link.textContent.trim().replace(/ \d+$/, ''); 
            }
        });
    });
}

// =========================================
// --- 2. MODULE ĐỊNH DANH ---
// =========================================
async function loadIdentityData() { 
    try {
        const [list, stats] = await Promise.all([
            fetchWithToken('/api/admin/identities/all', 'GET'), 
            fetchWithToken('/api/admin/identities/stats', 'GET') 
        ]);

        currentList = list; 
        renderIdentityTable(list); 
        
        // Cập nhật badge menu
        const pendingBadge = document.querySelector('.badge-pending');
        if(pendingBadge) pendingBadge.textContent = stats.pending || 0; 
        
        // Cập nhật thống kê Dashboard
        const dashboardStat = document.getElementById('stat-pending-count');
        if(dashboardStat) dashboardStat.textContent = stats.pending || 0; 

        // Cập nhật thẻ thống kê chi tiết
        updateStatCard('stat-approved-count', 'stat-approved-percent', stats.approved, stats.total);
        updateStatCard('stat-pending-identity-count', 'stat-pending-percent', stats.pending, stats.total);
        updateStatCard('stat-rejected-count', 'stat-rejected-percent', stats.rejected, stats.total);
        updateStatCard('stat-null-count', 'stat-null-percent', stats.nullStatus, stats.total);
        updateStatCard('stat-revoked-count', 'stat-revoked-percent', stats.revoked, stats.total);
        
    } catch (error) { console.error('Lỗi tải định danh:', error); }
}

function updateStatCard(idCount, idPercent, value, total) {
    const elCount = document.getElementById(idCount);
    const elPercent = document.getElementById(idPercent);
    if(elCount) elCount.textContent = value || 0;
    if(elPercent) {
        const percent = total === 0 ? 0 : (parseInt(value || 0) / total) * 100;
        elPercent.textContent = `(${percent.toFixed(1)}%)`;
    }
}

function getStatusBadge(status) {
    if (!status) return `<span class="status-badge status-none">Chưa định danh</span>`;
    const s = status.trim();
    if (s === 'Đã duyệt') return `<span class="status-badge status-approved">Đã duyệt</span>`;
    if (s === 'Chờ duyệt') return `<span class="status-badge status-pending">Chờ duyệt</span>`;
    if (s === 'Bị từ chối') return `<span class="status-badge status-rejected">Bị từ chối</span>`;
    if (s === 'Đã hủy') return `<span class="status-badge status-revoked">Đã hủy</span>`;
    return `<span class="status-badge status-none">${s}</span>`;
}

function renderIdentityTable(list) {
    const tbody = document.getElementById('identity-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Không tìm thấy hồ sơ.</td></tr>';
        return;
    }

    list.forEach((item) => {
        const originalIndex = currentList.findIndex(i => i.ID_CD === item.ID_CD);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.ID_CD}</td>
            <td><strong>${item.HoTen}</strong></td>
            <td>${item.CCCD || 'Chưa có'}</td>
            <td>${formatDate(item.NgaySinh)}</td>
            <td>${getStatusBadge(item.TrangThaiDinhDanh)}</td>
            <td><button class="btn-view" onclick="openDetailModal(${originalIndex})"><i class="fa-solid fa-eye"></i> Xem</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function setupModalIdentity() {
    const modal = document.getElementById('detailModal');
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.style.display = "none"; }

    const btnApprove = document.getElementById('btnApprove');
    const btnReject = document.getElementById('btnReject');
    const btnRevoke = document.getElementById('btnRevoke');
    const btnRestore = document.getElementById('btnRestoreApprove');

    if(btnApprove) btnApprove.onclick = () => updateIdentityStatus('Đã duyệt');
    if(btnReject) btnReject.onclick = () => updateIdentityStatus('Bị từ chối');
    if(btnRevoke) btnRevoke.onclick = () => updateIdentityStatus('Đã hủy');
    if(btnRestore) btnRestore.onclick = () => updateIdentityStatus('Đã duyệt');
}

window.openDetailModal = function(index) {
    const item = currentList[index];
    if (!item) return;
    currentSelectedId = item.ID_CD;
    const modal = document.getElementById('detailModal');

    document.getElementById('m-id').textContent = item.ID_CD;
    document.getElementById('m-hoten').textContent = item.HoTen;
    document.getElementById('m-cccd').textContent = item.CCCD || 'Chưa có';
    document.getElementById('m-ngaysinh').textContent = formatDate(item.NgaySinh);
    document.getElementById('m-gioitinh').textContent = item.GioiTinh || 'Chưa có';
    // --- THÊM CODE ĐIỀN DỮ LIỆU MỚI TẠI ĐÂY ---
    document.getElementById('m-sdt').textContent = item.SDT || 'Chưa cập nhật';
    document.getElementById('m-dantoc').textContent = item.DanToc || 'Chưa cập nhật';
    document.getElementById('m-tongiao').textContent = item.TonGiao || 'Chưa cập nhật';
    // -------------------------------------------
    document.getElementById('m-quequan').textContent = item.QueQuan || 'Chưa có';
    document.getElementById('m-thuongtru').textContent = item.DC || 'Chưa có';
    
    document.getElementById('m-img-truoc').src = item.AnhMatTruoc ? `${API_URL}/${item.AnhMatTruoc}` : '';
    document.getElementById('m-img-sau').src = item.AnhMatSau ? `${API_URL}/${item.AnhMatSau}` : '';
    
    const status = item.TrangThaiDinhDanh ? item.TrangThaiDinhDanh.trim() : null;
    ['btnApprove', 'btnReject', 'btnRevoke', 'btnRestoreApprove'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) btn.style.display = 'none';
    });
    
    if (status === 'Chờ duyệt') {
        document.getElementById('btnApprove').style.display = 'inline-block';
        document.getElementById('btnReject').style.display = 'inline-block';
    } else if (status === 'Đã duyệt') {
        document.getElementById('btnRevoke').style.display = 'inline-block';
    } else if (status === 'Bị từ chối' || status === 'Đã hủy') {
        document.getElementById('btnRestoreApprove').style.display = 'inline-block';
    }
    modal.style.display = "block";
}

async function updateIdentityStatus(status) {
    if (!currentSelectedId || !confirm(`Chuyển trạng thái thành "${status}"?`)) return;
    try {
        await fetchWithToken(`/api/admin/identities/${currentSelectedId}/status`, 'PUT', { status });
        alert('Thành công!');
        document.getElementById('detailModal').style.display = "none";
        loadIdentityData(); 
    } catch (e) { alert(e.message); }
}

function setupIdentitySearch() {
    const input = document.getElementById('identitySearchInput');
    const btn = document.getElementById('identitySearchButton');
    if(btn) btn.onclick = () => performIdentitySearch(input.value);
    if(input) input.onkeyup = (e) => { if (e.key === 'Enter') performIdentitySearch(input.value); };
}

function performIdentitySearch(term) {
    term = term.toLowerCase().trim();
    if (!term) { renderIdentityTable(currentList); return; }
    const filtered = currentList.filter(i => (i.HoTen||'').toLowerCase().includes(term) || (i.CCCD||'').includes(term));
    renderIdentityTable(filtered);
}

// =========================================
// --- 6. QUẢN LÝ GIÁO DỤC (ADMIN) ---
// =========================================

// === 6.0. Tải Thống kê Giáo dục ===
async function loadEducationStats() {
    try {
        const stats = await fetchWithToken('/api/admin/education/stats', 'GET');
        
        // Lấy số liệu
        const level3 = stats.level3 || 0;
        const university = stats.university || 0;
        const college = stats.college || 0;
        const certificates = stats.certificates || 0;
        
        const higherEdTotal = university + college; // Cộng 2 số liệu
        
        document.getElementById('stat-edu-level3').textContent = level3;
        document.getElementById('stat-edu-higher').textContent = higherEdTotal; // Hiển thị tổng
        document.getElementById('stat-edu-certs').textContent = certificates;
        
    } catch (error) {
        console.error('Lỗi tải thống kê giáo dục:', error);
        document.getElementById('stat-edu-level3').textContent = 'Lỗi';
        document.getElementById('stat-edu-higher').textContent = 'Lỗi';
        document.getElementById('stat-edu-certs').textContent = 'Lỗi';
    }
}

// 6.1. Gán sự kiện cho thanh tìm kiếm (Giáo dục)
function setupEducationSearch() {
    const searchInput = document.getElementById('eduSearchInput');
    const searchButton = document.getElementById('eduSearchButton');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            performEducationSearch(searchInput.value);
        });
    }
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                performEducationSearch(e.target.value);
            }
        });
    }
}

// 6.2. Gọi API tìm kiếm công dân
async function performEducationSearch(searchTerm) {
    const term = searchTerm.trim();
    if (!term) {
        alert('Vui lòng nhập Tên hoặc ID Công dân để tìm kiếm.');
        return;
    }
    
    const tbody = document.getElementById('edu-search-results-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Đang tìm kiếm...</td></tr>';
    
    try {
        const results = await fetchWithToken(`/api/admin/citizens/search?q=${term}`, 'GET');
        renderEducationSearchResults(results);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Lỗi: ${error.message}</td></tr>`;
    }
}

// 6.3. Hiển thị kết quả tìm kiếm công dân
function renderEducationSearchResults(list) {
    const tbody = document.getElementById('edu-search-results-body');
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Không tìm thấy công dân nào.</td></tr>';
        return;
    }
    
    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.ID_CD}</td>
            <td><strong>${item.HoTen}</strong></td>
            <td>${formatDate(item.NgaySinh) || 'Chưa có'}</td>
            <td>${item.Email || 'Chưa có'}</td>
            <td>
                <button class="btn-view" onclick="loadEducationDetails('${item.ID_CD}', '${item.HoTen}')">
                    <i class="fa-solid fa-graduation-cap"></i> Xem Hồ sơ GD
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 6.4. (CẬP NHẬT) Tải chi tiết hồ sơ giáo dục
async function loadEducationDetails(id_cd, hoTen) {
    const detailsContainer = document.getElementById('edu-details-container');
    const notFoundContainer = document.getElementById('edu-details-not-found');
    
    detailsContainer.style.display = 'none';
    notFoundContainer.style.display = 'none';
    document.getElementById('edu-citizen-name').textContent = hoTen;
    
    try {
        const profile = await fetchWithToken(`/api/admin/education/${id_cd}`, 'GET');
        
        currentAdminEditingGD_ID = profile.ID_GD;
        currentAdminEducationProfile = profile; 
        
        currentAdminEducationProfile.ID_CD = id_cd; 
        currentAdminEducationProfile.HoTen = hoTen;
        
        document.getElementById('admin-level-1-school').textContent = profile.TruongCap1 || 'N/A';
        document.getElementById('admin-level-1-years').textContent = profile.ThoiGianCap1 || 'N/A';
        document.getElementById('admin-level-2-school').textContent = profile.TruongCap2 || 'N/A';
        document.getElementById('admin-level-2-years').textContent = profile.ThoiGianCap2 || 'N/A';
        
        const quaTrinhHocTap = profile.quaTrinhHocTap || [];
        
        const level3List = quaTrinhHocTap.filter(item => item.CapHoc && item.CapHoc.trim() === 'Cấp 3');
        const universityList = quaTrinhHocTap.filter(item => item.CapHoc && item.CapHoc.trim() === 'Đại học');
        const collegeOtherList = quaTrinhHocTap.filter(item => 
            item.CapHoc && 
            item.CapHoc.trim() !== 'Cấp 3' && 
            item.CapHoc.trim() !== 'Đại học'
        ); 
        
        renderAdminEduList('admin-level-3-list', level3List);
        renderAdminEduList('admin-university-list', universityList); 
        renderAdminEduList('admin-college-other-list', collegeOtherList);
        
        renderAdminCertList('admin-certificate-list', profile.chungChiList || []);
        
        detailsContainer.style.display = 'block'; 
        
    } catch (error) {
        console.error(`Lỗi tải hồ sơ GD cho ${id_cd}:`, error);
        notFoundContainer.style.display = 'block'; 
    }
}

// 6.5. (CẬP NHẬT) Hàm render "VIEW-ONLY" cho Cấp 3, ĐH
function renderAdminEduList(containerId, itemList) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (itemList.length === 0) {
        container.innerHTML = '<p class="admin-edu-item-placeholder">Không có dữ liệu.</p>';
        return;
    }
    
    itemList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'admin-edu-item';
        
        const files = [];
        if (item.CapHoc === 'Cấp 3') {
            if(item.FileHocBa10) files.push({ name: 'Học bạ 10', path: item.FileHocBa10 });
            if(item.FileHocBa11) files.push({ name: 'Học bạ 11', path: item.FileHocBa11 });
            if(item.FileHocBa12) files.push({ name: 'Học bạ 12', path: item.FileHocBa12 });
        } else {
            if(item.FileBangDiem) files.push({ name: 'Bằng/Bảng điểm', path: item.FileBangDiem });
        }

        let content = `
            <div class="admin-edu-item-header">
                <div>
                    <strong>${item.TenTruong}</strong>
                    <span>(${item.ThoiGian})</span>
                </div>
            </div>
        `;
        
        if (item.CapHoc === 'Cấp 3') {
            content += `
                <p><strong>Học lực:</strong> ${item.HocLuc || 'N/A'} | <strong>Hạnh kiểm:</strong> ${item.HanhKiem || 'N/A'}</p>
                <p><strong>Điểm TB:</strong> 
                    Lớp 10 (<strong>${item.DiemTB_10 || 'N/A'}</strong>) - 
                    Lớp 11 (<strong>${item.DiemTB_11 || 'N/A'}</strong>) - 
                    Lớp 12 (<strong>${item.DiemTB_12 || 'N/A'}</strong>)
                </p>
            `;
        } else {
            content += `
                <p><strong>Ngành:</strong> ${item.NganhHoc || 'N/A'} | <strong>Hệ:</strong> ${item.HeDaoTao || 'N/A'}</p>
                <p><strong>GPA:</strong> ${item.GPA || 'N/A'} | <strong>Tốt nghiệp:</strong> ${item.LoaiTotNghiep || 'N/A'}</p>
            `;
        }
        
        if (files.length > 0) {
            content += '<div class="admin-edu-file-gallery">';
            files.forEach(file => {
                content += `
                    <div class="edu-file-thumbnail-wrapper">
                        <img src="${API_URL}/${file.path}" alt="${file.name}" class="edu-file-thumbnail" onclick="window.open(this.src)">
                        <span>${file.name}</span>
                    </div>
                `;
            });
            content += '</div>';
        }
        
        div.innerHTML = `
            <div class="admin-edu-item-content">
                ${content}
            </div>
            <div class="admin-edu-item-actions">
                <button class="btn-admin-edit" onclick="openAdminLearningProcessModal('${item.CapHoc}', ${item.ID_HocTap})">
                    <i class="fa-solid fa-edit"></i> Sửa
                </button>
                <button class="btn-admin-delete" onclick="deleteAdminLearningProcess(${item.ID_HocTap})">
                    <i class="fa-solid fa-trash"></i> Xóa
                </button>
            </div>
        `;
        
        container.appendChild(div);
    });
}

// 6.6. (CẬP NHẬT) Hàm render "VIEW-ONLY" cho Chứng chỉ
function renderAdminCertList(containerId, itemList) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (itemList.length === 0) {
        container.innerHTML = '<p class="admin-edu-item-placeholder">Không có dữ liệu.</p>';
        return;
    }
    
    itemList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'admin-edu-item';
        
        let content = `
            <div class="admin-edu-item-header">
                <div>
                    <strong>${item.TenChungChi}</strong>
                    <span>(Loại: ${item.LoaiVanBang || 'N/A'})</span>
                </div>
            </div>
            <p><strong>Đơn vị cấp:</strong> ${item.DonViCap || 'N/A'}</p>
            <p><strong>Ngày cấp:</strong> ${formatDate(item.NgayCap)}</p>
        `;
        
        if (item.FilePath) {
            content += '<div class="admin-edu-file-gallery">';
            content += `
                <div class="edu-file-thumbnail-wrapper">
                    <img src="${API_URL}/${item.FilePath}" alt="${item.TenChungChi}" class="edu-file-thumbnail" onclick="window.open(this.src)">
                    <span>File đính kèm</span>
                </div>
            `;
            content += '</div>';
        }
        
        div.innerHTML = `
            <div class="admin-edu-item-content">
                ${content}
            </div>
            <div class="admin-edu-item-actions">
                <button class="btn-admin-edit" onclick="openAdminCertificateModal(${item.ID_ChungChi})">
                    <i class="fa-solid fa-edit"></i> Sửa
                </button>
                <button class="btn-admin-delete" onclick="deleteAdminCertificate(${item.ID_ChungChi})">
                    <i class="fa-solid fa-trash"></i> Xóa
                </button>
            </div>
        `;
        
        container.appendChild(div);
    });
}

// ========================================================
// === (MỚI) BỘ HÀM CHỈNH SỬA GIÁO DỤC (ADMIN) ===
// ========================================================

// 6.7. Gán sự kiện cho các modal
function setupAdminEducationModals() {
    // Nút "Sửa" Cấp 1, Cấp 2
    document.getElementById('admin-edit-level1').addEventListener('click', openAdminLevel1Modal);
    document.getElementById('admin-edit-level2').addEventListener('click', openAdminLevel2Modal);

    // Nút "Thêm"
    document.getElementById('admin-add-level3').addEventListener('click', () => openAdminLearningProcessModal('Cấp 3'));
    document.getElementById('admin-add-university').addEventListener('click', () => openAdminLearningProcessModal('Đại học'));
    document.getElementById('admin-add-college').addEventListener('click', () => openAdminLearningProcessModal('Cao đẳng')); 
    document.getElementById('admin-add-cert').addEventListener('click', () => openAdminCertificateModal());

    // Form Submissions
    document.getElementById('adminLevel1Form').addEventListener('submit', saveAdminLevel1);
    document.getElementById('adminLevel2Form').addEventListener('submit', saveAdminLevel2);
    document.getElementById('adminLearningProcessForm').addEventListener('submit', saveAdminLearningProcess);
    document.getElementById('adminCertificateForm').addEventListener('submit', saveAdminCertificate);
}

// 6.8. Mở Modal Cấp 1/2
function openAdminLevel1Modal() {
    document.getElementById('admin_truongCap1').value = currentAdminEducationProfile.TruongCap1 || '';
    document.getElementById('admin_thoiGianCap1').value = currentAdminEducationProfile.ThoiGianCap1 || '';
    document.getElementById('adminLevel1Modal').style.display = 'block';
}

function openAdminLevel2Modal() {
    document.getElementById('admin_truongCap2').value = currentAdminEducationProfile.TruongCap2 || '';
    document.getElementById('admin_thoiGianCap2').value = currentAdminEducationProfile.ThoiGianCap2 || '';
    document.getElementById('adminLevel2Modal').style.display = 'block';
}

// 6.9. Mở Modal Cấp 3 / ĐH / CĐ (Hàm này xử lý cả "Thêm" và "Sửa")
window.openAdminLearningProcessModal = function(capHoc, id_hoctap = null) {
    const form = document.getElementById('adminLearningProcessForm');
    form.reset(); 
    
    document.getElementById('admin_lp_fields_cap3').style.display = (capHoc === 'Cấp 3') ? 'block' : 'none';
    document.getElementById('admin_lp_fields_daihoc').style.display = (capHoc !== 'Cấp 3') ? 'block' : 'none';
    document.getElementById('admin_learningProcessCapHoc').value = capHoc;

    if (id_hoctap) {
        // --- CHẾ ĐỘ SỬA ---
        const item = currentAdminEducationProfile.quaTrinhHocTap.find(p => p.ID_HocTap === id_hoctap);
        if (!item) {
            alert('Lỗi: Không tìm thấy mục học tập.');
            return;
        }
        
        document.getElementById('adminLearningProcessModalTitle').textContent = `Chỉnh sửa: ${item.TenTruong}`;
        document.getElementById('admin_learningProcessId').value = item.ID_HocTap;
        
        document.getElementById('admin_lp_tenTruong').value = item.TenTruong || '';
        document.getElementById('admin_lp_thoiGian').value = item.ThoiGian || '';
        
        if (capHoc === 'Cấp 3') {
            document.getElementById('admin_lp_diem10').value = item.DiemTB_10 || '';
            document.getElementById('admin_lp_diem11').value = item.DiemTB_11 || '';
            document.getElementById('admin_lp_diem12').value = item.DiemTB_12 || '';
            document.getElementById('admin_lp_hanhKiem').value = item.HanhKiem || '';
            document.getElementById('admin_lp_hocLuc').value = item.HocLuc || '';
        } else {
            document.getElementById('admin_lp_nganhHoc').value = item.NganhHoc || '';
            document.getElementById('admin_lp_heDaoTao').value = item.HeDaoTao || '';
            document.getElementById('admin_lp_gpa').value = item.GPA || '';
            document.getElementById('admin_lp_loaiTotNghiep').value = item.LoaiTotNghiep || '';
        }
    } else {
        // --- CHẾ ĐỘ THÊM MỚI ---
        document.getElementById('adminLearningProcessModalTitle').textContent = `Thêm mới ${capHoc}`;
        document.getElementById('admin_learningProcessId').value = ''; // Rỗng
    }

    document.getElementById('adminLearningProcessModal').style.display = 'block';
}

// 6.10. Mở Modal Chứng Chỉ (Hàm này xử lý cả "Thêm" và "Sửa")
window.openAdminCertificateModal = function(id_chungchi = null) {
    const form = document.getElementById('adminCertificateForm');
    form.reset();

    if (id_chungchi) {
        // --- CHẾ ĐỘ SỬA ---
        const item = currentAdminEducationProfile.chungChiList.find(c => c.ID_ChungChi === id_chungchi);
        if (!item) {
            alert('Lỗi: Không tìm thấy chứng chỉ.');
            return;
        }
        
        document.getElementById('adminCertificateModalTitle').textContent = `Chỉnh sửa: ${item.TenChungChi}`;
        document.getElementById('admin_certificateId').value = item.ID_ChungChi;
        document.getElementById('admin_cc_ten').value = item.TenChungChi || '';
        document.getElementById('admin_cc_donViCap').value = item.DonViCap || '';
        document.getElementById('admin_cc_loai').value = item.LoaiVanBang || '';
        document.getElementById('admin_cc_ngayCap').value = formatDate(item.NgayCap, 'YYYY-MM-DD');
        document.getElementById('admin_cc_ngayHetHan').value = formatDate(item.NgayHetHan, 'YYYY-MM-DD');
    } else {
        // --- CHẾ ĐỘ THÊM MỚI ---
        document.getElementById('adminCertificateModalTitle').textContent = 'Thêm mới Văn bằng/Chứng chỉ';
        document.getElementById('admin_certificateId').value = ''; // Rỗng
    }
    
    document.getElementById('adminCertificateModal').style.display = 'block';
}

// --- CÁC HÀM LƯU / XÓA ---

// 6.11. Lưu Cấp 1 (Admin)
async function saveAdminLevel1(e) {
    e.preventDefault(); // <-- DÒNG NÀY RẤT QUAN TRỌNG
    const data = {
        id_gd: currentAdminEditingGD_ID,
        truongCap1: document.getElementById('admin_truongCap1').value,
        thoiGianCap1: document.getElementById('admin_thoiGianCap1').value,
    };

    try {
        const res = await fetchWithToken('/api/admin/education/level1', 'PUT', data);
        alert(res.message);
        document.getElementById('adminLevel1Modal').style.display = 'none';
        // Tải lại chi tiết hồ sơ
        loadEducationDetails(currentAdminEducationProfile.ID_CD, currentAdminEducationProfile.HoTen);
        // (MỚI) Tải lại thống kê
        loadEducationStats();
    } catch (error) {
        alert(error.message);
    }
}

// 6.12. Lưu Cấp 2 (Admin)
async function saveAdminLevel2(e) {
    e.preventDefault(); // <-- DÒNG NÀY RẤT QUAN TRỌNG
    const data = {
        id_gd: currentAdminEditingGD_ID,
        truongCap2: document.getElementById('admin_truongCap2').value,
        thoiGianCap2: document.getElementById('admin_thoiGianCap2').value,
    };

    try {
        const res = await fetchWithToken('/api/admin/education/level2', 'PUT', data);
        alert(res.message);
        document.getElementById('adminLevel2Modal').style.display = 'none';
        loadEducationDetails(currentAdminEducationProfile.ID_CD, currentAdminEducationProfile.HoTen);
        // (MỚI) Tải lại thống kê
        loadEducationStats();
    } catch (error) {
        alert(error.message);
    }
}

// 6.13. Lưu Quá trình học tập (Admin)
async function saveAdminLearningProcess(e) {
    e.preventDefault(); // <-- DÒNG NÀY RẤT QUAN TRỌNG
    
    const id = document.getElementById('admin_learningProcessId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/education/learning-process/${id}` : '/api/admin/education/learning-process';
    const capHoc = document.getElementById('admin_learningProcessCapHoc').value;

    const formData = new FormData();
    formData.append('id_gd', currentAdminEditingGD_ID);
    formData.append('capHoc', capHoc);
    formData.append('tenTruong', document.getElementById('admin_lp_tenTruong').value);
    formData.append('thoiGian', document.getElementById('admin_lp_thoiGian').value);

    if (capHoc === 'Cấp 3') {
        formData.append('diem10', document.getElementById('admin_lp_diem10').value);
        formData.append('diem11', document.getElementById('admin_lp_diem11').value);
        formData.append('diem12', document.getElementById('admin_lp_diem12').value);
        formData.append('hanhKiem', document.getElementById('admin_lp_hanhKiem').value);
        formData.append('hocLuc', document.getElementById('admin_lp_hocLuc').value);
        if (document.getElementById('admin_lp_fileHocBa10').files[0]) formData.append('fileHocBa10', document.getElementById('admin_lp_fileHocBa10').files[0]);
        if (document.getElementById('admin_lp_fileHocBa11').files[0]) formData.append('fileHocBa11', document.getElementById('admin_lp_fileHocBa11').files[0]);
        if (document.getElementById('admin_lp_fileHocBa12').files[0]) formData.append('fileHocBa12', document.getElementById('admin_lp_fileHocBa12').files[0]);
    } else {
        formData.append('nganhHoc', document.getElementById('admin_lp_nganhHoc').value);
        formData.append('heDaoTao', document.getElementById('admin_lp_heDaoTao').value);
        formData.append('gpa', document.getElementById('admin_lp_gpa').value);
        formData.append('loaiTotNghiep', document.getElementById('admin_lp_loaiTotNghiep').value);
        if (document.getElementById('admin_lp_fileBangDiem').files[0]) formData.append('fileBangDiem', document.getElementById('admin_lp_fileBangDiem').files[0]);
    }

    try {
        const res = await fetchWithToken(url, method, formData, true); // isFormData = true
        alert(res.message);
        document.getElementById('adminLearningProcessModal').style.display = 'none';
        loadEducationDetails(currentAdminEducationProfile.ID_CD, currentAdminEducationProfile.HoTen);
        // (MỚI) Tải lại thống kê
        loadEducationStats();
    } catch (error) {
        alert(error.message);
    }
}

// 6.14. Xóa Quá trình học tập (Admin)
window.deleteAdminLearningProcess = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn XÓA mục học tập này? Hành động này không thể hoàn tác.')) return;
    try {
        const res = await fetchWithToken(`/api/admin/education/learning-process/${id}`, 'DELETE');
        alert(res.message);
        loadEducationDetails(currentAdminEducationProfile.ID_CD, currentAdminEducationProfile.HoTen);
        // (MỚI) Tải lại thống kê
        loadEducationStats();
    } catch (error) {
        alert(error.message);
    }
}

// 6.15. Lưu Chứng chỉ (Admin)
async function saveAdminCertificate(e) {
    e.preventDefault(); // <-- DÒNG NÀY RẤT QUAN TRỌNG
    
    const id = document.getElementById('admin_certificateId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/education/certificate/${id}` : '/api/admin/education/certificate';

    const formData = new FormData();
    formData.append('id_gd', currentAdminEditingGD_ID);
    formData.append('tenChungChi', document.getElementById('admin_cc_ten').value);
    formData.append('donViCap', document.getElementById('admin_cc_donViCap').value);
    formData.append('loaiVanBang', document.getElementById('admin_cc_loai').value);
    formData.append('ngayCap', document.getElementById('admin_cc_ngayCap').value);
    formData.append('ngayHetHan', document.getElementById('admin_cc_ngayHetHan').value);
    
    if (document.getElementById('admin_cc_file').files[0]) {
        formData.append('fileChungChi', document.getElementById('admin_cc_file').files[0]);
    }

    try {
        const res = await fetchWithToken(url, method, formData, true); // isFormData = true
        alert(res.message);
        document.getElementById('adminCertificateModal').style.display = 'none';
        loadEducationDetails(currentAdminEducationProfile.ID_CD, currentAdminEducationProfile.HoTen);
        // (MỚI) Tải lại thống kê
        loadEducationStats();
    } catch (error) {
        alert(error.message);
    }
}

// 6.16. Xóa Chứng chỉ (Admin)
window.deleteAdminCertificate = async function(id) {
    if (!confirm('Bạn có chắc chắn muốn XÓA chứng chỉ này? Hành động này không thể hoàn tác.')) return;
    try {
        const res = await fetchWithToken(`/api/admin/education/certificate/${id}`, 'DELETE');
        alert(res.message);
        loadEducationDetails(currentAdminEducationProfile.ID_CD, currentAdminEducationProfile.HoTen);
        // (MỚI) Tải lại thống kê
        loadEducationStats();
    } catch (error) {
        alert(error.message);
    }
}
// ========================================================
// === KẾT THÚC BỘ HÀM CHỈNH SỬA GIÁO DỤC (ADMIN) ===
// ========================================================

// =========================================
// --- 4. MODULE Y TẾ ---
// =========================================
async function loadHealthStats() {
    try {
        const stats = await fetchWithToken('/api/admin/health/stats', 'GET');
        const percent = stats.totalHoSoYTe > 0 ? (stats.bhyt / stats.totalHoSoYTe) * 100 : 0;
        document.getElementById('stat-health-bhyt').textContent = stats.bhyt || 0;
        document.getElementById('stat-health-bhyt-percent').textContent = `(${percent.toFixed(1)}%)`;
    } catch (e) { console.error(e); }
}

function setupHealthSearch() {
    const btn = document.getElementById('healthSearchButton');
    if(btn) btn.onclick = () => performHealthSearch(document.getElementById('healthSearchInput').value);
}

async function performHealthSearch(term) {
    if(!term) return;
    try {
        const results = await fetchWithToken(`/api/admin/citizens/search?q=${term}`, 'GET');
        const tbody = document.getElementById('health-search-results-body');
        tbody.innerHTML = '';
        results.forEach(item => {
            tbody.innerHTML += `<tr>
                <td>${item.ID_CD}</td>
                <td><strong>${item.HoTen}</strong></td>
                <td>${formatDate(item.NgaySinh)}</td>
                <td>${item.Email || ''}</td>
                <td><button class="btn-view" onclick="loadHealthDetails('${item.ID_CD}', '${item.HoTen}')">Xem</button></td>
            </tr>`;
        });
    } catch(e) { alert(e.message); }
}

async function loadHealthDetails(id_cd, hoTen) {
    document.getElementById('health-details-container').style.display = 'none';
    try {
        const profile = await fetchWithToken(`/api/admin/health/${id_cd}`, 'GET');
        currentAdminEditingYTe_ID = profile.ID_YTe;
        currentAdminHealthProfile = profile;
        currentAdminHealthProfile.ID_CD = id_cd; currentAdminHealthProfile.HoTen = hoTen;

        document.getElementById('admin-health-nhomMau').textContent = profile.NhomMau || 'N/A';
        document.getElementById('admin-health-tienSuBenh').textContent = profile.TienSuBenh || 'N/A';
        document.getElementById('admin-health-soBHYT').textContent = profile.SoBHYT || 'N/A';
        document.getElementById('admin-health-noiKCB').textContent = profile.NoiDangKyKCB || 'N/A';
        document.getElementById('admin-health-ngayHetHan').textContent = formatDate(profile.NgayHetHanBHYT);
            // Render BHYT image(s)
            const bhytWrapper = document.getElementById('admin-health-bhyt-anh-wrapper');
            bhytWrapper.innerHTML = '';
            if (profile.AnhBHYT && profile.AnhBHYT !== 'null') {
                const p = profile.AnhBHYT.replace(/^\/+/, '');
                const url = `${API_URL}/${p}`;
                bhytWrapper.innerHTML = `<div class="admin-file-thumbs"><img src="${url}" class="admin-thumb" onclick="openAdminEduFileModalUrl('${url}')" alt="BHYT"></div>`;
            } else {
                bhytWrapper.innerHTML = '<div style="color:#777; font-style:italic">Không có ảnh BHYT.</div>';
            }
        renderAdminExamList('admin-health-exam-list', profile.khamBenhList || []);
        renderAdminVaccinationList('admin-health-vacc-list', profile.tiemChungList || []);
        document.getElementById('health-details-container').style.display = 'block';
    } catch(e) { document.getElementById('health-details-not-found').style.display = 'block'; }
}

// 7.5. (CẬP NHẬT: CHI TIẾT + ẢNH + NÚT PHẢI) Render Lịch sử Khám
function renderAdminExamList(containerId, itemList) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!itemList || itemList.length === 0) {
        container.innerHTML = '<p class="admin-edu-item-placeholder">Không có dữ liệu khám bệnh.</p>';
        return;
    }
    
    itemList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'admin-edu-item';
        // Style khung thẻ (Đồng bộ với bên Giáo dục)
        div.style.padding = '15px';
        div.style.border = '1px solid #e5e7eb';
        div.style.borderRadius = '8px';
        div.style.marginBottom = '12px';
        div.style.backgroundColor = '#fff';
        div.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        
        // --- XỬ LÝ FILE ĐÍNH KÈM ---
        let filesHTML = '';
        let fileList = item.FileDinhKem || [];
        
        // Parse JSON nếu server trả về string
        if (typeof fileList === 'string' && fileList !== 'null') {
            try { fileList = JSON.parse(fileList); } catch(e) { fileList = []; }
        }
        
        if (Array.isArray(fileList) && fileList.length > 0) {
            filesHTML = '<div class="admin-edu-file-gallery" style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">';
            fileList.forEach(fp => {
                if (!fp) return;
                const path = fp.replace(/^\/+/, '');
                const url = `${API_URL}/${path}`;
                const ext = fp.split('.').pop().toLowerCase();
                const fileName = fp.split('/').pop().substring(14); // Cắt bớt timestamp

                if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) {
                    filesHTML += `
                        <div style="text-align:center; cursor:pointer;" onclick="window.open('${url}')" title="${fileName}">
                            <img src="${url}" style="height:60px; width:auto; border:1px solid #ddd; border-radius:4px; transition:transform 0.2s;" 
                                 onmouseover="this.style.transform='scale(1.1)'" 
                                 onmouseout="this.style.transform='scale(1)'">
                        </div>`;
                } else {
                    filesHTML += `
                        <div class="admin-existing-file-item" style="border:1px solid #eee;">
                            <a href="${url}" target="_blank" style="font-size:0.85rem; color:#2563eb; text-decoration:none;">
                                <i class="fa-solid fa-paperclip"></i> ${fileName}
                            </a>
                        </div>`;
                }
            });
            filesHTML += '</div>';
        }

        // --- RENDER HTML (FLEXBOX ĐỂ ĐẨY NÚT SANG PHẢI) ---
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                
                <div style="flex: 1; padding-right: 15px;">
                    <h4 style="margin:0 0 4px 0; color:#111827; font-size:1.1em; font-weight:bold;">${item.CoSoYTe}</h4>
                    <div style="color:#6b7280; font-size:0.9em; font-weight:500; margin-bottom: 8px;">
                        <i class="fa-regular fa-calendar"></i> ${formatDate(item.NgayKham)}
                    </div>
                    
                    <div style="font-size:0.95em; color:#374151;">
                        <p style="margin:3px 0;"><strong>Bác sĩ:</strong> ${item.BacSi || '---'}</p>
                        <p style="margin:3px 0;"><strong>Chẩn đoán:</strong> ${item.ChanDoan || '---'}</p>
                        <p style="margin:3px 0; color:#4b5563;"><strong>Phác đồ/Ghi chú:</strong> ${item.PhacDoDieuTri || '---'}</p>
                    </div>
                    ${filesHTML}
                </div>

                <div class="admin-edu-item-actions" style="display:flex; gap: 8px; flex-shrink: 0;">
                    <button class="btn-admin-edit" style="padding:6px 12px;" onclick="openAdminHealthExamModal(${item.ID_KhamBenh})" title="Sửa">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-admin-delete" style="padding:6px 12px;" onclick="deleteAdminHealthExam(${item.ID_KhamBenh})" title="Xóa">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}
// 7.6. (CẬP NHẬT: CHI TIẾT + ẢNH + NÚT PHẢI) Lịch sử Tiêm
function renderAdminVaccinationList(containerId, itemList) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!itemList || itemList.length === 0) {
        container.innerHTML = '<p class="admin-edu-item-placeholder">Không có dữ liệu tiêm chủng.</p>';
        return;
    }
    
    itemList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'admin-edu-item';
        div.style.padding = '15px';
        div.style.border = '1px solid #e5e7eb';
        div.style.borderRadius = '8px';
        div.style.marginBottom = '12px';
        div.style.backgroundColor = '#fff';
        div.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        
        // --- XỬ LÝ FILE XÁC MINH ---
        let fileHTML = '';
        const file = item.FileXacMinh || item.fileXacMinh || null;
        if (file && file !== 'null') {
            const path = file.replace(/^\/+/, '');
            const url = `${API_URL}/${path}`;
            fileHTML = `
                <div style="margin-top:10px;">
                    <img src="${url}" 
                         style="height:60px; width:auto; border:1px solid #ddd; border-radius:4px; cursor:pointer; transition:transform 0.2s;" 
                         onclick="window.open('${url}')"
                         onmouseover="this.style.transform='scale(1.1)'" 
                         onmouseout="this.style.transform='scale(1)'"
                         title="Ảnh xác minh">
                </div>`;
        }

        // --- RENDER HTML ---
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                
                <div style="flex: 1; padding-right: 15px;">
                    <h4 style="margin:0 0 4px 0; color:#0072ff; font-size:1.1em; font-weight:bold;">${item.TenVacXin}</h4>
                    <div style="color:#6b7280; font-size:0.9em; font-weight:500; margin-bottom: 8px;">
                        <i class="fa-regular fa-calendar"></i> ${formatDate(item.NgayTiem)}
                    </div>
                    
                    <div style="font-size:0.95em; color:#374151;">
                        <p style="margin:3px 0;"><strong>Đơn vị tiêm:</strong> ${item.DonVi || '---'}</p>
                    </div>
                    ${fileHTML}
                </div>

                <div class="admin-edu-item-actions" style="display:flex; gap: 8px; flex-shrink: 0;">
                    <button class="btn-admin-edit" style="padding:6px 12px;" onclick="openAdminHealthVaccinationModal(${item.ID_TiemChung})">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-admin-delete" style="padding:6px 12px;" onclick="deleteAdminHealthVaccination(${item.ID_TiemChung})">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}
function setupAdminHealthModals() {
    document.getElementById('admin-edit-health-general').onclick = openAdminHealthGeneralModal;
    document.getElementById('admin-edit-health-bhyt').onclick = openAdminHealthBHYTModal;
    document.getElementById('admin-add-health-exam').onclick = () => openAdminHealthExamModal();
    document.getElementById('admin-add-health-vacc').onclick = () => openAdminHealthVaccinationModal();

    document.getElementById('adminHealthGeneralForm').onsubmit = saveAdminHealthGeneral;
    document.getElementById('adminHealthBHYTForm').onsubmit = saveAdminHealthBHYT;
    document.getElementById('adminHealthExamForm').onsubmit = saveAdminHealthExam;
    document.getElementById('adminHealthVaccinationForm').onsubmit = saveAdminHealthVaccination;
}

function openAdminHealthGeneralModal() {
    document.getElementById('admin_health_nhomMau').value = currentAdminHealthProfile.NhomMau || '';
    document.getElementById('admin_health_tienSuBenh').value = currentAdminHealthProfile.TienSuBenh || '';
    document.getElementById('adminHealthGeneralModal').style.display = 'block';
}
// 7.9. (ĐÃ SỬA: ĐIỀN ĐỦ THÔNG TIN BHYT) Mở Modal BHYT
function openAdminHealthBHYTModal() {
    document.getElementById('adminHealthBHYTForm').reset();
    
    // Điền dữ liệu cũ vào Form
    document.getElementById('admin_health_soBHYT').value = currentAdminHealthProfile.SoBHYT || '';
    document.getElementById('admin_health_noiKCB').value = currentAdminHealthProfile.NoiDangKyKCB || ''; // <--- Đã thêm
    document.getElementById('admin_health_ngayHetHan').value = formatDate(currentAdminHealthProfile.NgayHetHanBHYT, 'YYYY-MM-DD'); // <--- Đã thêm
    
    document.getElementById('adminHealthBHYTModal').style.display = 'block';
}
// 7.10. (CẬP NHẬT: ĐIỀN ĐỦ THÔNG TIN) Mở Modal Lịch sử Khám
window.openAdminHealthExamModal = function(id_khambenh = null) {
    const form = document.getElementById('adminHealthExamForm');
    form.reset(); 
    
    const existingFilesContainer = document.getElementById('admin_health_existing_exam_files');
    const existingFilesWrapper = document.getElementById('admin_health_existing_exam_files_container');
    existingFilesContainer.innerHTML = '';
    
    const titleEl = document.getElementById('adminHealthExamModalTitle');

    if (id_khambenh) {
        // --- CHẾ ĐỘ SỬA ---
        // Dùng '==' để so sánh an toàn
        const item = currentAdminHealthProfile.khamBenhList.find(p => p.ID_KhamBenh == id_khambenh);
        
        if(!item) { alert('Không tìm thấy dữ liệu.'); return; }

        if(titleEl) titleEl.textContent = 'Chỉnh sửa Lịch sử Khám bệnh';
        document.getElementById('admin_health_examId').value = item.ID_KhamBenh;
        
        // Điền thông tin
        document.getElementById('admin_health_ngayKham').value = formatDate(item.NgayKham, 'YYYY-MM-DD');
        document.getElementById('admin_health_coSoYTe').value = item.CoSoYTe || '';
        document.getElementById('admin_health_bacSi').value = item.BacSi || '';
        document.getElementById('admin_health_chanDoan').value = item.ChanDoan || '';
        document.getElementById('admin_health_phacDo').value = item.PhacDoDieuTri || ''; // Code cũ thường thiếu cái này
        
        // Hiển thị file cũ
        let files = item.FileDinhKem || [];
        if (typeof files === 'string' && files !== 'null') {
            try { files = JSON.parse(files); } catch(e) { files = [files]; }
        }
        
        if (Array.isArray(files) && files.length > 0) {
            existingFilesWrapper.style.display = 'block';
            files.forEach(fp => {
                if (!fp) return;
                const path = fp.replace(/^\/+/, '');
                const url = `${API_URL}/${path}`;
                const fileName = fp.split('/').pop().substring(14);
                
                const fileEl = document.createElement('div');
                fileEl.className = 'admin-existing-file-item';
                fileEl.style.display = 'flex';
                fileEl.style.justifyContent = 'space-between';
                fileEl.style.alignItems = 'center';
                fileEl.style.marginBottom = '5px';
                
                fileEl.innerHTML = `
                    <a href="${url}" target="_blank" style="color:#333; text-decoration:none; font-size:0.9rem;">
                        <i class="fa-solid fa-file"></i> ${fileName}
                    </a>
                    <button type="button" class="btn-remove-file" data-file-path="${fp}" style="color:red; border:none; background:none; cursor:pointer;">&times;</button>
                `;
                
                // Xử lý nút xóa file (chỉ xóa trên giao diện, khi bấm Lưu mới gửi lên server)
                fileEl.querySelector('.btn-remove-file').addEventListener('click', (e) => {
                    e.target.parentElement.remove(); 
                });
                
                existingFilesContainer.appendChild(fileEl);
            });
        } else {
            existingFilesWrapper.style.display = 'none';
        }
    } else {
        // --- CHẾ ĐỘ THÊM MỚI ---
        if(titleEl) titleEl.textContent = 'Thêm Lịch sử Khám bệnh';
        document.getElementById('admin_health_examId').value = ''; 
        existingFilesWrapper.style.display = 'none';
    }
    
    document.getElementById('adminHealthExamModal').style.display = 'block';
}
// 7.11. (CẬP NHẬT: ĐIỀN ĐỦ THÔNG TIN) Mở Modal Tiêm chủng
window.openAdminHealthVaccinationModal = function(id_tiemchung = null) {
    const form = document.getElementById('adminHealthVaccinationForm');
    form.reset();
    
    const existingFileContainer = document.getElementById('admin_health_existing_vacc_file_container');
    existingFileContainer.innerHTML = '';
    
    const titleEl = document.getElementById('adminHealthVaccinationModalTitle');

    if (id_tiemchung) {
        // --- CHẾ ĐỘ SỬA ---
        const item = currentAdminHealthProfile.tiemChungList.find(c => c.ID_TiemChung == id_tiemchung);
        
        if(!item) { alert('Không tìm thấy dữ liệu.'); return; }

        if(titleEl) titleEl.textContent = 'Chỉnh sửa Lịch sử Tiêm chủng';
        document.getElementById('admin_health_vaccId').value = item.ID_TiemChung;
        
        // Điền thông tin
        document.getElementById('admin_health_tenVacXin').value = item.TenVacXin || '';
        document.getElementById('admin_health_donVi').value = item.DonVi || ''; // Code cũ hay thiếu cái này
        document.getElementById('admin_health_ngayTiem').value = formatDate(item.NgayTiem, 'YYYY-MM-DD');
        
        // Hiển thị ảnh xác minh cũ
        const f = item.FileXacMinh || item.fileXacMinh || null;
        if (f && f !== 'null') {
            const path = f.replace(/^\/+/, '');
            const url = `${API_URL}/${path}`;
            const fileName = f.split('/').pop().substring(14);
            
            existingFileContainer.innerHTML = `
                <label class="block text-sm font-medium text-gray-700" style="margin-bottom:5px;">File đã đính kèm:</label>
                <div class="admin-existing-file-item" style="display:flex; align-items:center; gap:10px;">
                    <img src="${url}" style="height:40px; width:auto; border-radius:4px; border:1px solid #ddd;">
                    <a href="${url}" target="_blank" style="font-size:0.9rem; color:#333;">${fileName}</a>
                </div>
            `;
            existingFileContainer.style.display = 'block';
        } else {
            existingFileContainer.style.display = 'none';
        }
    } else {
        // --- CHẾ ĐỘ THÊM MỚI ---
        if(titleEl) titleEl.textContent = 'Thêm Lịch sử Tiêm chủng';
        document.getElementById('admin_health_vaccId').value = '';
        existingFileContainer.innerHTML = '';
    }
    
    document.getElementById('adminHealthVaccinationModal').style.display = 'block';
}

async function saveAdminHealthGeneral(e) {
    e.preventDefault();
    try {
        await fetchWithToken('/api/admin/health/general', 'PUT', {
            id_yte: currentAdminEditingYTe_ID,
            nhomMau: document.getElementById('admin_health_nhomMau').value,
            tienSuBenh: document.getElementById('admin_health_tienSuBenh').value
        });
        alert('Thành công'); document.getElementById('adminHealthGeneralModal').style.display = 'none';
        loadHealthDetails(currentAdminHealthProfile.ID_CD, currentAdminHealthProfile.HoTen);
    } catch(e) { alert(e.message); }
}
// 7.13. (ĐÃ SỬA: GỬI ĐỦ DỮ LIỆU BHYT) Lưu BHYT
async function saveAdminHealthBHYT(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('id_yte', currentAdminEditingYTe_ID);
    
    // --- CÁC TRƯỜNG DỮ LIỆU (QUAN TRỌNG) ---
    formData.append('soBHYT', document.getElementById('admin_health_soBHYT').value);
    formData.append('noiDangKyKCB', document.getElementById('admin_health_noiKCB').value);     // <--- Mới thêm
    formData.append('ngayHetHanBHYT', document.getElementById('admin_health_ngayHetHan').value); // <--- Mới thêm
    
    // File ảnh BHYT
    const fileInput = document.getElementById('admin_health_anhBHYT');
    if (fileInput.files[0]) {
        formData.append('anhBHYT', fileInput.files[0]);
    }

    try {
        await fetchWithToken('/api/admin/health/bhyt', 'PUT', formData, true);
        alert('Cập nhật BHYT thành công!');
        
        document.getElementById('adminHealthBHYTModal').style.display = 'none';
        
        // Tải lại dữ liệu để hiển thị cái mới nhất
        loadHealthDetails(currentAdminHealthProfile.ID_CD, currentAdminHealthProfile.HoTen);
        loadHealthStats(); 
    } catch(e) { 
        alert('Lỗi: ' + e.message); 
    }
}
// 7.14. (ĐÃ SỬA: THÊM BÁC SĨ VÀ PHÁC ĐỒ) Lưu Lịch sử Khám
async function saveAdminHealthExam(e) { 
    e.preventDefault(); 
    
    const id = document.getElementById('admin_health_examId').value;
    // Xác định URL và Method
    const url = id ? `/api/admin/health/exam/${id}` : '/api/admin/health/exam';
    const method = id ? 'PUT' : 'POST';

    const formData = new FormData();
    formData.append('id_yte', currentAdminEditingYTe_ID);
    
    // --- CÁC TRƯỜNG QUAN TRỌNG ---
    formData.append('coSoYTe', document.getElementById('admin_health_coSoYTe').value);
    formData.append('ngayKham', document.getElementById('admin_health_ngayKham').value);
    formData.append('chanDoan', document.getElementById('admin_health_chanDoan').value);
    
    // --- BỔ SUNG CÁC TRƯỜNG BỊ THIẾU ---
    formData.append('bacSi', document.getElementById('admin_health_bacSi').value);          // <--- Mới thêm
    formData.append('phacDoDieuTri', document.getElementById('admin_health_phacDo').value); // <--- Mới thêm

    // Thêm file mới
    const filesInput = document.getElementById('admin_health_filesDinhKem');
    if (filesInput && filesInput.files && filesInput.files.length) {
        for (let i = 0; i < filesInput.files.length; i++) {
            formData.append('filesDinhKem', filesInput.files[i]);
        }
    }
    
    // Giữ lại file cũ khi sửa
    if (id) {
        const existingItem = currentAdminHealthProfile.khamBenhList.find(i => i.ID_KhamBenh === parseInt(id));
        let existingFiles = existingItem ? existingItem.FileDinhKem || [] : [];
        
        if (typeof existingFiles === 'string' && existingFiles !== 'null') {
            try { existingFiles = JSON.parse(existingFiles); } catch(e) { existingFiles = [existingFiles]; }
        }
        
        if (Array.isArray(existingFiles) && existingFiles.length) {
            existingFiles.forEach(fp => {
                if (!fp) return;
                formData.append('existingFiles', fp);
            });
        }
    }
    
    try {
        await fetchWithToken(url, method, formData, true);
        alert('Thành công');
        document.getElementById('adminHealthExamModal').style.display = 'none';
        loadHealthDetails(currentAdminHealthProfile.ID_CD, currentAdminHealthProfile.HoTen);
    } catch(e) { 
        alert(e.message); 
    }
}
// 7.16. (ĐÃ SỬA: THÊM ĐƠN VỊ TIÊM) Lưu Lịch sử Tiêm
async function saveAdminHealthVaccination(e) { 
    e.preventDefault(); 
    
    const id = document.getElementById('admin_health_vaccId').value;
    // Xác định URL và Method
    const url = id ? `/api/admin/health/vaccination/${id}` : '/api/admin/health/vaccination';
    const method = id ? 'PUT' : 'POST';
    
    const formData = new FormData();
    formData.append('id_yte', currentAdminEditingYTe_ID);
    
    // --- CÁC TRƯỜNG QUAN TRỌNG ---
    formData.append('tenVacXin', document.getElementById('admin_health_tenVacXin').value);
    formData.append('ngayTiem', document.getElementById('admin_health_ngayTiem').value);
    
    // --- BỔ SUNG TRƯỜNG BỊ THIẾU ---
    formData.append('donVi', document.getElementById('admin_health_donVi').value); // <--- Mới thêm

    // File xác minh
    const vaccFileInput = document.getElementById('admin_health_fileXacMinh');
    if (vaccFileInput && vaccFileInput.files && vaccFileInput.files[0]) {
        formData.append('fileXacMinh', vaccFileInput.files[0]);
    }
    
    try {
        await fetchWithToken(url, method, formData, true);
        alert('Thành công'); 
        document.getElementById('adminHealthVaccinationModal').style.display = 'none';
        loadHealthDetails(currentAdminHealthProfile.ID_CD, currentAdminHealthProfile.HoTen);
    } catch(e) { 
        alert(e.message); 
    }
}
window.deleteAdminHealthExam = async function(id) { if(confirm('Xóa?')) await fetchWithToken(`/api/admin/health/exam/${id}`, 'DELETE'); loadHealthDetails(currentAdminHealthProfile.ID_CD, currentAdminHealthProfile.HoTen); }
window.deleteAdminHealthVaccination = async function(id) { if(confirm('Xóa?')) await fetchWithToken(`/api/admin/health/vaccination/${id}`, 'DELETE'); loadHealthDetails(currentAdminHealthProfile.ID_CD, currentAdminHealthProfile.HoTen); }


// =========================================
// --- 5. MODULE VIỆC LÀM ---
// =========================================
async function loadJobStats() {
    try {
        const stats = await fetchWithToken('/api/admin/jobs/stats', 'GET');
        document.getElementById('stat-job-unemployed').textContent = stats.unemployed || 0;
        document.getElementById('stat-job-active').textContent = stats.activeJobs || 0;
    } catch(e) { console.error(e); }
}
function setupJobSearch() {
    const btn = document.getElementById('jobCitizenSearchButton');
    if(btn) btn.onclick = () => performJobSearch(document.getElementById('jobCitizenSearchInput').value);
}
async function performJobSearch(term) {
    if(!term) return;
    const results = await fetchWithToken(`/api/admin/citizens/search?q=${term}`, 'GET');
    const tbody = document.getElementById('job-citizen-list');
    tbody.innerHTML = '';
    results.forEach(item => {
        tbody.innerHTML += `<tr>
            <td>${item.ID_CD}</td><td>${item.HoTen}</td><td>${item.Email}</td>
            <td><button class="btn-view" onclick="loadJobProfile('${item.ID_CD}', '${item.HoTen}')">Xem</button></td>
        </tr>`;
    });
}
// Sửa lại hàm này trong File 2
async function loadJobProfile(id_cd, hoTen) {
    try {
        const data = await fetchWithToken(`/api/admin/jobs/profile/${id_cd}`, 'GET');
        document.getElementById('admin-job-profile-container').style.display = 'block';
        document.getElementById('admin-job-profile-name').textContent = hoTen;
        
        // --- BỔ SUNG TỪ FILE 1 (Hiển thị trạng thái Thất nghiệp/Đi làm) ---
        const statusBadge = document.getElementById('admin-job-status-badge');
        if(statusBadge) { // Kiểm tra null để tránh lỗi
            if (data.tinhTrang == 1 || data.tinhTrang === true || data.tinhTrang === 'Đang đi làm') {
                statusBadge.textContent = 'Đang đi làm';
                statusBadge.className = 'status-badge status-approved'; 
            } else {
                statusBadge.textContent = 'Thất nghiệp';
                statusBadge.className = 'status-badge status-rejected'; 
            }
        }
        // ----------------------------------------------------------------

        // Hiển thị lịch sử làm việc (Giữ nguyên hoặc dùng bản chi tiết của File 1)
        const historyList = document.getElementById('admin-job-history-list');
        historyList.innerHTML = '';
        if(data.lichSuLamViec && data.lichSuLamViec.length > 0) {
            data.lichSuLamViec.forEach(job => {
                // Lấy chi tiết tên CV, Loại CV như File 1
                const chucVu = job.TenCV || 'Chưa rõ';
                const loaiHinh = job.LoaiCV ? `(${job.LoaiCV})` : '';
                
                historyList.innerHTML += `
                <div class="admin-edu-item">
                    <strong>${chucVu} ${loaiHinh}</strong><br>
                    <span style="color:#666">${job.NoiLamViec}</span><br>
                    <small>${formatDate(job.NgayBD)} - ${job.NgayKT ? formatDate(job.NgayKT) : 'Hiện tại'}</small>
                </div>`;
            });
        } else {
            historyList.innerHTML = '<p>Chưa có lịch sử.</p>';
        }

        // Hiển thị ứng tuyển
        const applyList = document.getElementById('admin-job-apply-list');
        applyList.innerHTML = '';
        if(data.lichSuUngTuyen && data.lichSuUngTuyen.length > 0) {
            data.lichSuUngTuyen.forEach(app => {
                applyList.innerHTML += `<div class="admin-edu-item"><strong>${app.TieuDe}</strong><br>Công ty: ${app.TenCongTy}</div>`;
            });
        } else {
            applyList.innerHTML = '<p>Chưa ứng tuyển.</p>';
        }

    } catch(e) { alert(e.message); }
}
async function loadJobPosts() {
    const posts = await fetchWithToken('/api/admin/jobs/list', 'GET');
    currentAdminJobPosts = posts;
    const tbody = document.getElementById('admin-job-post-list');
    tbody.innerHTML = '';
    posts.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.TieuDe}</td><td>${p.TenCongTy}</td><td>${p.MucLuong}</td>
            <td>${formatDate(p.NgayDang)}</td><td>${formatDate(p.HanNopHoSo)}</td>
            <td><button class="btn-view" onclick="viewJobApplicants(${p.ID_Tin})">Ứng viên</button>
                <button class="btn-admin-edit" onclick="openJobPostModal(${p.ID_Tin})">Sửa</button>
                <button class="btn-admin-delete" onclick="deleteJobPost(${p.ID_Tin})">Xóa</button></td>
        </tr>`;
    });
}
function setupJobModals() {
    document.getElementById('btn-add-job-post').onclick = () => openJobPostModal();
    document.getElementById('adminJobPostForm').onsubmit = saveJobPost;
    const modal = document.getElementById('adminJobApplicantsModal');
    if(modal.querySelector('.close-modal')) modal.querySelector('.close-modal').onclick = () => modal.style.display = 'none';
}
window.openJobPostModal = function(id = null) {
    document.getElementById('adminJobPostForm').reset();
    document.getElementById('admin_job_id').value = id || '';
    
    if(id) {
        const p = currentAdminJobPosts.find(i => i.ID_Tin === id);
        
        // Điền dữ liệu vào form
        document.getElementById('admin_job_title').value = p.TieuDe || '';
        document.getElementById('admin_job_company').value = p.TenCongTy || '';
        
        // --- [SỬA] BỔ SUNG CÁC TRƯỜNG CÒN THIẾU ---
        document.getElementById('admin_job_industry').value = p.NganhNghe || '';
        document.getElementById('admin_job_salary').value = p.MucLuong || '';
        document.getElementById('admin_job_location').value = p.DiaDiem || '';
        document.getElementById('admin_job_desc').value = p.MoTa || '';
        
        // Xử lý ngày tháng cho input type="date" (cần định dạng YYYY-MM-DD)
        if (p.HanNopHoSo) {
            // Giả sử server trả về chuỗi ISO (2025-11-30T00:00:00.000Z)
            // Ta chỉ lấy phần ngày trước chữ T
            document.getElementById('admin_job_deadline').value = p.HanNopHoSo.split('T')[0];
        }
        // -------------------------------------------
    }
    document.getElementById('adminJobPostModal').style.display = 'block';
}
async function saveJobPost(e) {
    e.preventDefault();
    const id = document.getElementById('admin_job_id').value;
    
    // --- [SỬA] LẤY ĐẦY ĐỦ DỮ LIỆU TỪ FORM ---
    const data = { 
        tieuDe: document.getElementById('admin_job_title').value, 
        tenCongTy: document.getElementById('admin_job_company').value,
        nganhNghe: document.getElementById('admin_job_industry').value,
        mucLuong: document.getElementById('admin_job_salary').value,
        diaDiem: document.getElementById('admin_job_location').value,
        moTa: document.getElementById('admin_job_desc').value,
        hanNop: document.getElementById('admin_job_deadline').value
    }; 
    // ----------------------------------------

    try {
        await fetchWithToken(id ? `/api/admin/jobs/update/${id}` : '/api/admin/jobs/create', id ? 'PUT' : 'POST', data);
        alert('Thành công'); 
        document.getElementById('adminJobPostModal').style.display = 'none'; 
        loadJobPosts();
        loadJobStats();
    } catch(e) { 
        alert(e.message); 
    }
}
window.deleteJobPost = async function(id) { if(confirm('Xóa?')) await fetchWithToken(`/api/admin/jobs/delete/${id}`, 'DELETE'); loadJobPosts();loadJobStats(); }
window.viewJobApplicants = async function(id) {
    const modal = document.getElementById('adminJobApplicantsModal');
    const tbody = document.getElementById('admin-job-applicants-list');
    tbody.innerHTML = '<tr><td>Đang tải...</td></tr>';
    modal.style.display = 'block';
    try {
        const list = await fetchWithToken(`/api/admin/jobs/applications/${id}`, 'GET');
        tbody.innerHTML = '';
        if(list.length === 0) { tbody.innerHTML = '<tr><td colspan="5">Chưa có ứng viên.</td></tr>'; return; }
        list.forEach(a => { tbody.innerHTML += `<tr><td>${a.ID_CD}</td><td>${a.HoTen}</td><td>${a.Email}</td><td>${formatDate(a.NgayUngTuyen)}</td><td>CV</td></tr>`; });
    } catch(e) { alert(e.message); }
}


// =================================================================
// --- 6. MODULE DỊCH VỤ CÔNG (ADMIN) ---
// =================================================================

function initPublicServiceModule() {
    loadPublicServiceList();
    setupPublicServiceSearch();
    
    const btnApprove = document.getElementById('btnApprovePS');
    const btnReject = document.getElementById('btnRejectPS');

    if(btnApprove) btnApprove.addEventListener('click', () => processPublicService('Hoàn thành'));
    if(btnReject) btnReject.addEventListener('click', () => processPublicService('Từ chối'));
}

async function loadPublicServiceList() {
    const tbody = document.getElementById('public-service-table-body');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Đang tải...</td></tr>';

    try {
        const list = await fetchWithToken('/api/public-service/admin/list', 'GET');
        currentPublicServiceList = list;
        renderPublicServiceTable(list);
        updatePublicServiceStats(list);
    } catch (error) {
        console.error('Lỗi tải DVC:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">Lỗi kết nối: ${error.message}</td></tr>`;
    }
}

function renderPublicServiceTable(list) {
    const tbody = document.getElementById('public-service-table-body');
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Không có hồ sơ nào.</td></tr>';
        return;
    }

    list.forEach(item => {
        const tr = document.createElement('tr');
        
        let statusBadge = `<span class="status-badge status-pending">${item.TrangThai}</span>`;
        if(item.TrangThai === 'Hoàn thành') statusBadge = `<span class="status-badge status-approved">Hoàn thành</span>`;
        if(item.TrangThai === 'Từ chối') statusBadge = `<span class="status-badge status-rejected">Từ chối</span>`;

        tr.innerHTML = `
            <td>#${item.ID_HoSo}</td>
            <td><strong>${item.LoaiDichVu}</strong></td>
            <td>
                ${item.NguoiNop}<br>
                <small style="color:#666">${item.CCCDNguoiNop}</small>
            </td>
            <td>${formatDate(item.NgayGui)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn-view" onclick="openPublicServiceModal(${item.ID_HoSo})">
                    <i class="fa-solid fa-file-pen"></i> Xử lý
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updatePublicServiceStats(list) {
    const pendingCount = list.filter(i => i.TrangThai === 'Chờ xử lý').length;
    const approvedCount = list.filter(i => i.TrangThai === 'Hoàn thành').length;
    const rejectedCount = list.filter(i => i.TrangThai === 'Từ chối').length;

    const badge = document.getElementById('badge-public-pending');
    if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    const statPending = document.getElementById('stat-ps-pending');
    const statApproved = document.getElementById('stat-ps-approved');
    const statRejected = document.getElementById('stat-ps-rejected');

    if(statPending) statPending.textContent = pendingCount;
    if(statApproved) statApproved.textContent = approvedCount;
    if(statRejected) statRejected.textContent = rejectedCount;
}

window.openPublicServiceModal = function(id) {
    const item = currentPublicServiceList.find(i => i.ID_HoSo === id);
    if (!item) return;

    currentSelectedPSID = id;

    document.getElementById('psModalTitle').textContent = `Xử lý hồ sơ: ${item.LoaiDichVu}`;
    document.getElementById('ps_nguoiNop').textContent = item.NguoiNop;
    document.getElementById('ps_cccd').textContent = item.CCCDNguoiNop;
    document.getElementById('ps_ngayGui').textContent = formatDate(item.NgayGui);
    
    let statusBadge = `<span class="status-badge status-pending">${item.TrangThai}</span>`;
    if(item.TrangThai === 'Hoàn thành') statusBadge = `<span class="status-badge status-approved">Hoàn thành</span>`;
    if(item.TrangThai === 'Từ chối') statusBadge = `<span class="status-badge status-rejected">Từ chối</span>`;
    document.getElementById('ps_trangThai').innerHTML = statusBadge;
    
    document.getElementById('ps_ghiChu').value = item.GhiChuXuLy || '';

    // Hiển thị chi tiết JSON
    const jsonContainer = document.getElementById('ps_json_details');
    jsonContainer.innerHTML = '';
    try {
        const details = JSON.parse(item.DuLieuChiTiet);
        for (const [key, value] of Object.entries(details)) {
            const label = key.replace(/([A-Z])/g, ' $1').trim();
            const p = document.createElement('div');
            p.style.padding = '10px';
            p.style.background = '#fff';
            p.style.border = '1px solid #eee';
            p.style.borderRadius = '4px';
            p.innerHTML = `<strong style="color:#0072ff; text-transform:capitalize">${label}:</strong> <span style="color:#333;">${value}</span>`;
            jsonContainer.appendChild(p);
        }
    } catch (e) {
        jsonContainer.innerHTML = '<p style="color:red">Lỗi hiển thị dữ liệu chi tiết.</p>';
    }

    // Hiển thị File
    const fileContainer = document.getElementById('ps_file_container');
    fileContainer.innerHTML = '';
    if (item.FileDinhKem && item.FileDinhKem !== 'null') {
        const fileName = item.FileDinhKem.split('/').pop();
        fileContainer.innerHTML = `
            <div class="admin-existing-file-item">
                <i class="fa-solid fa-paperclip" style="margin-right:5px; color: #666;"></i> 
                <a href="${API_URL}${item.FileDinhKem}" target="_blank" style="color:#0072ff; text-decoration:none; font-weight:bold;">${fileName}</a>
            </div>
        `;
    } else {
        fileContainer.innerHTML = '<span style="color:#999; font-style:italic">Không có tài liệu đính kèm.</span>';
    }

    const actionArea = document.getElementById('ps_action_area');
    actionArea.style.display = (item.TrangThai === 'Chờ xử lý') ? 'block' : 'none';

    document.getElementById('adminPublicServiceModal').style.display = 'block';
}

async function processPublicService(status) {
    if (!currentSelectedPSID) return;
    
    const ghiChu = document.getElementById('ps_ghiChu').value;
    if (status === 'Từ chối' && !ghiChu.trim()) {
        alert('Vui lòng nhập lý do từ chối vào ô Ghi chú.');
        return;
    }

    if (!confirm(`Xác nhận chuyển trạng thái hồ sơ thành: ${status}?`)) return;

    try {
        const data = {
            id_hoso: currentSelectedPSID,
            trangThai: status,
            ghiChu: ghiChu
        };

        const res = await fetchWithToken('/api/public-service/admin/status', 'PUT', data);
        
        alert(res.message);
        document.getElementById('adminPublicServiceModal').style.display = 'none';
        loadPublicServiceList(); 
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// 10.7. (ĐÃ SỬA LỖI TÌM KIẾM ID) Tìm kiếm hồ sơ Dịch vụ công
function setupPublicServiceSearch() {
    const input = document.getElementById('publicServiceSearchInput');
    const btn = document.getElementById('publicServiceSearchButton');
    
    const performSearch = () => {
        const rawTerm = input.value.toLowerCase().trim();
        // Loại bỏ dấu # để tìm ID chính xác (VD: nhập #12 vẫn tìm ra ID 12)
        const termForId = rawTerm.replace('#', '');

        if (!rawTerm) {
            renderPublicServiceTable(currentPublicServiceList);
            return;
        }

        const filtered = currentPublicServiceList.filter(item => {
            // 1. Tìm theo Tên người nộp (Kiểm tra null trước)
            const matchName = item.NguoiNop && item.NguoiNop.toLowerCase().includes(rawTerm);
            
            // 2. Tìm theo CCCD
            const matchCCCD = item.CCCDNguoiNop && item.CCCDNguoiNop.includes(rawTerm);
            
            // 3. Tìm theo Mã Hồ sơ (Chuyển ID sang chuỗi để so sánh)
            const matchID = item.ID_HoSo && item.ID_HoSo.toString() === termForId; 
            // Hoặc dùng .includes(termForId) nếu muốn tìm gần đúng (VD: gõ 1 ra 1, 10, 11...)
            
            return matchName || matchCCCD || matchID;
        });

        renderPublicServiceTable(filtered);
    };

    if(btn) btn.addEventListener('click', performSearch);
    if(input) input.addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(); });
}
// =========================================
// --- HELPERS ---
// =========================================
async function fetchWithToken(url, method = 'GET', body = null, isFormData = false) {
    const token = localStorage.getItem('userToken'); 
    const headers = { 'Authorization': `Bearer ${token}` };
    const config = { method: method, headers: headers };

    if (body) {
        if (isFormData) { config.body = body; } 
        else { headers['Content-Type'] = 'application/json'; config.body = JSON.stringify(body); }
    }

    const res = await fetch(`${API_URL}${url}`, config);
    if (!res.ok) throw new Error('Lỗi kết nối server hoặc phiên hết hạn');
    const text = await res.text();
    return text ? JSON.parse(text) : {};
}

function formatDate(dateString, format = 'DD/MM/YYYY') {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (format === 'YYYY-MM-DD') return date.toISOString().split('T')[0];
    return date.toLocaleDateString('vi-VN');
}
// =================================================================
// --- MODULE QUẢN TRỊ HỆ THỐNG (SYSTEM ADMIN) - CÓ TÌM KIẾM ---
// =================================================================

// Biến lưu danh sách User để tìm kiếm offline
let currentSystemUserList = [];

function initSystemModule() {
    console.log("Đang khởi tạo module Quản trị hệ thống...");
    loadSystemStats();
    loadSystemUsers();
    loadBackupHistory();
    loadSystemLogs();
    setupSystemUserSearch(); // <--- Kích hoạt tìm kiếm

    // Gán sự kiện nút Backup
    const btnBackup = document.getElementById('btn-trigger-backup');
    if(btnBackup) {
        const newBtn = btnBackup.cloneNode(true);
        btnBackup.parentNode.replaceChild(newBtn, btnBackup);
        newBtn.addEventListener('click', triggerSystemBackup);
    }
}

// 1. Tải thông số hệ thống
async function loadSystemStats() {
    try {
        const stats = await fetchWithToken('/api/admin/system/stats', 'GET');
        document.getElementById('sys-ram').textContent = `${stats.ramUsed} / ${stats.ramTotal}`;
        document.getElementById('sys-db-size').textContent = stats.dbSize;
        document.getElementById('sys-uptime').textContent = stats.uptime;
    } catch (error) { console.error('Lỗi tải stats:', error); }
}

// 2. Tải danh sách User (Lưu vào biến toàn cục)
async function loadSystemUsers() {
    const tbody = document.getElementById('sys-user-list');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Đang tải...</td></tr>';

    try {
        const users = await fetchWithToken('/api/admin/system/users', 'GET');
        currentSystemUserList = users; // Lưu lại để tìm kiếm
        renderSystemUserTable(users);  // Hiển thị ra bảng
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-red-500">Lỗi tải danh sách</td></tr>';
    }
}

// Hàm hiển thị bảng User (Tách riêng để dùng cho cả Search)
function renderSystemUserTable(list) {
    const tbody = document.getElementById('sys-user-list');
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Không tìm thấy người dùng nào.</td></tr>';
        return;
    }

    const currentAdminName = document.getElementById('admin-name').textContent;

    list.forEach(user => {
        const isSelf = user.TenDangNhap === currentAdminName;
        let actionHtml = '';
        
        if (!isSelf) {
            if (user.VaiTro === 'Admin') {
                actionHtml = `<button class="btn-admin-delete" onclick="changeUserRole(${user.ID_TK}, 'User')">Xuống User</button>`;
            } else {
                actionHtml = `<button class="btn-admin-edit" onclick="changeUserRole(${user.ID_TK}, 'Admin')">Lên Admin</button>`;
            }
        } else {
            actionHtml = `<span class="text-gray-400">Chính bạn</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.ID_TK}</td>
            <td><strong>${user.TenDangNhap}</strong></td>
            <td>${user.HoTen || '<i style="color:#999">Chưa cập nhật</i>'}</td>
            <td><span class="status-badge ${user.VaiTro === 'Admin' ? 'status-approved' : 'status-none'}">${user.VaiTro}</span></td>
            <td>${actionHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- LOGIC TÌM KIẾM USER ---
function setupSystemUserSearch() {
    const input = document.getElementById('sysUserSearchInput');
    const btn = document.getElementById('sysUserSearchButton');

    const performSearch = () => {
        const term = input.value.toLowerCase().trim();
        if (!term) {
            renderSystemUserTable(currentSystemUserList); // Reset về danh sách đầy đủ
            return;
        }
        // Lọc danh sách
        const filtered = currentSystemUserList.filter(user => 
            (user.TenDangNhap && user.TenDangNhap.toLowerCase().includes(term)) || 
            (user.HoTen && user.HoTen.toLowerCase().includes(term)) ||
            user.ID_TK.toString().includes(term)
        );
        renderSystemUserTable(filtered);
    };

    if(btn) btn.onclick = performSearch;
    if(input) input.addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(); });
}

// Hàm đổi quyền
window.changeUserRole = async function(id_tk, newRole) {
    if(!confirm(`Bạn chắc chắn muốn đổi quyền thành viên này sang ${newRole}?`)) return;
    try {
        await fetchWithToken('/api/admin/system/users/role', 'PUT', { id_tk, newRole });
        alert('Đổi quyền thành công!');
        loadSystemUsers(); // Tải lại danh sách
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// 3. Backup & Restore
async function loadBackupHistory() {
    const container = document.getElementById('sys-backup-list');
    if(!container) return;
    container.innerHTML = '<p>Đang tải...</p>';

    try {
        const list = await fetchWithToken('/api/admin/system/backups', 'GET');
        container.innerHTML = '';
        if(list.length === 0) {
            container.innerHTML = '<p class="italic text-gray-500">Chưa có bản backup nào.</p>';
            return;
        }
        list.forEach(item => {
            const div = document.createElement('div');
            div.className = 'admin-edu-item';
            div.style.padding = '10px';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <strong><i class="fa-solid fa-file-zipper"></i> ${item.TenFile}</strong>
                    <span class="status-badge status-approved">${item.TrangThai}</span>
                </div>
                <div style="font-size:0.85em; color:#666; margin-top:5px;">
                    ${formatDate(item.ThoiGian)} | Size: ${item.KichThuoc} | By: ${item.NguoiThucHien}
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) { container.innerHTML = 'Lỗi tải backup'; }
}

async function triggerSystemBackup() {
    const btn = document.getElementById('btn-trigger-backup');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    try {
        const res = await fetchWithToken('/api/admin/system/backup', 'POST');
        alert(res.message);
        loadBackupHistory();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Backup Ngay';
    }
}

// 4. System Logs
async function loadSystemLogs() {
    const container = document.getElementById('sys-log-list');
    if(!container) return;
    try {
        const list = await fetchWithToken('/api/admin/system/logs', 'GET');
        container.innerHTML = '';
        if(list.length === 0) {
            container.innerHTML = '<p class="italic">Hệ thống hoạt động ổn định. Không có log lỗi.</p>';
            return;
        }
        list.forEach(log => {
            const color = log.LoaiLog === 'Error' ? 'red' : 'orange';
            const div = document.createElement('div');
            div.style.borderBottom = '1px solid #eee';
            div.style.padding = '8px 0';
            div.innerHTML = `
                <div style="color:${color}; font-weight:bold;">[${log.LoaiLog}] ${formatDate(log.ThoiGian)}</div>
                <div>${log.NoiDung}</div>
            `;
            container.appendChild(div);
        });
    } catch (e) { container.innerHTML = 'Lỗi tải logs'; }
}

// Helper: open preview for an admin file URL using the existing adminEduFileModal
window.openAdminEduFileModalUrl = function(url) {
    const modal = document.getElementById('adminEduFileModal');
    const title = document.getElementById('adminEduFileModalTitle');
    const content = document.getElementById('adminEduFileModalContent');
    title.textContent = 'Xem file đính kèm';
    // show image or link depending on content-type by extension
    const ext = url.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) {
        content.innerHTML = `<img src="${url}" style="max-width:100%; height:auto; border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,0.12);">`;
    } else {
        const name = url.split('/').pop();
        content.innerHTML = `<div style=\"padding:10px;\"><a href=\"${url}\" target=\"_blank\">Mở file: ${name}</a></div>`;
    }
    modal.style.display = 'block';
}
// --- CẬP NHẬT: Tải Thống kê Dashboard (Đã thêm Log kiểm tra) ---
async function loadDashboardStats() {
    console.log("--> Đang bắt đầu tải thống kê Dashboard..."); // Log kiểm tra

    try {
        // Gọi API
        const stats = await fetchWithToken('/api/admin/system/dashboard-stats', 'GET');
        console.log("--> Dữ liệu Dashboard nhận được:", stats); // Xem dữ liệu trả về

        // 1. Tổng công dân
        const elTotal = document.getElementById('stat-total-users');
        if (elTotal) elTotal.textContent = stats.totalUsers || 0;
            
        // 2. Hồ sơ mới tháng này
        const elNew = document.getElementById('stat-new-users');
        if (elNew) elNew.textContent = stats.newUsers || 0;
            
        // 3. Hồ sơ DVC chờ xử lý
        const elPending = document.getElementById('stat-pending-services');
        if (elPending) elPending.textContent = stats.pendingServices || 0;

    } catch (error) {
        console.error('Lỗi tải Dashboard:', error);
    }
}