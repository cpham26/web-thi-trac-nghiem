# NovaQuiz v4.2 - Nền Tảng Ôn Thi & Thi Thử Trắc Nghiệm Thông Minh

Một ứng dụng web trắc nghiệm hiện đại, tối ưu trải nghiệm học tập và thi cử với giao diện **Crystal Liquid Glass & 3D Optics v4.2** cao cấp, được xây dựng hoàn chỉnh bằng HTML5, CSS3 hiện đại và JavaScript thuần (Vanilla JS), không cần backend server phức tạp, chạy trực tiếp trên mọi trình duyệt (Chrome, Cốc Cốc, Edge, Safari, Mobile).

---

## 🚀 Các Tính Năng Đột Phá Bản v4.2

### 1. 📄 Engine Đọc File Word (.docx) & PDF (.pdf) Siêu Chuẩn Xác
- **Trích xuất thông minh từ Word (.docx)**:
  - Khắc phục triệt để lỗi câu hỏi in đậm bị nhận diện nhầm thành đáp án đúng.
  - Tự động tách câu hỏi và các phương án A, B, C, D nằm cùng một dòng hoặc trong bảng biểu.
  - Nhận diện phương án có màu sắc (đỏ, xanh, tím...), highlight nền hoặc gạch chân để gán đáp án chính xác 100%.
  - Giữ nguyên toàn bộ hình ảnh minh họa chất lượng cao trong đề thi.
- **Bóc tách mạnh mẽ từ PDF (.pdf)**:
  - Tự động nhận diện cấu trúc đề thi **2 cột (Two-Column Layout)** chuẩn Bộ Giáo Dục, đọc riêng từng cột từ trên xuống dưới mà không bị xáo trộn nội dung.
  - Loại bỏ hoàn toàn header, footer và số trang rác.
  - Nhận diện font chữ in đậm (Bold) làm căn cứ xác định đáp án đúng.
  - Tự động quét và ghép nối bảng đáp án riêng ở cuối tài liệu.

### 2. 💎 Giao Diện Kính Lỏng (Crystal Liquid Glass) & Nút Bấm Đồng Nhất
- **Ngôn ngữ thiết kế đồng bộ tuyệt đối**: Quy chuẩn toàn bộ hệ thống nút bấm theo chuẩn bo góc **12px Squircle Kính Lỏng**, xóa bỏ hoàn toàn tình trạng nút bo tròn lệch pha hoặc kích thước không cân đối.
- **Tỉ lệ vàng kích thước**: Chiều cao nút bấm và thanh công cụ được chuẩn hóa đồng đều (Small 36px, Regular 42px, Large 48px), tạo cảm giác hài hòa, mượt mà và sang trọng bậc nhất.
- **Tinh giản 2 chế độ Sáng ☀️ & Tối 🌙**: Tập trung vào 2 giao diện màu sắc tương phản cao, loại bỏ chế độ Sepia ít dùng.

### 3. 🎯 Chế Độ Ôn Tập (Practice Mode) Thông Minh
- **Không áp lực thời gian**: Tự do ôn luyện kiến thức bao lâu tùy thích, bỏ giới hạn thời gian thi.
- **Bộ đếm Đúng / Sai trực tiếp**: Hiển thị ngay số câu Đúng (xanh ngọc) và số câu Sai (đỏ ruby) trên thanh trạng thái phòng thi theo thời gian thực.
- **Bỏ lật thẻ trùng lặp**: Loại bỏ nút lật thẻ trong phòng ôn tập để tập trung tối đa vào trải nghiệm làm bài trắc nghiệm (Flashcard đã có riêng ở chế độ Thẻ ghi nhớ 3D).

### 4. 🔄 Nút "Làm Lại Từ Đầu" & Tự Động Chuyển Câu Sau 0.5 Giây
- **Làm lại bài thi 1-Click**: Nút bấm làm mới trực tiếp trên thanh công cụ và danh sách câu hỏi, cho phép xóa bài làm và bắt đầu lại từ câu số 1 ngay lập tức.
- **Tự động chuyển câu sau 0.5s**: Bổ sung mốc thời gian 0.5 giây cực kỳ lý tưởng cho những ai thích làm bài nhanh gọn mà vẫn kịp nhìn đáp án.

---

## 🌟 Toàn Bộ Hệ Thống Tính Năng Nổi Bật

### 1. Form Tạo & Nhập Đề Thi Đa Năng
- **Đọc trực tiếp từ file Microsoft Word (.docx)**:
  - 📄 Tải trực tiếp file Word (.docx) từ máy tính lên mà không cần chuyển đổi định dạng.
  - 🖼️ **Nhận diện hình ảnh trong file Word**: Tự động trích xuất các hình ảnh minh họa trong câu hỏi, lưu trữ và hiển thị trực quan trong bài thi. Người dùng có thể bấm vào ảnh để phóng to (Lightbox Zoom).
  - 🎨 **Tự động nhận diện câu hỏi tô màu (Color & Highlight Recognition)**:
    - Nhận biết các đáp án được **Tô màu chữ** (Đỏ `#FF0000`, Xanh lá `#00B050`, Xanh dương, Tím...) hoặc **Màu nền Highlight** (Vàng, Xanh dạ quang...).
    - Nhận biết các đáp án có **Gạch chân (Underline)** hoặc **In đậm (Bold)**.
    - Tự động gắn dấu đáp án đúng `*` chuẩn xác 100%, bảo toàn nội dung câu hỏi và các phương án.
  - 🔤 **Tự động thêm A, B, C, D cho câu hỏi bị thiếu**: Nếu đề thi trong Word hoặc văn bản dán vào không có chữ A, B, C, D (ví dụ chỉ có dấu gạch đầu dòng `-`, `•` hoặc các dòng văn bản trơn), hệ thống sẽ tự động thêm `A.`, `B.`, `C.`, `D.` tương ứng!
  - Nút **"Nạp thử file Word mẫu có tô màu & hình ảnh"** ngay trong giao diện để bạn trải nghiệm thử với 1 cú click!

- **🤖 Bộ Lọc AI Thông Minh (AI Smart Cleaner & Separate Audit)**:
  - Tự động phát hiện khi câu hỏi bị Word gán nhãn thành phương án (như `E. Cơ sở dữ liệu...`), tự tách ra thành câu hỏi độc lập.
  - Chuyển đổi các chữ cái bị nhảy (E, F, G, H...) về chuẩn A, B, C, D và bảo toàn đáp án đúng.
  - **Mục riêng các câu hỏi AI vừa sửa**: Giao diện so sánh đối chiếu trực quan từng câu, cho phép duyệt toàn bộ hoặc hoàn tác từng câu theo ý muốn.
  - Hỗ trợ cả **AI Offline** (chạy ngay trên trình duyệt) và **AI Gemini Trực Tuyến** (với nút kiểm tra API Key thông minh).

- **Dán văn bản thông minh (Smart Paste)**:
  - Tự động nhận diện định dạng trắc nghiệm từ **Word**, **PDF**, **EduQuiz** copy vào.
  - Nhận diện linh hoạt các kiểu đánh dấu `*A.`, `Đáp án: A`, `Key: A`, `Giải thích: ...`.
  - Bộ đếm và kiểm tra theo thời gian thực (Real-time live preview) cảnh báo câu nào chưa có đáp án đúng trước khi lưu.
- **Quản lý đề thi**: Xóa từng đề, xóa toàn bộ ngân hàng đề, sao lưu và khôi phục định dạng JSON an toàn.

---

### 2. Các Chế Độ Làm Bài Chuyên Nghiệp

#### 🎯 Chế Độ Ôn Tập (Practice Mode)
- **Kiểm tra đáp án tức thì**: Đổi màu Xanh (Đúng) hoặc Đỏ (Sai) kèm âm thanh phản hồi sinh động ngay khi chọn.
- **Hiển thị giải thích chi tiết**: Xem ngay căn cứ và lời giải chi tiết của từng câu hỏi.

#### 🗂️ Chế Độ Thẻ Ghi Nhớ 3D (Flashcard Mode)
- Hiệu ứng lật thẻ 3D quang học mượt mà.
- Phân loại học tập: **"Đã thuộc"** (Mastered) hoặc **"Cần ôn lại"** (Need Review).

#### ⏱️ Chế Độ Thi Thử (Mock Exam Mode)
- Đồng hồ đếm ngược chính xác, đổi màu đỏ cảnh báo khi sắp hết giờ.
- Bảng câu hỏi 1..N với cắm cờ câu hỏi nghi vấn (Flag), tự động nộp bài khi hết giờ.

#### ⚡ Chế Độ Sinh Tồn (Survival Mode)
- 15 giây mỗi câu, 3 mạng, tích lũy điểm combo, tăng thêm thời gian khi trả lời đúng.

---

### 3. Báo Cáo Kết Quả & Phân Tích Năng Lực

- **Chấm điểm thang điểm 10 & tỷ lệ %**: Đánh giá năng lực chuẩn xác kèm hiệu ứng pháo hoa Neon Confetti khi đạt điểm cao.
- **Chỉ làm lại các câu SAI**: Tạo nhanh một phiên ôn tập đặc biệt chỉ chứa những câu làm sai để củng cố kiến thức.
- **Sổ tay câu sai (Mistake Vault)**: Tự động lưu lại các câu làm sai qua mọi bài thi vào một kho riêng để luyện tập định kỳ.
- **Phân tích tiến độ học tập (Learning Analytics)**: Tự động lưu trữ lịch sử thi, thống kê KPI và vẽ biểu đồ đường theo dõi phong độ điểm số.
- **Xuất tệp Word & In đề thi**: Xuất bài làm ra file `.docx` chuyên nghiệp hoặc in ra đề giấy chuẩn kỳ thi với 1 click.

---

## 🚀 Hướng Dẫn Khởi Chạy

### Cách 1: Chạy trực tiếp (Nhanh nhất)
Nhấp đúp chuột vào file [index.html](file:///c:/Users/chinh/OneDrive/Documents/Web_thi/index.html) để mở trên bất kỳ trình duyệt web nào (Chrome, Edge, Firefox, Cốc Cốc, Safari).

### Cách 2: Chạy qua Local Web Server
Để tận dụng tối đa tính năng Service Worker PWA, bạn có thể chạy máy chủ cục bộ:
```powershell
python -m http.server 3000
```
Hoặc dùng Node.js `npx serve`:
```powershell
npx serve -l 3000
```
Sau đó truy cập: [http://localhost:3000](http://localhost:3000)

---

## ⌨️ Phím Tắt Tiện Lợi Khi Làm Bài
- `A`, `B`, `C`, `D` hoặc `1`, `2`, `3`, `4`: Chọn nhanh phương án trắc nghiệm.
- `Mũi tên Trái (←)` hoặc `J`: Quay lại câu hỏi trước.
- `Mũi tên Phải (→)` hoặc `K`: Chuyển sang câu hỏi kế tiếp.
- `Space (Phím cách)`: Lật mặt thẻ 3D ghi nhớ (Flashcard).
- `F`: Đặt hoặc bỏ cắm cờ câu hỏi cần xem lại.
- `Z`: Bật/Tắt chế độ tập trung (Zen Mode toàn màn hình).
- `S`: Bật/Tắt âm thanh hiệu ứng (Web Audio FX).
- `?`: Mở bảng danh sách phím tắt chi tiết.
- `Esc`: Đóng bất kỳ cửa sổ / modal nào đang mở.

---

## 🛠️ Công Nghệ Sử Dụng
- **Ngôn ngữ**: HTML5 Semantic, CSS3 Custom Properties (Vanilla CSS), Modern JavaScript (ES6+).
- **Thư viện tích hợp**:
  - `jszip.min.js`: Xử lý giải nén file Word docx, trích xuất hình ảnh và xuất file Word kèm ma trận đáp án chuẩn OpenXML.
  - `pdf.min.js` & `pdf.worker.min.js`: Đọc và phân tích file PDF.
- **Thiết kế**: Phong cách kính lỏng quang học **Crystal Liquid Glass & 3D Optics** với độ mờ hạt mịn (`backdrop-filter`), hiệu ứng phản xạ theo con trỏ chuột (`Dynamic Mouse Spotlight`) và hiệu ứng âm thanh Web Audio thuần.
