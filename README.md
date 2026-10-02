# NovaQuiz v3.6 - Nền Tảng Ôn Thi & Thi Thử Trắc Nghiệm Thông Minh

Một ứng dụng web trắc nghiệm hiện đại, tối ưu trải nghiệm học tập và thi cử với giao diện **Crystal Liquid Glass & 3D Optics** cao cấp, được xây dựng hoàn chỉnh bằng HTML5, CSS3 hiện đại và JavaScript thuần (Vanilla JS), không cần backend server phức tạp, chạy trực tiếp trên mọi trình duyệt (Chrome, Cốc Cốc, Edge, Safari, Mobile).

---

## 🚀 Các Tính Năng Đột Phá Bản v3.6

### 1. 📱 Ứng Dụng Đa Nền Tảng PWA & Chế Độ Offline
- **Cài đặt như Native App**: Hỗ trợ chuẩn **Progressive Web App (PWA)**, người dùng có thể bấm nút **"📱 Cài đặt App"** ngay trên thanh tiêu đề để cài đặt NovaQuiz trực tiếp lên Desktop Windows/Mac hoặc màn hình chính điện thoại iOS/Android.
- **Service Worker Offline Cache**: Tự động lưu trữ offline toàn bộ mã nguồn, dữ liệu đề thi và tài nguyên tĩnh, cho phép làm bài thi và ôn luyện ngay cả khi mất kết nối mạng.

### 2. 🔀 Trộn Nhiều Mã Đề Thi (101, 102, 103, 104) & Xuất Word Kèm Ma Trận Đáp Án
- **Tạo 2, 4, 6, 8 mã đề song song**: Tự động xáo trộn ngẫu nhiên thứ tự câu hỏi và thứ tự các phương án lựa chọn (A, B, C, D) mà vẫn bảo toàn chính xác đáp án đúng.
- **Lưu trực tiếp vào Thư viện**: Biến các mã đề thành các đề thi độc lập trong ngân hàng đề chỉ với một cú click.
- **Xuất tệp Microsoft Word (.docx) chuyên nghiệp**:
  - Gộp tất cả các mã đề thi vào một tệp Word duy nhất với ngắt trang (`Page Break`) tự động giữa các mã đề.
  - Tự động lập **Bảng Ma Trận Đáp Án Đối Chiếu (Master Answer Key Matrix)** ở cuối tài liệu (dạng bảng Word chuẩn theo cột: *Câu hỏi | Mã 101 | Mã 102 | Mã 103 | Mã 104*), giúp Thầy Cô và nhóm học tập chấm thi trắc nghiệm thần tốc!

### 3. ⚡ Chế Độ Sinh Tồn (Survival Mode / Time-Rush)
- **Cơ chế Arcade gay cấn**: Thử thách phản xạ kiến thức với áp lực thời gian:
  - ⏳ **15 giây đếm ngược** cho mỗi câu hỏi.
  - ❤️ **3 Mạng (Lives)**: Trả lời sai hoặc hết giờ bị trừ 1 mạng và kích hoạt hiệu ứng rung màn hình (*Screen Rumble*).
  - 🔥 **Chuỗi Combo & Hệ số nhân điểm**: Đúng liên tiếp tăng chuỗi combo (x1, x2, x3...), cộng dồn điểm số thần tốc.
  - ⏱️ **Time Bonus**: Mỗi câu trả lời đúng được thưởng thêm +5 giây vào quỹ thời gian.
  - 🏆 **Kỷ lục cá nhân & Game Over Modal**: Tự động lưu điểm số cao nhất trong `localStorage`, hiển thị bảng thành tích đầy đủ và hỗ trợ chơi lại ngay.

### 4. 📝 Ghi Chú Cá Nhân Trên Từng Câu Hỏi (Sticky Notes)
- **Tự động lưu vĩnh viễn**: Mỗi câu hỏi đều có ngăn ghi chú cá nhân riêng biệt, tự động lưu ngay khi gõ vào `localStorage`.
- **Gắn Tag nhanh tiện lợi**: Các thẻ gợi ý `#Cần_ôn_kỹ`, `#Hay_nhầm_A_và_B`, `#Công_thức_quan_trọng`, `#Mẹo_nhớ_nhanh` giúp phân loại ghi chú chỉ bằng 1 cú chạm.
- **Dấu hiệu trực quan**: Câu hỏi có ghi chú sẽ hiện chấm sáng màu hổ phách trên Bảng điều hướng câu hỏi và nút ghi chú.
- **Tích hợp bảng xem lại**: Ghi chú cá nhân tự động xuất hiện trong Bảng xem lại chi tiết sau khi nộp bài để dễ dàng đối chiếu.

### 5. 🏷️ Tự Động Phân Loại Độ Khó & Bộ Lọc Đề Thi
- **Hệ thống AI nhận diện độ khó**: Tự động phân loại câu hỏi thành **🟢 Dễ**, **🟡 Vừa**, hoặc **🔴 Khó** dựa trên cấu trúc câu, độ dài, thuật ngữ chuyên sâu, công thức hoặc các tag có sẵn như `[Dễ]`, `[Khó]`, `#easy`, `#hard`.
- **Huy hiệu độ khó trực quan**: Xuất hiện ngay trên đầu câu hỏi trong phòng thi và trong danh sách xem lại kết quả.
- **Bộ lọc độ khó khi bắt đầu thi**: Cho phép thí sinh chọn luyện tập tập trung: *Toàn bộ câu*, *Chỉ câu Dễ*, *Chỉ câu Vừa*, hoặc *Chỉ câu Khó*.

### 6. 📖 Chế Độ Đọc Dịu Mắt (Sepia Warm Mode)
- **Chu trình chuyển đổi giao diện 3 trạng thái**: **Sáng ☀️ ➡️ Tối 🌙 ➡️ Giấy thi vàng Dịu Mắt 📜 ➡️ Sáng ☀️**.
- Tông màu Sepia / Giấy ngà cổ điển giúp giảm mỏi mắt tối đa khi học bài đêm hoặc đọc đề thi kéo dài nhiều giờ.

### 7. ⏩ Tự Động Chuyển Câu Thông Minh (Smart Auto-Advance)
- **Tùy biến tốc độ chuyển câu linh hoạt**:
  - ❌ **Tắt**: Giữ nguyên câu hỏi để bấm nút "Tiếp" thủ công.
  - ⚡ **Chuyển ngay lập tức (0s)**: Vừa bấm/gõ đáp án xong là chuyển ngay tức thì sang câu kế tiếp mà không cần bấm thêm thao tác nào.
  - ⏱️ **Hẹn giờ chuyển sau X giây** (1.0s, 1.5s, 2.0s, 3.0s, 5.0s): Hiển thị thanh đếm ngược thông minh kèm nút "Dừng lại" cho phép kịp nhìn kết quả đúng/sai và đọc giải thích chi tiết trong chế độ Ôn tập.
- **Điều khiển trực tiếp mọi lúc**: Nút bấm cài đặt ngay trên thanh công cụ câu hỏi phòng thi và trong hộp thoại Cài đặt trước khi làm bài. Tự động lưu cấu hình yêu thích vào `localStorage`.

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
