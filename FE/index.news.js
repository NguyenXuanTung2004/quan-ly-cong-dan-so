document.addEventListener('DOMContentLoaded', () => {
    // DANH SÁCH TIN TỨC (Đã cập nhật ảnh Bài 1 và Bài 6)
    const allNews = [
        {
            title: 'Thành phố Hồ Chí Minh ra mắt ứng dụng Công dân số',
            description: 'Một chạm kết nối chính quyền: Tra cứu hồ sơ, phản ánh kiến nghị và tích hợp giấy tờ số ngay trên điện thoại.',
            url: 'https://sonoivu.hochiminhcity.gov.vn/',
            // BÀI 1: Ảnh Landmark 81 - Biểu tượng TP.HCM (Nguồn Unsplash ổn định)
            image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=1200&auto=format&fit=crop', 
            date: '14/11/2024',
            tag: 'Nổi bật',
            tagClass: 'badge-hot',
            source: 'Sở Nội Vụ'
        },
        {
            title: 'Hướng dẫn tích hợp giấy tờ vào VNeID mức độ 2',
            description: 'Chi tiết các bước tự tích hợp Giấy phép lái xe, Bảo hiểm y tế vào ứng dụng định danh điện tử tại nhà.',
            url: 'https://thuvienphapluat.vn/',
            image: 'https://picsum.photos/id/60/800/600', // Ảnh văn phòng/giấy tờ
            date: '05/12/2024',
            tag: 'Hướng dẫn',
            tagClass: 'badge-guide',
            source: 'Thư viện Pháp luật'
        },
        {
            title: 'TP.HCM: 100% thủ tục hành chính sẽ được số hóa',
            description: 'Mục tiêu đến 2025: Người dân không cần mang bản giấy khi đi làm thủ tục hành chính tại các cơ quan.',
            url: 'https://baochinhphu.vn/',
            image: 'https://picsum.photos/id/3/800/600', // Ảnh công nghệ
            date: '02/12/2024',
            tag: 'Chính sách',
            tagClass: 'badge-policy',
            source: 'Báo Chính Phủ'
        },
        {
            title: 'Review App Công dân số: Những tính năng đáng giá',
            description: 'Trải nghiệm thực tế các tính năng: Bản đồ số, Tra cứu vi phạm giao thông, Đăng ký tạm trú online.',
            url: 'https://tuoitre.vn/',
            image: 'https://picsum.photos/id/160/800/600', // Ảnh điện thoại
            date: '01/12/2024',
            tag: 'Công nghệ',
            tagClass: 'badge-tech',
            source: 'Tuổi Trẻ'
        },
        {
            title: 'Cảnh báo lừa đảo qua các ứng dụng giả mạo',
            description: 'Tuyệt đối không tải app qua đường link lạ gửi qua tin nhắn. Chỉ tải trên kho ứng dụng chính thức.',
            url: 'https://congan.hochiminhcity.gov.vn/',
            image: 'https://picsum.photos/id/532/800/600', // Ảnh tech/code
            date: '30/11/2024',
            tag: 'Cảnh báo',
            tagClass: 'badge-warning',
            source: 'Công an TP.HCM'
        },
        {
            title: 'Lợi ích thiết thực khi sử dụng Dịch vụ công trực tuyến',
            description: 'Tiết kiệm thời gian đi lại, chi phí in ấn và dễ dàng theo dõi tiến độ xử lý hồ sơ mọi lúc mọi nơi.',
            url: 'https://dichvucong.gov.vn/',
            // BÀI 6: Ảnh làm việc trên Laptop/Văn phòng (Thể hiện tính chất Online)
            image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800&auto=format&fit=crop', 
            date: '28/11/2024',
            tag: 'Tiện ích',
            tagClass: 'badge-policy',
            source: 'Dịch vụ công'
        },
        {
            title: 'Đăng ký tạm trú tại nhà chỉ mất 5 phút',
            description: 'Không cần ra công an phường, người dân có thể khai báo tạm trú ngay trên ứng dụng VNeID.',
            url: 'https://dantri.com.vn/',
            image: 'https://picsum.photos/id/234/800/600', // Ảnh nhà cửa
            date: '27/11/2024',
            tag: 'Đời sống',
            tagClass: 'badge-guide',
            source: 'Dân Trí'
        }
    ];

    const featuredEl = document.getElementById('news-featured');
    const gridEl = document.getElementById('news-grid');
    // Ảnh dự phòng màu xám
    const FALLBACK_IMAGE = 'https://placehold.co/600x400/e0e0e0/888888?text=Tin+tuc';

    if (!featuredEl || !gridEl) return;

    function escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
    }

    function renderNews() {
        // 1. Render TIN NỔI BẬT (Bài đầu tiên)
        const first = allNews[0];
        featuredEl.innerHTML = `
            <article class="news-card featured-card" data-aos="fade-up">
                <div class="news-img-wrapper">
                    <a href="${first.url}" target="_blank">
                        <img src="${first.image}" alt="${escapeHtml(first.title)}" onerror="this.src='${FALLBACK_IMAGE}'">
                    </a>
                    <span class="news-badge ${first.tagClass}">${first.tag}</span>
                </div>
                <div class="news-body">
                    <div class="news-meta">
                        <span><i class="fa-solid fa-building"></i> ${escapeHtml(first.source)}</span>
                        <span><i class="fa-regular fa-clock"></i> ${first.date}</span>
                    </div>
                    <h3 class="news-title"><a href="${first.url}" target="_blank">${escapeHtml(first.title)}</a></h3>
                    <p class="news-desc">${escapeHtml(first.description)}</p>
                    <div style="margin-top: auto;">
                        <a href="${first.url}" target="_blank" class="btn btn-primary" style="display:inline-block; margin-top:15px;">
                            Xem chi tiết <i class="fa-solid fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
            </article>
        `;

        // 2. Render CÁC TIN CÒN LẠI (Dạng lưới)
        gridEl.innerHTML = '';
        allNews.slice(1).forEach((item, index) => {
            const col = document.createElement('div');
            
            col.innerHTML = `
                <article class="news-card" data-aos="fade-up" data-aos-delay="${index * 50}">
                    <div class="news-img-wrapper">
                        <a href="${item.url}" target="_blank">
                            <img src="${item.image}" alt="${escapeHtml(item.title)}" onerror="this.src='${FALLBACK_IMAGE}'">
                        </a>
                        <span class="news-badge ${item.tagClass}">${item.tag}</span>
                    </div>
                    <div class="news-body">
                        <div class="news-meta">
                            <span><i class="fa-solid fa-pen-nib"></i> ${escapeHtml(item.source)}</span>
                            <span>${item.date}</span>
                        </div>
                        <h4 class="news-title">
                            <a href="${item.url}" target="_blank">${escapeHtml(item.title)}</a>
                        </h4>
                    </div>
                </article>
            `;
            gridEl.appendChild(col);
        });
    }

    renderNews();

    // --- Header auth UI: Update icon style
 // --- Header auth UI
    function setupHeaderAuth() {
        const loginLink = document.getElementById('loginLink');
        if (!loginLink) return;

        const userToken = localStorage.getItem('userToken');
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');

        if (userToken && userInfo && (userInfo.HoTen || userInfo.hoTen || userInfo.name)) {
            const name = userInfo.HoTen || userInfo.hoTen || userInfo.name || 'User';

            // Container
            const container = document.createElement('div');
            container.className = 'user-profile-area';

            // Tên User
            const userText = document.createElement('div');
            userText.className = 'welcome-text';
            userText.innerHTML = `<span>Xin chào,</span> ${name}`;

            // Group Icon
            const iconGroup = document.createElement('div');
            iconGroup.className = 'action-icons-group';

            // Nút Hồ sơ
            const dashLink = document.createElement('a');
            dashLink.href = 'dashboard.html';
            dashLink.className = 'icon-btn-action';
            dashLink.title = 'Hồ sơ cá nhân';
            dashLink.innerHTML = '<i class="fa-regular fa-user"></i>';

            // Nút Đăng xuất
            const logoutBtn = document.createElement('button');
            logoutBtn.className = 'icon-btn-action logout';
            logoutBtn.title = 'Đăng xuất';
            logoutBtn.innerHTML = '<i class="fa-solid fa-power-off"></i>';
            
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('userToken');
                localStorage.removeItem('userInfo');
                window.location.href = 'index.html';
            });

            iconGroup.appendChild(dashLink);
            iconGroup.appendChild(logoutBtn);

            container.appendChild(userText);
            container.appendChild(iconGroup);

            loginLink.replaceWith(container);
        }
    }

    setupHeaderAuth();
});