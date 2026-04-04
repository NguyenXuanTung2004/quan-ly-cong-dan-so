// frontend/health.js

const API_URL = 'http://localhost:3000';
let currentHealthData = {}; // Biến toàn cục lưu dữ liệu

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('userToken');
    if (!token) { window.location.href = 'login.html'; return; }

    loadHealthData(token);
    setupGeneralModals(token);
    setupExamModals(token);
    setupVaccineModals(token);
});

// --- LOAD DATA ---
async function loadHealthData(token) {
    try {
        const res = await fetch(`${API_URL}/api/health/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        currentHealthData = data; // Lưu lại để dùng khi sửa

        // 1. Info & BHYT
        document.getElementById('blood-type').textContent = data.NhomMau || '--';
        document.getElementById('medical-history-text').textContent = data.TienSuBenh || 'Chưa có ghi nhận.';
        document.getElementById('bhyt-number').textContent = data.SoBHYT || 'CHƯA CẬP NHẬT';
        document.getElementById('bhyt-place').textContent = data.NoiDangKyKCB || '---';
        document.getElementById('bhyt-expiry').textContent = data.NgayHetHanBHYT ? `HSD: ${formatDate(data.NgayHetHanBHYT)}` : 'HSD: ---';
        
        if(data.AnhBHYT && data.AnhBHYT !== 'null') {
            document.getElementById('bhyt-image-container').style.display = 'block';
            document.getElementById('bhyt-img-display').src = `${API_URL}/${data.AnhBHYT.replace(/\\/g, '/')}`;
        }

        // 2. Render Lists
        renderExams(data.khamBenhList);
        renderVaccines(data.tiemChungList);

    } catch (error) {
        console.error(error);
        document.getElementById('exam-timeline').innerHTML = '<div style="padding:20px; text-align:center;">Lỗi tải dữ liệu.</div>';
    }
}

// --- RENDER FUNCTIONS ---
function renderExams(list) {
    const container = document.getElementById('exam-timeline');
    container.innerHTML = '';
    if (!list || list.length === 0) {
        container.innerHTML = '<div style="padding:15px; color:#999;">Chưa có lịch sử khám bệnh.</div>';
        return;
    }

    list.forEach(item => {
        // Parse Files
        let filesHtml = '';
        let fileList = item.FileDinhKem || [];
        if (typeof fileList === 'string') { try { fileList = JSON.parse(fileList); } catch(e) { fileList = []; } }
        if (Array.isArray(fileList) && fileList.length > 0) {
            filesHtml = '<div class="file-list">';
            fileList.forEach(fp => {
                filesHtml += `<a href="${API_URL}/${fp.replace(/\\/g, '/')}" target="_blank" class="file-chip"><i class="fa-solid fa-paperclip"></i> File</a>`;
            });
            filesHtml += '</div>';
        }

        const html = `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-date">${formatDate(item.NgayKham)}</div>
                <div class="record-card">
                    <div class="record-actions">
                        <button class="btn-action-mini" onclick="openExamModal(${item.ID_KhamBenh})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-action-mini delete" onclick="deleteExam(${item.ID_KhamBenh})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <span class="record-title">${item.ChanDoan}</span>
                    <div class="record-hospital"><i class="fa-solid fa-hospital"></i> ${item.CoSoYTe}</div>
                    <div class="record-doctor">BS. ${item.BacSi || '---'}</div>
                    ${item.PhacDoDieuTri ? `<div class="record-diagnosis"><strong>Phác đồ:</strong> ${item.PhacDoDieuTri}</div>` : ''}
                    ${filesHtml}
                </div>
            </div>`;
        container.innerHTML += html;
    });
}

function renderVaccines(list) {
    const container = document.getElementById('vaccine-timeline');
    container.innerHTML = '';
    if (!list || list.length === 0) {
        container.innerHTML = '<div style="padding:15px; color:#999;">Chưa có lịch sử tiêm chủng.</div>';
        return;
    }

    list.forEach(item => {
        let fileHtml = '';
        if (item.FileXacMinh && item.FileXacMinh !== 'null') {
            fileHtml = `<div class="file-list"><a href="${API_URL}/${item.FileXacMinh.replace(/\\/g, '/')}" target="_blank" class="file-chip"><i class="fa-solid fa-certificate"></i> Chứng nhận</a></div>`;
        }

        const html = `
            <div class="timeline-item">
                <div class="timeline-dot" style="background: #ff9800;"></div>
                <div class="timeline-date">${formatDate(item.NgayTiem)}</div>
                <div class="record-card" style="border-left-color: #ff9800;">
                    <div class="record-actions">
                        <button class="btn-action-mini" onclick="openVaccineModal(${item.ID_TiemChung})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-action-mini delete" onclick="deleteVaccine(${item.ID_TiemChung})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <span class="record-title">${item.TenVacXin}</span>
                    <div class="record-hospital"><i class="fa-solid fa-location-dot"></i> ${item.DonVi}</div>
                    ${fileHtml}
                </div>
            </div>`;
        container.innerHTML += html;
    });
}

// --- SETUP MODALS & LOGIC CRUD ---

// 1. Modal Info & BHYT
function setupGeneralModals(token) {
    // Info
    document.getElementById('btnEditInfo').onclick = () => {
        document.getElementById('edit-blood').value = currentHealthData.NhomMau || '';
        document.getElementById('edit-history').value = currentHealthData.TienSuBenh || '';
        document.getElementById('infoModal').classList.add('active');
    };
    document.getElementById('infoForm').onsubmit = async (e) => {
        e.preventDefault();
        const body = { id_yte: currentHealthData.ID_YTe, nhomMau: document.getElementById('edit-blood').value, tienSuBenh: document.getElementById('edit-history').value };
        await sendRequest(`${API_URL}/api/health/general`, 'PUT', body, token);
    };

    // BHYT
    document.getElementById('btnEditBHYT').onclick = () => {
        document.getElementById('edit-bhyt-num').value = currentHealthData.SoBHYT || '';
        document.getElementById('edit-bhyt-place').value = currentHealthData.NoiDangKyKCB || '';
        if(currentHealthData.NgayHetHanBHYT) document.getElementById('edit-bhyt-exp').value = currentHealthData.NgayHetHanBHYT.split('T')[0];
        document.getElementById('bhytModal').classList.add('active');
    };
    document.getElementById('bhytForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('id_yte', currentHealthData.ID_YTe);
        fd.append('soBHYT', document.getElementById('edit-bhyt-num').value);
        fd.append('noiDangKyKCB', document.getElementById('edit-bhyt-place').value);
        fd.append('ngayHetHanBHYT', document.getElementById('edit-bhyt-exp').value);
        const file = document.getElementById('edit-bhyt-img').files[0];
        if(file) fd.append('anhBHYT', file);
        await sendRequest(`${API_URL}/api/health/bhyt`, 'PUT', fd, token, true);
    };

    // Close buttons
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.onclick = function() { this.closest('.modal-overlay').classList.remove('active'); }
    });
}

// 2. Exam Logic
function setupExamModals(token) {
    const modal = document.getElementById('examModal');
    
    document.getElementById('btnAddExam').onclick = () => openExamModal(null);
    
    window.openExamModal = (id) => {
        const form = document.getElementById('examForm');
        form.reset();
        document.getElementById('examId').value = id || '';
        document.getElementById('examModalTitle').textContent = id ? 'Cập nhật lịch sử khám' : 'Thêm mới lịch sử khám';
        
        if(id) {
            const item = currentHealthData.khamBenhList.find(i => i.ID_KhamBenh === id);
            if(item) {
                document.getElementById('examDate').value = item.NgayKham.split('T')[0];
                document.getElementById('examPlace').value = item.CoSoYTe;
                document.getElementById('examDoctor').value = item.BacSi || '';
                document.getElementById('examDiagnosis').value = item.ChanDoan;
                document.getElementById('examNote').value = item.PhacDoDieuTri || '';
                // (Files cũ xử lý phức tạp hơn, ở đây ta chỉ cho upload thêm file mới)
            }
        }
        modal.classList.add('active');
    };

    document.getElementById('examForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('examId').value;
        const fd = new FormData();
        fd.append('id_yte', currentHealthData.ID_YTe);
        fd.append('ngayKham', document.getElementById('examDate').value);
        fd.append('coSoYTe', document.getElementById('examPlace').value);
        fd.append('bacSi', document.getElementById('examDoctor').value);
        fd.append('chanDoan', document.getElementById('examDiagnosis').value);
        fd.append('phacDoDieuTri', document.getElementById('examNote').value);
        
        const files = document.getElementById('examFiles').files;
        for(let i=0; i<files.length; i++) fd.append('filesDinhKem', files[i]);

        // Nếu có ID -> Sửa (PUT), không ID -> Thêm (POST)
        const url = id ? `${API_URL}/api/health/exam/${id}` : `${API_URL}/api/health/exam`;
        const method = id ? 'PUT' : 'POST';
        
        // Nếu sửa cần gửi thêm danh sách file cũ để giữ lại (Ở đây làm đơn giản là không gửi, server giữ nguyên nếu không xóa)
        if(id) {
             const item = currentHealthData.khamBenhList.find(i => i.ID_KhamBenh == id);
             let oldFiles = item.FileDinhKem || [];
             if(typeof oldFiles === 'string') try { oldFiles = JSON.parse(oldFiles); } catch(e){}
             if(Array.isArray(oldFiles)) oldFiles.forEach(f => fd.append('existingFiles', f));
        }

        await sendRequest(url, method, fd, token, true);
        modal.classList.remove('active');
    };

    window.deleteExam = async (id) => {
        if(confirm('Xóa lịch sử này?')) await sendRequest(`${API_URL}/api/health/exam/${id}`, 'DELETE', null, token);
    };
}

// 3. Vaccine Logic
function setupVaccineModals(token) {
    const modal = document.getElementById('vaccineModal');
    
    document.getElementById('btnAddVaccine').onclick = () => openVaccineModal(null);

    window.openVaccineModal = (id) => {
        const form = document.getElementById('vaccineForm');
        form.reset();
        document.getElementById('vaccineId').value = id || '';
        document.getElementById('vaccineModalTitle').textContent = id ? 'Cập nhật tiêm chủng' : 'Thêm mới tiêm chủng';

        if(id) {
            const item = currentHealthData.tiemChungList.find(i => i.ID_TiemChung === id);
            if(item) {
                document.getElementById('vaccineName').value = item.TenVacXin;
                document.getElementById('vaccinePlace').value = item.DonVi;
                document.getElementById('vaccineDate').value = item.NgayTiem.split('T')[0];
            }
        }
        modal.classList.add('active');
    };

    document.getElementById('vaccineForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('vaccineId').value;
        const fd = new FormData();
        fd.append('id_yte', currentHealthData.ID_YTe);
        fd.append('tenVacXin', document.getElementById('vaccineName').value);
        fd.append('donVi', document.getElementById('vaccinePlace').value);
        fd.append('ngayTiem', document.getElementById('vaccineDate').value);
        const file = document.getElementById('vaccineFile').files[0];
        if(file) fd.append('fileXacMinh', file);

        const url = id ? `${API_URL}/api/health/vaccination/${id}` : `${API_URL}/api/health/vaccination`;
        const method = id ? 'PUT' : 'POST';
        
        await sendRequest(url, method, fd, token, true);
        modal.classList.remove('active');
    };

    window.deleteVaccine = async (id) => {
        if(confirm('Xóa mũi tiêm này?')) await sendRequest(`${API_URL}/api/health/vaccination/${id}`, 'DELETE', null, token);
    };
}

// --- HELPER ---
async function sendRequest(url, method, body, token, isFormData = false) {
    const options = { method: method, headers: { 'Authorization': `Bearer ${token}` } };
    if (body) {
        if (isFormData) options.body = body;
        else { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    }
    try {
        const res = await fetch(url, options);
        if (res.ok) { alert('Thành công!'); loadHealthData(token); }
        else alert('Có lỗi xảy ra!');
    } catch (e) { console.error(e); alert('Lỗi kết nối.'); }
}

function formatDate(d) { if(!d) return ''; return new Date(d).toLocaleDateString('vi-VN'); }