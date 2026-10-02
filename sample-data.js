/**
 * Bộ đề mẫu phong phú có sẵn để người dùng trải nghiệm ngay lập tức
 */
window.DEFAULT_QUIZZES = [
  {
    id: "quiz-tinhoc-01",
    title: "Đề Ôn Thi Tin Học Đại Cương & Công Nghệ",
    description: "Bộ câu hỏi trắc nghiệm kiến thức nền tảng về phần cứng, phần mềm, mạng máy tính và an toàn thông tin.",
    category: "Tin học",
    timeLimit: 15, // phút
    createdAt: "2026-09-25T08:00:00.000Z",
    questions: [
      {
        id: "q1",
        text: "Bộ phận nào sau đây được coi là 'bộ não' của máy tính, chịu trách nhiệm xử lý các phép toán và điều khiển hoạt động?",
        options: [
          "RAM (Bộ nhớ truy xuất ngẫu nhiên)",
          "CPU (Bộ vi xử lý trung tâm)",
          "Hard Disk (Ổ đĩa cứng)",
          "Power Supply (Bộ nguồn)"
        ],
        correctIndex: 1,
        explanation: "CPU (Central Processing Unit) là bộ xử lý trung tâm, thực hiện các lệnh của chương trình máy tính bằng cách thực hiện các phép tính số học, logic, so sánh và các hoạt động nhập/xuất dữ liệu cơ bản."
      },
      {
        id: "q2",
        text: "Trong một mạng máy tính, giao thức nào sau đây được sử dụng để truyền tải an toàn và mã hóa dữ liệu các trang web qua Internet?",
        options: [
          "HTTP",
          "FTP",
          "HTTPS",
          "SMTP"
        ],
        correctIndex: 2,
        explanation: "HTTPS (Hypertext Transfer Protocol Secure) là giao thức truyền siêu văn bản an toàn, sử dụng mã hóa SSL/TLS để bảo mật thông tin liên lạc qua mạng Internet."
      },
      {
        id: "q3",
        text: "1 Gigabyte (GB) tương đương với khoảng bao nhiêu Megabyte (MB) theo hệ nhị phân tiêu chuẩn?",
        options: [
          "1000 MB",
          "1024 MB",
          "2048 MB",
          "512 MB"
        ],
        correctIndex: 1,
        explanation: "Trong hệ thống máy tính nhị phân, các bội số được tính theo lũy thừa của 2: 1 GB = 2^10 MB = 1024 MB."
      },
      {
        id: "q4",
        text: "Hệ điều hành nào sau đây là hệ điều hành mã nguồn mở?",
        options: [
          "Microsoft Windows",
          "macOS",
          "Linux",
          "iOS"
        ],
        correctIndex: 2,
        explanation: "Linux là hệ điều hành mã nguồn mở tự do nổi tiếng nhất, được phát triển lần đầu bởi Linus Torvalds vào năm 1991."
      },
      {
        id: "q5",
        text: "Để sao chép một đoạn văn bản hoặc tệp tin trong hệ điều hành Windows, người dùng thường sử dụng tổ hợp phím nào?",
        options: [
          "Ctrl + V",
          "Ctrl + C",
          "Ctrl + X",
          "Ctrl + Z"
        ],
        correctIndex: 1,
        explanation: "Ctrl + C dùng để Copy (Sao chép), Ctrl + V dùng để Paste (Dán), Ctrl + X là Cut (Cắt), Ctrl + Z là Undo (Hoàn tác)."
      },
      {
        id: "q6",
        text: "Định dạng tệp nào sau đây KHÔNG PHẢI là định dạng ảnh số?",
        options: [
          "PNG",
          "JPEG",
          "GIF",
          "MP3"
        ],
        correctIndex: 3,
        explanation: "MP3 là định dạng tệp âm thanh (audio), trong khi PNG, JPEG và GIF đều là các định dạng ảnh raster phổ biến."
      },
      {
        id: "q7",
        text: "Tường lửa (Firewall) trong bảo mật mạng có chức năng chính là gì?",
        options: [
          "Tăng tốc độ kết nối internet",
          "Kiểm soát, lọc lưu lượng mạng ra vào dựa trên các quy tắc bảo mật",
          "Quét và tiêu diệt virus trên ổ cứng",
          "Lưu trữ bản sao lưu dữ liệu đám mây"
        ],
        correctIndex: 1,
        explanation: "Firewall đóng vai trò như rào chắn bảo vệ giữa mạng nội bộ an toàn và mạng bên ngoài (Internet), ngăn chặn truy cập trái phép."
      },
      {
        id: "q8",
        text: "Trong bảng tính Microsoft Excel, hàm nào được sử dụng để tính giá trị trung bình cộng của một dãy số?",
        options: [
          "SUM()",
          "AVERAGE()",
          "COUNT()",
          "MAX()"
        ],
        correctIndex: 1,
        explanation: "Hàm AVERAGE() dùng để tính trung bình cộng; hàm SUM() tính tổng; hàm COUNT() đếm số ô chứa số."
      },
      {
        id: "q9",
        text: "HTML là từ viết tắt của thuật ngữ nào trong lập trình web?",
        options: [
          "HyperText Markup Language",
          "High-level Text Management Logic",
          "Hyperlink and Text Model Language",
          "Home Tool Markup Language"
        ],
        correctIndex: 0,
        explanation: "HTML là viết tắt của HyperText Markup Language (Ngôn ngữ đánh dấu siêu văn bản), tạo nên bộ khung cấu trúc của mọi trang web."
      },
      {
        id: "q10",
        text: "Hành vi giả mạo các tổ chức uy tín (như ngân hàng, mạng xã hội) qua email hoặc tin nhắn nhằm đánh cắp mật khẩu và thông tin tài khoản được gọi là gì?",
        options: [
          "DDoS",
          "Phishing (Tấn công lừa đảo)",
          "Ransomware",
          "Spyware"
        ],
        correctIndex: 1,
        explanation: "Phishing là hình thức tấn công phi kỹ thuật (social engineering), kẻ tấn công đóng giả làm tổ chức tin cậy để dụ dỗ nạn nhân cung cấp thông tin nhạy cảm."
      }
    ]
  },
  {
    id: "quiz-tienganh-01",
    title: "Trắc Nghiệm Ôn Luyện Ngữ Pháp Tiếng Anh",
    description: "Luyện tập các thì thông dụng, giới từ, câu điều kiện và mệnh đề quan hệ hay gặp trong các bài thi.",
    category: "Tiếng Anh",
    timeLimit: 12,
    createdAt: "2026-09-26T10:30:00.000Z",
    questions: [
      {
        id: "en1",
        text: "She _______ in this company for over ten years before she decided to move abroad.",
        options: [
          "has worked",
          "had worked",
          "works",
          "is working"
        ],
        correctIndex: 1,
        explanation: "Dùng thì Quá khứ hoàn thành (had worked) để diễn tả hành động xảy ra và hoàn tất trước một hành động khác trong quá khứ (decided)."
      },
      {
        id: "en2",
        text: "If I _______ enough money right now, I would travel around the world.",
        options: [
          "have",
          "had",
          "had had",
          "will have"
        ],
        correctIndex: 1,
        explanation: "Đây là câu điều kiện loại 2 (Conditional Type 2) diễn tả điều kiện không có thật ở hiện tại: If + S + V-ed / V2, S + would/could + V-bare."
      },
      {
        id: "en3",
        text: "The man _______ car was stolen yesterday reported the incident to the police.",
        options: [
          "who",
          "whom",
          "whose",
          "which"
        ],
        correctIndex: 2,
        explanation: "Đại từ quan hệ 'whose' dùng để chỉ sở hữu cho người hoặc vật: 'whose car' = chiếc xe của người đàn ông đó."
      },
      {
        id: "en4",
        text: "He is keen _______ learning new programming languages.",
        options: [
          "on",
          "in",
          "at",
          "with"
        ],
        correctIndex: 0,
        explanation: "Cụm tính từ đi với giới từ: 'be keen on doing something' có nghĩa là say mê, rất hứng thú với việc gì đó."
      },
      {
        id: "en5",
        text: "Neither John nor his friends _______ present at the meeting yesterday.",
        options: [
          "was",
          "were",
          "is",
          "are"
        ],
        correctIndex: 1,
        explanation: "Cấu trúc 'Neither S1 nor S2': động từ hòa hợp theo chủ ngữ gần nó nhất (his friends - số nhiều) và thời điểm quá khứ (yesterday), do đó dùng 'were'."
      },
      {
        id: "en6",
        text: "By the time you arrive at the airport tomorrow, the plane _______ off.",
        options: [
          "will take",
          "has taken",
          "will have taken",
          "takes"
        ],
        correctIndex: 2,
        explanation: "Cấu trúc 'By the time + Hiện tại đơn (tomorrow), Tương lai hoàn thành (will have + V3/ed)' để diễn tả hành động sẽ hoàn tất trước một mốc thời gian trong tương lai."
      },
      {
        id: "en7",
        text: "You _______ smoke inside the hospital. It is strictly forbidden.",
        options: [
          "mustn't",
          "needn't",
          "shouldn't",
          "won't"
        ],
        correctIndex: 0,
        explanation: "'Mustn't' diễn tả sự cấm đoán bắt buộc (strictly forbidden)."
      },
      {
        id: "en8",
        text: "Although it rained heavily, _______ to school on time.",
        options: [
          "but they went",
          "they went",
          "so they went",
          "however they went"
        ],
        correctIndex: 1,
        explanation: "Mệnh đề nhượng bộ bắt đầu bằng 'Although' không dùng 'but' ở mệnh đề chính."
      }
    ]
  },
  {
    id: "quiz-dialy-01",
    title: "Kiến Thức Tổng Hợp Địa Lý & Xã Hội",
    description: "Bộ câu hỏi kiểm tra hiểu biết chung về địa lý Việt Nam và thế giới.",
    category: "Kiến thức chung",
    timeLimit: 10,
    createdAt: "2026-09-27T14:15:00.000Z",
    questions: [
      {
        id: "geo1",
        text: "Đỉnh núi nào được mệnh danh là 'Nóc nhà của Đông Dương' với độ cao 3.143 mét?",
        options: [
          "Đỉnh Pu Si Lung",
          "Đỉnh Fansipan (Phan Xi Păng)",
          "Đỉnh Pu Ta Leng",
          "Đỉnh Ngọc Linh"
        ],
        correctIndex: 1,
        explanation: "Fansipan (3.143m) nằm ở dãy Hoàng Liên Sơn, tỉnh Lào Cai, là ngọn núi cao nhất của 3 nước Đông Dương (Việt Nam, Lào, Campuchia)."
      },
      {
        id: "geo2",
        text: "Việt Nam có đường bờ biển dài khoảng bao nhiêu km?",
        options: [
          "2.360 km",
          "3.260 km",
          "4.120 km",
          "1.650 km"
        ],
        correctIndex: 1,
        explanation: "Đường bờ biển của Việt Nam dài khoảng 3.260 km kéo dài từ Móng Cái (Quảng Ninh) đến Hà Tiên (Kiên Giang)."
      },
      {
        id: "geo3",
        text: "Thành phố nào là trung tâm kinh tế lớn nhất của Việt Nam?",
        options: [
          "Hà Nội",
          "Thành phố Hồ Chí Minh",
          "Đà Nẵng",
          "Hải Phòng"
        ],
        correctIndex: 1,
        explanation: "Thành phố Hồ Chí Minh là trung tâm kinh tế, tài chính, thương mại và dịch vụ lớn nhất cả nước."
      },
      {
        id: "geo4",
        text: "Đại dương nào có diện tích lớn nhất trên Trái Đất?",
        options: [
          "Đại Tây Dương",
          "Ấn Độ Dương",
          "Bắc Băng Dương",
          "Thái Bình Dương"
        ],
        correctIndex: 3,
        explanation: "Thái Bình Dương là đại dương lớn nhất và sâu nhất hành tinh, chiếm hơn 30% diện tích bề mặt Trái Đất."
      },
      {
        id: "geo5",
        text: "Sông Mê Kông chảy qua bao nhiêu quốc gia trước khi đổ ra Biển Đông?",
        options: [
          "4 quốc gia",
          "5 quốc gia",
          "6 quốc gia",
          "7 quốc gia"
        ],
        correctIndex: 2,
        explanation: "Sông Mê Kông bắt nguồn từ Tây Tạng (Trung Quốc), chảy qua Myanmar, Lào, Thái Lan, Campuchia và Việt Nam (tổng cộng 6 quốc gia)."
      }
    ]
  }
];
