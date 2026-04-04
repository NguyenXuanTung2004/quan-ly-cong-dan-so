// frontend/script.js

// Chờ cho toàn bộ nội dung HTML được tải xong
document.addEventListener('DOMContentLoaded', () => {

    // Tìm nút bấm và nơi hiển thị kết quả
    const apiButton = document.getElementById('callApiButton');
    const responseDiv = document.getElementById('apiResponse');

    // Gán sự kiện "click" cho nút bấm
    apiButton.addEventListener('click', () => {
        
        // Sử dụng 'fetch' để gọi đến API của backend
        // **QUAN TRỌNG:** Địa chỉ phải khớp với server.js (http://localhost:3000/api/test)
        fetch('http://localhost:3000/api/test')
            .then(response => {
                // Chuyển đổi dữ liệu trả về thành JSON
                return response.json();
            })
            .then(data => {
                // Hiển thị thông báo từ backend lên trang web
                responseDiv.textContent = data.message;
            })
            .catch(error => {
                // Xử lý nếu có lỗi
                console.error('Lỗi khi gọi API:', error);
                responseDiv.textContent = 'Có lỗi xảy ra, vui lòng xem console.';
            });
    });
});