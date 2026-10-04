/**
 * NOVAQUIZ PRO - MAIN APPLICATION ENGINE v4.1.1
 * Modern Exam & Practice Web App (AI Exam Generator, Tinder Flashcard, Zen Mode 2.0, Mệnh Thổ Amber)
 */

// =============================================================================
// 1. STATE & LOCAL STORAGE MANAGEMENT
// =============================================================================

const STORAGE_KEYS = {
  QUIZZES: "novaquiz_quizzes_v3",
  QUIZZES_LEGACY: "eduquiz_quizzes_v2",
  THEME: "novaquiz_theme_v3",
  THEME_LEGACY: "eduquiz_theme_v2",
  MISTAKE_VAULT: "novaquiz_mistake_vault_v3",
  HISTORY: "novaquiz_history_v1",
  SOUND: "novaquiz_sound_enabled",
  SHORTCUTS: "novaquiz_shortcuts_enabled",
  SURVIVAL_HIGHSCORES: "novaquiz_survival_highscores",
  QUESTION_NOTES: "novaquiz_question_notes",
  AUTO_ADVANCE: "novaquiz_auto_advance",
  GEMINI_KEY: "novaquiz_gemini_api_key",
  GEMINI_KEY_LEGACY: "eduquiz_gemini_api_key",
  GEMINI_MODEL: "novaquiz_active_gemini_model",
  GEMINI_MODEL_LEGACY: "eduquiz_active_gemini_model",
  GEMINI_CUSTOM_MODEL: "novaquiz_custom_gemini_model",
  GEMINI_CUSTOM_MODEL_LEGACY: "eduquiz_custom_gemini_model"
};

function getSavedGeminiKey() {
  return localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || localStorage.getItem(STORAGE_KEYS.GEMINI_KEY_LEGACY) || "";
}

function setSavedGeminiKey(val) {
  const cleanVal = (val || "").trim();
  localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, cleanVal);
  localStorage.setItem(STORAGE_KEYS.GEMINI_KEY_LEGACY, cleanVal);
}

function getSavedGeminiModel() {
  let m = localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL_LEGACY) || "gemini-3.8-flash";
  // Migration: Tự động nâng cấp lên thế hệ Gemini 3+ mới nhất nếu người dùng đang lưu các model < Gemini 3 đã bị khai tử
  if (!m || m.includes("1.5") || m.includes("2.0") || m.includes("2.5") || m.includes("1.0") || m.includes("interactions") || m.includes("tts") || m.includes("embedding") || m.includes("8b")) {
    m = "gemini-3.8-flash";
    setSavedGeminiModel(m);
  }
  return m;
}

function setSavedGeminiModel(val) {
  const modelVal = val || "gemini-3.8-flash";
  localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, modelVal);
  localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL_LEGACY, modelVal);
}

function getSavedGeminiCustomModel() {
  return localStorage.getItem(STORAGE_KEYS.GEMINI_CUSTOM_MODEL) || localStorage.getItem(STORAGE_KEYS.GEMINI_CUSTOM_MODEL_LEGACY) || "";
}

function setSavedGeminiCustomModel(val) {
  const cleanVal = (val || "").trim();
  localStorage.setItem(STORAGE_KEYS.GEMINI_CUSTOM_MODEL, cleanVal);
  localStorage.setItem(STORAGE_KEYS.GEMINI_CUSTOM_MODEL_LEGACY, cleanVal);
}

// Bộ nhớ đệm lưu trữ hình ảnh trích xuất từ PDF để chống nghẽn bộ nhớ / ReDoS
if (typeof window !== "undefined" && !window.pdfImageRegistry) {
  window.pdfImageRegistry = new Map();
}
const pdfImageRegistry = (typeof window !== "undefined" && window.pdfImageRegistry) ? window.pdfImageRegistry : new Map();

const AppState = {
  quizzes: [],
  selectedQuiz: null,
  activeFilter: "ALL",
  searchQuery: "",
  autoAdvance: "1.5",
  shortcutsEnabled: localStorage.getItem("novaquiz_shortcuts_enabled") !== "false",
  ocrImages: [],
  
  // Current active runner session
  session: {
    mode: "PRACTICE", // "PRACTICE", "EXAM", "FLASHCARD", or "SURVIVAL"
    quizId: null,
    quizTitle: "",
    category: "",
    questions: [],
    userAnswers: {},   // questionIndex -> selectedOptionIndex
    flags: new Set(),  // Set of flagged question indices
    currentIndex: 0,
    timeRemaining: 0,  // seconds
    timeSpent: 0,
    timerInterval: null,
    isFlashcard: false,
    isSubmitted: false,
    // Survival Mode Attributes
    survivalLives: 3,
    survivalScore: 0,
    survivalCombo: 1,
    survivalMaxCombo: 1,
    survivalSurvived: 0,
    survivalQuestionTimer: 15,
    survivalTimerInterval: null
  },
  
  // Audio synthesizer context for feedback sounds
  audioCtx: null
};

// =============================================================================
// 2. SOUND EFFECTS & TEXT-TO-SPEECH (Web Audio API & Web Speech API)
// =============================================================================

function isSoundEnabled() {
  return localStorage.getItem(STORAGE_KEYS.SOUND) !== "false";
}

function updateSoundUI() {
  const enabled = isSoundEnabled();
  const iconHeader = document.getElementById("sound-toggle-icon");
  const iconRunner = document.getElementById("runner-sound-icon");
  const text = enabled ? "🔊" : "🔇";
  if (iconHeader) iconHeader.textContent = text;
  if (iconRunner) iconRunner.textContent = text;
}

function toggleSoundSetting() {
  const newState = !isSoundEnabled();
  localStorage.setItem(STORAGE_KEYS.SOUND, String(newState));
  updateSoundUI();
  showToast(newState ? "🔊 Đã bật âm thanh hiệu ứng" : "🔇 Đã tắt âm thanh hiệu ứng", "info");
}

function isShortcutsEnabled() {
  return AppState.shortcutsEnabled !== false;
}

function setShortcutsEnabled(enabled) {
  AppState.shortcutsEnabled = !!enabled;
  localStorage.setItem(STORAGE_KEYS.SHORTCUTS, String(enabled));
  const t1 = document.getElementById("toggle-shortcuts-enabled");
  if (t1) t1.checked = !!enabled;
  const t2 = document.getElementById("toggle-setup-shortcuts");
  if (t2) t2.checked = !!enabled;
}

function playSound(type) {
  if (!isSoundEnabled()) return;

  try {
    if (!AppState.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) AppState.audioCtx = new AudioContext();
    }
    if (!AppState.audioCtx) return;
    if (AppState.audioCtx.state === 'suspended') {
      AppState.audioCtx.resume();
    }

    const ctx = AppState.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "correct") {
      // Pleasant high double beep
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "wrong") {
      // Low buzz
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.setValueAtTime(164.81, now + 0.1); // E3
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === "click") {
      // Subtle click
      osc.type = "triangle";
      osc.frequency.setValueAtTime(540, now);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === "flip") {
      // Soft woosh for flashcard flip
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === "complete") {
      // Fanfare chord
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = "triangle";
        o.frequency.setValueAtTime(freq, now + i * 0.08);
        g.gain.setValueAtTime(0.1, now + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        o.start(now + i * 0.08);
        o.stop(now + 0.8);
      });
    }
  } catch (e) {
    // Ignore audio errors if blocked by browser policy
  }
}


// =============================================================================
// 3. TOAST NOTIFICATIONS
// =============================================================================

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";

  let icon = `ℹ️`;
  if (type === "success") icon = `✅`;
  if (type === "danger" || type === "error") icon = `⚠️`;

  toast.innerHTML = `
    <span>${icon}</span>
    <span style="flex:1;">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =============================================================================
// 4. STORAGE & INITIALIZATION
// =============================================================================

function loadQuizzes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUIZZES) || localStorage.getItem(STORAGE_KEYS.QUIZZES_LEGACY);
    if (raw) {
      AppState.quizzes = JSON.parse(raw);
    } else {
      AppState.quizzes = Array.isArray(window.DEFAULT_QUIZZES) ? [...window.DEFAULT_QUIZZES] : [];
      saveQuizzes();
    }
  } catch (e) {
    console.error("Lỗi đọc dữ liệu từ localStorage", e);
    AppState.quizzes = Array.isArray(window.DEFAULT_QUIZZES) ? [...window.DEFAULT_QUIZZES] : [];
  }
}

function saveQuizzes() {
  try {
    localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(AppState.quizzes));
  } catch (e) {
    console.error("Lỗi lưu localStorage", e);
    showToast("Không thể lưu bộ nhớ trình duyệt (hết dung lượng)!", "danger");
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || localStorage.getItem(STORAGE_KEYS.THEME_LEGACY) || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  let target = "dark";
  if (current === "dark") target = "sepia";
  else if (current === "sepia") target = "light";
  else target = "dark";

  document.documentElement.setAttribute("data-theme", target);
  localStorage.setItem(STORAGE_KEYS.THEME, target);
  updateThemeIcon(target);

  let label = "Tối (Dark 🌙)";
  if (target === "sepia") label = "Giấy Vàng Sepia Dịu Mắt 📜";
  if (target === "light") label = "Sáng (Light ☀️)";

  showToast(`Đã chuyển sang chế độ ${label}`);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("btn-theme-toggle");
  if (!btn) return;
  if (theme === "dark") {
    btn.title = "Chuyển sang chế độ Giấy Sepia Dịu Mắt";
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  } else if (theme === "sepia") {
    btn.title = "Chuyển sang chế độ Sáng (Light)";
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><path d="M6 6h10"></path><path d="M6 10h10"></path></svg>`;
  } else {
    btn.title = "Chuyển sang chế độ Tối (Dark)";
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  }
}

// =============================================================================
// 5. VIEW NAVIGATION
// =============================================================================

function switchView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add("active");
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

// =============================================================================
// 6. DASHBOARD RENDERING & FILTERING
// =============================================================================

function renderDashboard() {
  const container = document.getElementById("quiz-list-container");
  if (!container) return;

  const query = (AppState.searchQuery || "").trim().toLowerCase();
  const cat = AppState.activeFilter;

  const filtered = AppState.quizzes.filter(q => {
    const matchCat = (cat === "ALL") || 
      (cat === "Tự tạo" ? q.isCustom : (q.category || "").toLowerCase() === cat.toLowerCase());
    const matchSearch = !query || 
      q.title.toLowerCase().includes(query) || 
      (q.description && q.description.toLowerCase().includes(query)) ||
      (q.category && q.category.toLowerCase().includes(query));
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>Không tìm thấy bộ đề thi nào!</h3>
        <p>Không có đề thi phù hợp với từ khóa hoặc danh mục đã chọn. Bạn có thể tự tải đề mới hoặc xóa bộ lọc.</p>
        <button class="btn btn-primary" onclick="openCreator()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tạo Đề Mới Ngay
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(quiz => {
    const questionCount = quiz.questions ? quiz.questions.length : 0;
    const timeLimit = quiz.timeLimit || 15;
    const catLabel = quiz.category || "Chung";

    return `
      <div class="quiz-card" data-id="${quiz.id}">
        <div class="quiz-card-header">
          <span class="badge badge-primary">${escapeHtml(catLabel)}</span>
          <div class="card-header-actions">
            <button class="card-tool-btn btn-tool-share" onclick="openShareQuizModal('${quiz.id}', event)" title="Chia sẻ bộ đề thi qua đường link trực tiếp (Gửi bạn bè, Zalo, Messenger)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
            <button class="card-tool-btn btn-tool-multicode" onclick="openMultiCodeModal('${quiz.id}')" title="Trộn thành nhiều mã đề (101, 102...) & Xuất Word kèm ma trận đáp án">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
            </button>
            <button class="card-tool-btn btn-tool-docx" onclick="exportQuizDocxById('${quiz.id}')" title="Xuất đề thi ra file Word (.docx)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            </button>
            <button class="card-tool-btn btn-tool-print" onclick="printQuizById('${quiz.id}')" title="In đề thi / Xuất file PDF chuẩn A4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
            <button class="card-tool-btn" onclick="exportSingleQuiz('${quiz.id}')" title="Sao lưu đề thi (.json)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button class="card-tool-btn btn-tool-delete" onclick="openDeleteQuizModal('${quiz.id}', event)" title="Xóa bộ đề thi này">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <h3 class="quiz-card-title">${escapeHtml(quiz.title)}</h3>
        <p class="quiz-card-desc">${escapeHtml(quiz.description || "Bộ đề luyện thi trắc nghiệm.")}</p>

        <div class="quiz-meta">
          <div class="quiz-meta-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
            <span><strong>${questionCount}</strong> câu</span>
          </div>
          <div class="quiz-meta-item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span><strong>${timeLimit}</strong> phút</span>
          </div>
        </div>

        <div class="quiz-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="openSetupModal('${quiz.id}', 'PRACTICE')" title="Luyện tập có hiện đáp án và giải thích ngay">
            🎯 Ôn Tập
          </button>
          <button class="btn btn-primary btn-sm" onclick="openSetupModal('${quiz.id}', 'EXAM')" title="Thi thử bấm giờ đếm ngược">
            ⏱️ Thi Thử
          </button>
          <button class="btn btn-flashcard btn-sm" onclick="openSetupModal('${quiz.id}', 'FLASHCARD')" title="Lật thẻ Flashcard ghi nhớ nhanh">
            🗂️ Flashcard
          </button>
          <button class="btn btn-survival btn-sm" onclick="openSetupModal('${quiz.id}', 'SURVIVAL')" title="Chế độ Sinh Tồn: 15s/câu, 3 mạng sống, combo điểm">
            ⚡ Sinh Tồn
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// =============================================================================
// QUẢN LÝ XÓA BỘ ĐỀ THI AN TOÀN & CHUẨN XÁC
// =============================================================================

let targetDeleteQuizId = null;

// Mở modal xác nhận xóa bộ đề thi
function openDeleteQuizModal(quizId, event) {
  if (event) {
    if (typeof event.stopPropagation === "function") event.stopPropagation();
    if (typeof event.preventDefault === "function") event.preventDefault();
  }
  const quiz = AppState.quizzes.find(q => String(q.id) === String(quizId));
  if (!quiz) {
    showToast("Không tìm thấy bộ đề thi cần xóa!", "warning");
    return;
  }

  targetDeleteQuizId = quizId;
  const modal = document.getElementById("modal-confirm-delete");
  const warnText = document.getElementById("delete-quiz-warning-text");
  if (warnText) {
    warnText.innerHTML = `Bạn có chắc chắn muốn xóa bộ đề: <br><strong style="color: var(--text-main); font-size: 1.05rem;">"${escapeHtml(quiz.title)}"</strong>?`;
  }

  if (modal) {
    modal.classList.add("open");
  } else {
    // Dự phòng trường hợp modal DOM chưa sẵn sàng
    if (confirm(`Bạn có chắc chắn muốn xóa bộ đề: "${quiz.title}"?\nHành động này không thể hoàn tác.`)) {
      confirmDeleteQuizAction();
    }
  }
}

// Đóng modal xác nhận xóa
function closeDeleteQuizModal() {
  const modal = document.getElementById("modal-confirm-delete");
  if (modal) modal.classList.remove("open");
  targetDeleteQuizId = null;
}

// Thực hiện xóa bộ đề thi khi người dùng bấm xác nhận
function confirmDeleteQuizAction() {
  if (!targetDeleteQuizId) return;
  const quiz = AppState.quizzes.find(q => String(q.id) === String(targetDeleteQuizId));
  const title = quiz ? quiz.title : "Bộ đề";

  AppState.quizzes = AppState.quizzes.filter(q => String(q.id) !== String(targetDeleteQuizId));
  saveQuizzes();
  closeDeleteQuizModal();
  renderDashboard();
  showToast(`Đã xóa bộ đề "${title}" thành công!`, "success");
  playSound("click");
}

// Giữ lại alias deleteQuiz để tương thích ngược
function deleteQuiz(quizId, event) {
  openDeleteQuizModal(quizId, event);
}

// Xóa tất cả đề thi trong danh sách
function deleteAllQuizzes() {
  if (!AppState.quizzes || AppState.quizzes.length === 0) {
    showToast("Thư viện hiện tại chưa có đề thi nào để xóa!", "warning");
    return;
  }
  if (confirm("CẢNH BÁO NGUY HIỂM:\nBạn có chắc chắn muốn xóa TẤT CẢ các bộ đề thi trong thư viện không?\nDanh sách câu hỏi đã lưu sẽ bị xóa sạch.")) {
    AppState.quizzes = [];
    saveQuizzes();
    renderDashboard();
    showToast("Đã xóa sạch tất cả đề thi trong thư viện!", "success");
  }
}

// Xóa trắng khung soạn thảo đề & đặt lại mọi trạng thái
function clearSmartTextInput() {
  const textarea = document.getElementById("smart-text-input");
  if (textarea && textarea.value.trim() && !confirm("Bạn có chắc muốn xóa trắng toàn bộ nội dung câu hỏi trong khung văn bản không?")) {
    return;
  }
  if (typeof resetCreatorForm === "function") {
    resetCreatorForm();
  } else {
    if (textarea) textarea.value = "";
    updateSmartParsePreview();
  }
  showToast("Đã làm sạch và xóa trắng khung soạn thảo!", "info");
}

// =============================================================================
// 7. SMART TEXT QUESTION PARSER (CHUẨN NOVAQUIZ & WORD / PDF COPY)
// =============================================================================

/**
 * Tự động sửa lỗi dãn chữ tiếng Việt (lỗi phổ biến khi copy văn bản từ file PDF hoặc OCR scan):
 * Ghép các âm tiết bị tách rời như "Khái ni ệ m" -> "Khái niệm", "m ạ ng" -> "mạng", "l ầ n" -> "lần", "đư ợ c" -> "được"
 */
/**
 * Kiểm tra xem một dòng văn bản lựa chọn có bị ngắt dở dang không (chưa đóng ngoặc, chưa đóng nháy kép, kết thúc bằng dấu phẩy...)
 */
function isUnfinishedLine(str) {
  if (!str) return false;
  const trimmed = str.trim();
  if (/[,\:\(\[\{\-\+]$/.test(trimmed)) return true;
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens > closeParens) return true;
  const quoteCount = (trimmed.match(/\"/g) || []).length;
  if (quoteCount % 2 !== 0) return true;
  return false;
}

/**
 * Xử lý lỗi trôi dòng khi copy từ văn bản PDF/Word chia 2 cột phương án (A - B trên cùng 1 hàng, C - D trên cùng 1 hàng):
 * Khi phương án A bị dài và rớt xuống dòng thứ 2, dòng rớt đó thường nằm sau phương án B (ví dụ: Dictionary nằm sau B. Long...).
 * Tương tự với C và D. Hàm này tự động ghép các dòng rớt về đúng phương án A và C ban đầu.
 */
/**
 * Xử lý lỗi trôi dòng khi copy từ văn bản PDF/Word chia 2 cột phương án (A - B trên cùng 1 hàng, C - D trên cùng 1 hàng):
 * Khi phương án A bị dài và rớt xuống dòng thứ 2, dòng rớt đó thường nằm sau phương án B (ví dụ: Dictionary nằm sau B. Long...).
 * Tương tự với C và D. Hàm này tự động ghép các dòng rớt về đúng phương án A và C ban đầu.
 */
function fixTwoColumnWrappingInBlocks(rawText) {
  if (!rawText) return rawText;

  // Tách văn bản thành từng khối câu hỏi dựa trên tiêu đề câu hỏi hoặc 2 dòng trống
  const lines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const questionStartRegex = /^(?:Câu|Bài|Question|Part)\s*\d+[\.\:\/\s]|^\d+[\.\:\/]\s*[A-Za-zÀ-ỹ]|^\d+\s+[A-Za-zÀ-ỹ]{2,}/i;
  const rawBlocks = [];
  let curBlockLines = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const trimmed = l.trim();
    if (questionStartRegex.test(trimmed) && curBlockLines.length > 0) {
      rawBlocks.push(curBlockLines.join("\n"));
      curBlockLines = [];
    }
    curBlockLines.push(l);
  }
  if (curBlockLines.length > 0) {
    rawBlocks.push(curBlockLines.join("\n"));
  }

  const fixedBlocks = rawBlocks.map(block => {
    let bLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const optRegex = /^(\*|\+)?\s*([A-Da-d])[\.\)\:\/]\s*(.*)$/;

    // Hàm nhận diện các dòng đáp án, giải thích, hình ảnh để TUYỆT ĐỐI KHÔNG gộp vào phương án lựa chọn
    const isNotOrphanLine = (l) => {
      const t = l.trim();
      if (!t) return false;
      if (optRegex.test(t)) return true;
      if (questionStartRegex.test(t)) return true;
      if (/^\[HINHANH:[^\]]+\]/i.test(t)) return true;
      if (/^[\*\#\-\–\—\>\s💡✍️⚡]*(?:(?:Đáp\s*án|Dap\s*an)(?:\s*(?:đúng|dung))?(?:\s*là)?|Đ\/?A|D\/?A|Key|Ans(?:wer)?|Câu\s*đúng|Chọn|Phương\s*án|Giải\s*thích(?:\s*chi\s*tiết)?|Lời\s*giải(?:\s*chi\s*tiết)?|Hướng\s*dẫn(?:\s*giải)?|Explanation|HD|HDG)[\s\:\-\.\*]/i.test(t)) return true;
      if (/^[\*\#\-\–\—\>\s💡✍️⚡]*(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn|Explanation)\b/i.test(t)) return true;
      return false;
    };

    let idxA = -1, idxB = -1, idxC = -1, idxD = -1;
    bLines.forEach((l, idx) => {
      const m = l.match(optRegex);
      if (m) {
        const letter = m[2].toUpperCase();
        if (letter === 'A' && idxA === -1) idxA = idx;
        else if (letter === 'B' && idxB === -1) idxB = idx;
        else if (letter === 'C' && idxC === -1) idxC = idx;
        else if (letter === 'D' && idxD === -1) idxD = idx;
      }
    });

    // Các dòng giữa A và B
    if (idxA !== -1 && idxB !== -1 && idxB > idxA + 1) {
      const orphanLines = bLines.slice(idxA + 1, idxB).filter(l => !isNotOrphanLine(l));
      if (orphanLines.length > 0) {
        bLines[idxA] += ' ' + orphanLines.join(' ');
        bLines.splice(idxA + 1, orphanLines.length);
        idxB -= orphanLines.length;
        if (idxC !== -1) idxC -= orphanLines.length;
        if (idxD !== -1) idxD -= orphanLines.length;
      }
    }

    // Các dòng giữa B và C
    if (idxB !== -1 && idxC !== -1 && idxC > idxB + 1) {
      const orphanLines = bLines.slice(idxB + 1, idxC).filter(l => !isNotOrphanLine(l));
      if (orphanLines.length > 0) {
        const textA = bLines[idxA].replace(optRegex, '$3').trim();
        const textB = bLines[idxB].replace(optRegex, '$3').trim();
        if (isUnfinishedLine(textA) && !isUnfinishedLine(textB)) {
          bLines[idxA] += ' ' + orphanLines.join(' ');
        } else {
          bLines[idxB] += ' ' + orphanLines.join(' ');
        }
        bLines.splice(idxB + 1, orphanLines.length);
        idxC -= orphanLines.length;
        if (idxD !== -1) idxD -= orphanLines.length;
      }
    }

    // Các dòng giữa C và D
    if (idxC !== -1 && idxD !== -1 && idxD > idxC + 1) {
      const orphanLines = bLines.slice(idxC + 1, idxD).filter(l => !isNotOrphanLine(l));
      if (orphanLines.length > 0) {
        bLines[idxC] += ' ' + orphanLines.join(' ');
        bLines.splice(idxC + 1, orphanLines.length);
        idxD -= orphanLines.length;
      }
    }

    // Các dòng sau D (nhưng trước khi gặp câu hỏi mới hoặc giải thích/đáp án)
    if (idxD !== -1 && bLines.length > idxD + 1) {
      const orphanLines = bLines.slice(idxD + 1).filter(l => !isNotOrphanLine(l));
      if (orphanLines.length > 0) {
        const textC = idxC !== -1 ? bLines[idxC].replace(optRegex, '$3').trim() : '';
        const textD = bLines[idxD].replace(optRegex, '$3').trim();
        if (idxC !== -1 && isUnfinishedLine(textC) && !isUnfinishedLine(textD)) {
          bLines[idxC] += ' ' + orphanLines.join(' ');
        } else {
          bLines[idxD] += ' ' + orphanLines.join(' ');
        }
        bLines.splice(idxD + 1, orphanLines.length);
      }
    }

    return bLines.join('\n');
  });

  return fixedBlocks.join('\n\n');
}

/**
 * Tách và định dạng các dòng code bị dính liền nhau do lỗi copy-paste/quét PDF:
 * 1. Dính đáp án vào ký tự trước: '}B. ' -> '}\nB. '
 * 2. Colon trước câu lệnh: def square(x):return -> def square(x):\n    return
 * 3. Statement keyword dính sau biểu thức: return x**2print(...) -> return x**2\nprint(...)
 * 4. Method call sau đóng ngoặc/nháy: } L.add(...) -> }\nL.add(...)
 * 5. for/while/if sau đóng ngoặc: print(...) for i in range... -> print(...)\nfor i in range...
 * 6. for i in range(...) s += i mà thiếu dấu hai chấm -> for i in range(...):\n    s += i
 * 7. Nhiều dấu nhắc >>> trên cùng một dòng -> tách xuống dòng
 */
function formatSquishedCode(text) {
  if (!text) return text;
  let s = text;

  // 1. Tách đáp án dính vào ký tự code trước (ngoặc, nháy, số): '}B. ' -> '}\nB. ' hoặc '10* B. ' -> '10\n* B. '
  s = s.replace(/([\}\)\"\'0-9])\s*((\*|\+)\s*[A-Ha-h][\.\)\:\/]\s+)/g, '$1\n$2');
  s = s.replace(/([\}\)\"\'0-9])([A-Ha-h][\.\)\:\/]\s+)/g, '$1\n$2');

  // 2. Colon trước câu lệnh: def square(x):return -> def square(x):\n    return
  s = s.replace(/(\:\s*)(return\b|print\b|for\b|while\b|if\b)/g, ':\n    $2');

  // 3. Statement keyword dính sau biểu thức (tránh ngắt dòng nếu đứng trước là từ mô tả tiếng Việt: "Lệnh print", "Biểu thức print")
  s = s.replace(/([0-9_\)\"]|\'|\]|\})\s*(print\(|print\s*[\'\"\(]|return\b)/g, (match, p1, p2, offset, fullStr) => {
    const before = fullStr.substring(Math.max(0, offset - 15), offset + p1.length);
    if (/(?:lệnh|thức|hàm|cho|biểu thức|dòng)\s*$/i.test(before)) {
      return match;
    }
    return `${p1}\n${p2}`;
  });

  // Sau phép gán: s += i print(s) -> s += i\nprint(s)
  s = s.replace(/([a-zA-Z_]\w*\s*[\+\-\*/]?=\s*[^;\n\(\)\"\']+?)\s+(print\(|print\s*[\'\"\(]|return\b)/g, '$1\n$2');

  // 4. Method call sau đóng ngoặc/nháy: } L.add(...) -> }\nL.add(...)
  s = s.replace(/(\})\s*([A-Za-z_]\w*\.(?:add|append|remove|clear|get|pop|update)\b)/g, '$1\n$2');

  // 5. for/while/if sau đóng ngoặc: print(...) for i in range... -> print(...)\nfor i in range...
  s = s.replace(/([\)\"]|\'|\]|\})\s*(for\s+[a-zA-Z_]\w*\s+in\b|while\b)/g, '$1\n$2');

  // 6. for i in range(...) s += i mà bị dính liền:
  s = s.replace(/(for\s+[a-zA-Z_]\w*\s+in\s+range\([^\)]+\):?)\s*([a-zA-Z_]\w*\s*[\+\-\*/]?=)/g, '$1\n$2');

  // 7. Nhiều dấu nhắc >>> trên cùng một dòng:
  s = s.replace(/(>>>[^\n]+?)\s*(>>>)/g, '$1\n$2');

  return s;
}

/**
 * Tự động sửa lỗi dãn chữ tiếng Việt và lỗi định dạng font khi copy từ PDF hoặc OCR scan:
 * 1. Ghép các dòng trôi từ chia 2 cột (Dictionary -> A, vào: "" -> A).
 * 2. Gỡ watermark nhúng vào từ (đư EDUQUIZợc -> được, s EDUQUIZố -> số, UIZ).
 * 3. Khử lặp lại tiêu đề câu hỏi (Kiểu String là:Kiểu String là: -> Kiểu String là:).
 * 4. Ghép các âm tiết bị tách rời (đ ây -> đây, đơ n -> đơn, tươ ng -> tương, đ ápán -> đáp án, đ úng -> đúng).
 * 5. Tách và chuẩn hóa các câu lệnh code bị dính liền nhau.
 */
function fixSpacedVietnamese(text) {
  if (!text) return text;

  // 0. Tách và bảo vệ tuyệt đối tất cả các thẻ hình ảnh [HINHANH:...]
  // để các biểu thức chính quy xử lý văn bản không bao giờ quét qua dữ liệu ảnh nặng (chống 100% treo trình duyệt / ReDoS)
  const imageMarkers = [];
  let s = text.replace(/\[HINHANH:[^\]]+\]/gi, match => {
    const placeholder = `__IMG_TOKEN_${imageMarkers.length}__`;
    imageMarkers.push({ placeholder, match });
    return placeholder;
  });

  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Gỡ lỗi gói 2 cột trong PDF
  s = fixTwoColumnWrappingInBlocks(s);

  // 2. Gỡ bỏ watermark EDUQUIZ, UIZ, QUIZLET, AZOTA nhúng trong từ hoặc cuối dòng
  s = s.replace(/[ \t]*(?:EDUQUIZ(?:\s*UIZ)?|\bUIZ\b)[ \t]*/gi, '');

  // 3. Sửa lặp tiêu đề câu hỏi do lỗi OCR/PDF (giới hạn độ dài 4-80 ký tự để chống ReDoS)
  s = s.replace(/([^:\.\?\n]{4,80}[:\.\?])\s*\1/gi, '$1');

  // 4. Sửa dấu câu bị cách xa chữ: "đồ thị ?" -> "đồ thị?"
  s = s.replace(/([A-Za-zÀ-ỹ0-9])\s+([?!:;,])/g, '$1$2');

  // 5. Phụ âm đầu đơn lẻ bị cách rời (không dùng \b vì \b không khớp chữ đ/Đ tiếng Việt)
  s = s.replace(/(^|[\s\t\(\[\{\"\',;:])([đĐdDcCtTnNmMlLbBhHgGsSpPkKrRvVxX]|ch|th|kh|ph|tr|nh|ng|gi)[ \t]+([aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵ][a-zA-ZÀ-ỹĐđ]{0,5})(?=[ \t\r\n.,!?:;)\/]|$)/gi, (match, prefix, cons, vowelPart) => {
    return prefix + cons + vowelPart;
  });

  // 6. Phụ âm cuối bị cách rời (coda): "đơ n" -> "đơn", "tươ ng" -> "tương", "lầ n" -> "lần", "mạ ng" -> "mạng", "họ c" -> "học", "mộ t" -> "một"
  s = s.replace(/([a-zA-ZÀ-ỹĐđ]*[aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵ])[ \t]+(ng|nh|ch|[cmnpt])(?=[ \t\r\n.,!?:;)\/]|$)/gi, '$1$2');

  // 7. Bán nguyên âm đuôi bị cách rời: "củ a" -> "của", "tạ o" -> "tạo", "bở i" -> "bởi", "giớ i" -> "giới", "thiệ u" -> "thiệu"
  s = s.replace(/([a-zA-ZÀ-ỹĐđ]*[àáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộơờớởỡợùúủũụừứửữựỳýỷỹỵươ])[ \t]+([aouiyeê])(?=[ \t\r\n.,!?:;)\/]|$)/gi, '$1$2');

  // 8. Tách các cụm từ bị dính chùm
  s = s.replace(/(^|[\s\t\(\[\{\"\',;:])đápán(?=[ \t\r\n.,!?:;)\/]|$)/gi, '$1đáp án');
  s = s.replace(/(^|[\s\t\(\[\{\"\',;:])tựnhư(?=[ \t\r\n.,!?:;)\/]|$)/gi, '$1tự như');
  s = s.replace(/(^|[\s\t\(\[\{\"\',;:])thứtự(?=[ \t\r\n.,!?:;)\/]|$)/gi, '$1thứ tự');
  s = s.replace(/Tối[ \t]*ư[ \t]*u/g, 'Tối ưu');
  s = s.replace(/tối[ \t]*ư[ \t]*u/g, 'tối ưu');
  s = s.replace(/([a-zÀ-ỹ])(chủứng)/gi, '$1 chủ ứng');
  s = s.replace(/\bchủứng\b/gi, 'chủ ứng');

  // 9. Tách và chuẩn hóa các câu lệnh code bị dính liền nhau
  s = formatSquishedCode(s);

  // 10. Khôi phục lại toàn bộ thẻ hình ảnh nguyên vẹn
  imageMarkers.forEach(item => {
    s = s.replace(item.placeholder, item.match);
  });

  // 11. Lọc các dòng chỉ có khoảng trắng
  return s.split('\n').filter(l => l.trim().length > 0).join('\n');
}

function fixSpellingAndFormattingKeepAnswers(rawText) {
  if (!rawText || !rawText.trim()) return rawText;

  // 1. Tách và làm sạch tiêu đề mở đầu / watermark rác
  const headerInfo = extractAndCleanExamHeader(rawText);
  if (headerInfo.title) {
    maybeApplyExtractedQuizTitle(headerInfo.title);
  }

  // 2. Sửa toàn diện lỗi chính tả, dãn chữ, nối âm tiết, gỡ watermark, ghép 2 cột bị trôi dòng
  let fixedText = fixSpacedVietnamese(headerInfo.text);

  // 3. Chuẩn hóa format câu hỏi và đánh số thứ tự gọn gàng
  fixedText = smartPreprocessExamText(fixedText);

  return fixedText;
}

// Regex nhận diện dòng đáp án toàn diện (DA: C, ĐA: C, D/A: C, Key: C, Đáp án: C, Answer: C, Ans: C, Chọn: C...)
const ANSWER_LINE_REGEX = /^(?:[\(\[\{]\s*)?(?:(?:Đáp\s*án|Dap\s*an)(?:\s*(?:đúng|dung))?(?:\s*là)?|Đ\/?A|D\/?A|Key|Ans(?:wer)?|Câu\s*đúng|Chọn(?:\s*đáp\s*án)?|Phương\s*án(?:\s*đúng)?)[\s\:\-\.]*([A-Fa-f])\b/i;

// Regex kiểm tra xem dòng có phải là tiền tố đáp án hoặc giải thích hay không
const ANSWER_PREFIX_TEST_REGEX = /^(?:(?:Đáp\s*án|Dap\s*an)(?:\s*(?:đúng|dung))?(?:\s*là)?|Đ\/?A|D\/?A|Key|Ans(?:wer)?|Câu\s*đúng|Chọn|Phương\s*án|Giải\s*thích|Lời\s*giải|Hướng\s*dẫn)[\s\:\-\.]/i;

// Regex nhận diện đáp án được đóng ngoặc nhúng trong dòng câu hỏi: [DA: C], (ĐA: C), (Đáp án: C)...
const EMBEDDED_ANSWER_REGEX = /(?:\[|\()(?:\s*(?:(?:Đáp\s*án|Dap\s*an)(?:\s*(?:đúng|dung))?(?:\s*là)?|Đ\/?A|D\/?A|Key|Ans(?:wer)?)[\s\:\-\.]*([A-Fa-f]))(?:\s*\]|\))/i;

// Regex các watermark nền tảng thi trắc nghiệm phổ biến (EduQuiz, Quizlet, Azota, VietJack...)
const EXAM_NOISE_LINE_REGEX = /^(?:EDUQUIZ(?:\s+UIZ)?|QUIZLET|AZOTA|SUBALIVE|VIETJACK|LOIGIAIHAY|VNDOC|THUVIENHOCLIEU|HOC247|TUYENSINH247)\b/i;

// Các dòng thông số đề thi, trang, mã đề, thời gian, thông tin thí sinh
const EXAM_METADATA_LINE_REGEX = /^(?:Số\s+trang\s*[:\s]\s*\d+|Số\s+câu\s*hỏi\s*[:\s]\s*\d+|Mã\s+đề(?:\s+thi)?\s*[:\s]\s*\w+|Thời\s+gian(?:\s+làm\s+bài)?\s*[:\s]|Trang\s+\d+(?:\s*[\/\-]\s*\d+)?\b|Page\s+\d+(?:\s*(?:of|\/)\s*\d+)?\b|Họ\s+(?:và\s+)?tên\s*(?:thí\s+sinh)?\s*[:\s\.…_-]|Số\s+báo\s+danh\s*[:\s\.…_-]|Lớp\s*[:\s\.…_-]|MSSV\s*[:\s\.…_-]|Phòng\s+thi\s*[:\s\.…_-])/i;

// Các tiêu đề phân đoạn thi trắc nghiệm (Phần 1, Phần 2, Phần I, Chương 1...)
const EXAM_SECTION_LINE_REGEX = /^(?:PHẦN|CHƯƠNG|MỤC|PART|SECTION)\s+(?:\d+|[IVXLCDM]+|[A-Z])(?:\s*[:\.\-].*)?$/i;

// Các ghi chú chân trang đề thi
const EXAM_FOOTER_NOISE_REGEX = /^(?:---\s*(?:HẾT|HET)\s*---|Cán\s+bộ\s+coi\s+thi\s+không\s+giải\s+thích|Thí\s+sinh\s+không\s+được\s+sử\s+dụng\s+tài\s+liệu)/i;

/**
 * Loại bỏ các dòng watermark, thông số trang, mã đề, phân đoạn khỏi luồng câu hỏi
 */
function cleanExamNoiseLines(text) {
  if (!text) return text;
  return text.split("\n").filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (EXAM_NOISE_LINE_REGEX.test(trimmed)) return false;
    if (EXAM_METADATA_LINE_REGEX.test(trimmed)) return false;
    if (EXAM_SECTION_LINE_REGEX.test(trimmed)) return false;
    if (EXAM_FOOTER_NOISE_REGEX.test(trimmed)) return false;
    return true;
  }).join("\n");
}

/**
 * Tách và làm sạch tiêu đề mở đầu đề thi (Document Header / Preamble)
 * Giúp tránh việc tiêu đề bài thi bị nhận diện nhầm thành câu hỏi đầu tiên.
 * Đồng thời tự động trích xuất tên đề thi (ví dụ: LẬP TRÌNH PYTHON HUBT (2TC) - 2026).
 */
function extractAndCleanExamHeader(rawText) {
  if (!rawText || !rawText.trim()) return { title: null, text: rawText };

  let normalizedRaw = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Nếu câu hỏi đầu tiên bị dính tiền tố trò chuyện hoặc tiêu đề trên cùng 1 dòng (vd: "lỗi chữ bạn ơi Câu 1: ...")
  normalizedRaw = normalizedRaw.replace(/^([^\n]+?)[ \t]+((?:Câu|Bài|Question|Part)\s*1[\.\:\/\-][^\n]*)$/gim, (m, p1, p2) => p1 + '\n' + p2);

  const lines = normalizedRaw.split("\n");
  const questionStartRegex = /^(?:Câu|Bài|Question|Part)\s*\d+[\.\:\/\s]|^\d+[\.\:\/]\s*[A-Za-zÀ-ỹ]|^\d+\s+[A-Za-zÀ-ỹ]{2,}/i;

  let firstQIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (questionStartRegex.test(t)) {
      firstQIdx = i;
      break;
    }
  }

  // Nếu không có số thứ tự câu hỏi rõ ràng, tìm câu hỏi kết thúc bằng '?' có phương án A, B, C, D theo sau
  if (firstQIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if ((t.endsWith("?") || t.endsWith(":?")) && !t.startsWith("*") && !/^[A-Fa-f][\.\)\:\/]/.test(t)) {
        const nextLines = lines.slice(i + 1, i + 6);
        const hasOpts = nextLines.some(l => /^(\*|\+)?\s*[A-Fa-f][\.\)\:\/]/.test(l.trim()));
        if (hasOpts) {
          firstQIdx = i;
          break;
        }
      }
    }
  }

  if (firstQIdx <= 0) {
    return { title: null, text: cleanExamNoiseLines(rawText) };
  }

  const preambleLines = lines.slice(0, firstQIdx).map(l => l.trim()).filter(l => l.length > 0);
  const questionsPart = lines.slice(firstQIdx).join("\n");

  // Nếu trong phần trước câu hỏi có chứa phương án A, B, C, D thì không được xóa (vì có thể là câu hỏi trần đầu tiên)
  const hasOptionsInPreamble = preambleLines.some(l => /^(\*|\+)?\s*[A-Fa-f][\.\)\:\/]/.test(l));
  if (hasOptionsInPreamble) {
    return { title: null, text: cleanExamNoiseLines(rawText) };
  }

  let candidateTitle = null;
  for (const line of preambleLines) {
    if (EXAM_NOISE_LINE_REGEX.test(line)) continue;
    if (EXAM_METADATA_LINE_REGEX.test(line)) continue;
    if (EXAM_SECTION_LINE_REGEX.test(line)) continue;
    if (EXAM_FOOTER_NOISE_REGEX.test(line)) continue;
    if (/^(?:BỘ|SỞ|PHÒNG)\s+GD/i.test(line)) continue;
    if (/^TRƯỜNG\s+(?:ĐẠI\s+HỌC|CAO\s+ĐẲNG|THPT|THCS|TIỂU\s+HỌC)/i.test(line)) continue;
    if (/^(?:KHOA|BỘ\s+MÔN)\s+/i.test(line)) continue;
    if (/^--+/.test(line)) continue;
    // Bỏ qua các câu chào hỏi/trò chuyện hoặc thông báo lỗi
    if (/^(?:lỗi|bạn\s*ơi|ad\s*ơi|thầy\s*ơi|cô\s*ơi|giúp\s*(?:mình|em)|cho\s*(?:mình|em)\s*hỏi|chào|hello|hi\b)/i.test(line)) continue;

    if (line.length >= 4) {
      candidateTitle = line.replace(/^(?:Môn|Học\s+phần|Tên\s+học\s+phần|Đề\s+thi)\s*[:\-\.]\s*/i, "").trim();
      break;
    }
  }

  return {
    title: candidateTitle,
    text: cleanExamNoiseLines(questionsPart)
  };
}

/**
 * Gợi ý tự động điền tiêu đề đề thi vào ô input nếu ô input đang trống hoặc mặc định
 */
function maybeApplyExtractedQuizTitle(title) {
  if (!title) return;
  const titleInput = document.getElementById("input-quiz-title");
  if (titleInput && (!titleInput.value || titleInput.value.trim() === "" || titleInput.value.startsWith("Đề thi ") || titleInput.value === "Chưa đặt tên")) {
    titleInput.value = title;
  }
}

// Trích xuất bảng đáp án riêng dạng "1.C 2.A 3.B" hoặc "1-C, 2-A" hoặc "1C 2A 3B"
function extractAnswerKeyTable(text) {
  const map = new Map();
  if (!text) return map;

  const regex = /(?:^|[\s,;|])(?:Câu\s*)?(\d{1,4})[\s\.\:\-\/)]*([A-Da-d])(?=[\s,;|\n]|$)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const qNum = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    if (qNum > 0 && qNum <= 1000) {
      map.set(qNum, letter);
    }
  }
  return map;
}

/**
 * Tiền xử lý thông minh để chuẩn hóa đề thi, khắc phục triệt để các lỗi nhận diện:
 * 1. Tách nhiều phương án trên cùng 1 dòng (A. ...  B. ...).
 * 2. Phát hiện câu hỏi bị gắn nhãn phương án (như "E. Cơ sở dữ liệu tập trung...?") và tách thành câu hỏi mới.
 * 3. Chuyển đổi các chữ cái bị nhảy (E, F, G, H...) về lại A, B, C, D tương ứng.
 * 4. Nhận diện các câu hỏi không có tiền tố "Câu X:" (câu hỏi trần kết thúc bằng dấu '?').
 * 5. Tự động đánh số liên tục Câu 1, Câu 2, Câu 3...
 */
function smartPreprocessExamText(rawText) {
  if (!rawText || !rawText.trim()) return "";

  // 1. Tách và làm sạch tiêu đề mở đầu / watermark đề thi
  const headerInfo = extractAndCleanExamHeader(rawText);
  if (headerInfo.title) {
    maybeApplyExtractedQuizTitle(headerInfo.title);
  }

  let normalized = fixSpacedVietnamese(headerInfo.text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Tách nếu có nhiều đáp án trên 1 dòng: "A. xxx   B. yyy" hoặc "* A. xxx B. yyy"
  normalized = normalized.split("\n").map(line => {
    const matches = [...line.matchAll(/(?:^|[\s\t]+)(\*|\+)?\s*([A-Ha-h])[\.\)\:\/]\s*/g)];
    if (matches.length > 1) {
      let result = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = (i + 1 < matches.length) ? matches[i + 1].index : line.length;
        result.push(line.slice(start, end).trim());
      }
      return result.join("\n");
    }
    return line;
  }).join("\n");

  const lines = normalized.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const processedLines = [];

  let currentOptionsCount = 0;
  let seenLetters = new Set();

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Dòng thẻ ảnh
    if (line.startsWith("[HINHANH:")) {
      let isForNextQuestion = false;
      for (let k = i + 1; k < lines.length; k++) {
        const nextT = lines[k].trim();
        if (!nextT || nextT.startsWith("[HINHANH:")) continue;
        const isNextQ = /^(?:Câu|Bài|Question|Part)\s*\d+[\.\:\/\s]/i.test(nextT) ||
                        /^\d+[\.\:\/\)]\s*[A-Za-zÀ-ỹ]/i.test(nextT) ||
                        /^\d+\s+[A-Za-zÀ-ỹ]{2,}/i.test(nextT) ||
                        nextT.endsWith(":?") ||
                        ((nextT.endsWith("?") || nextT.endsWith(":?")) && currentOptionsCount >= 2);
        if (isNextQ || (currentOptionsCount >= 2 && !/^(\*|\+)?\s*[A-Fa-f][\.\)\:\/]/.test(nextT))) {
          isForNextQuestion = true;
        }
        break;
      }

      if (isForNextQuestion && currentOptionsCount >= 2) {
        currentOptionsCount = 0;
        seenLetters.clear();
        processedLines.push(`\n${line}`);
      } else {
        processedLines.push(line);
      }
      continue;
    }

    // Nếu là câu hỏi trần đầu tiên không có tiền tố "Câu 1:" nhưng kết thúc bằng '?' hoặc có từ khóa câu hỏi và theo sau là các lựa chọn A, B, C, D
    const isExplicitQPrefixAtStart = /^(?:Câu|Bài|Question|Part)\s*\d+[\.\:\/\s]/i.test(line);
    if (i === 0 && !isExplicitQPrefixAtStart && !line.startsWith("Câu:") && (line.endsWith("?") || line.endsWith(":?") || /^(?:Chọn|Hãy\s+chọn|Tìm|Cho|Biết|Xét|Đâu\s+là|Trong\s+các)\b/i.test(line))) {
      const nextFew = lines.slice(1, 6);
      if (nextFew.some(l => /^(\*|\+)?\s*[A-Fa-f][\.\)\:\/]/.test(l.trim()))) {
        currentOptionsCount = 0;
        seenLetters.clear();
        processedLines.push(`Câu 1: ${line}`);
        continue;
      }
    }

    // Dòng bắt đầu câu hỏi rõ ràng:
    // Hỗ trợ "Câu 1:", "Bài 1.", "1. Nội dung", "76.Rút gọn" (không khoảng trắng), "83 Anh/chị" (thiếu dấu chấm)
    const methodCallRegex = /^[A-Za-z_]\w*\.[a-zA-Z_]\w*\s*\(/;
    const isNumberedCodeOrList = /^\d+[\.\:\/]\s*(?:[a-zA-Z_]\w*\s*[\=\+\-\*\/\%]|(?:def|class|import|from|for|while|if|return|print|console)\b|.*[\[\{\}\]\(\)\=\+\-\*\/;])/i;

    const isMethodCall = methodCallRegex.test(line);
    const isExplicitQPrefix = /^(?:Câu|Bài|Question|Part)\s*\d+[\.\:\/\s]/i.test(line);

    let isExplicitQ = false;
    if (isExplicitQPrefix) {
      isExplicitQ = true;
    } else if (!isMethodCall && !isNumberedCodeOrList.test(line)) {
      if (/^\d+[\.\:\/\)]\s*[A-Za-zÀ-ỹ]/i.test(line) || /^\d+\s+[A-Za-zÀ-ỹ]{2,}/i.test(line)) {
        if (currentOptionsCount >= 2 || processedLines.length === 0) {
          isExplicitQ = true;
        }
      }
    }

    if (isExplicitQ) {
      currentOptionsCount = 0;
      seenLetters.clear();
      line = line.replace(/^(?:Câu|Bài|Question|Part)?\s*(\d+)[\.\:\/\s]+\s*/i, "Câu $1: ");
      const prevLine = processedLines.length > 0 ? processedLines[processedLines.length - 1].trim() : "";
      if (prevLine.startsWith("[HINHANH:")) {
        processedLines.push(line);
      } else {
        processedLines.push(`\n${line}`);
      }
      continue;
    }

    // Nhận diện câu hỏi không đánh số:
    // 1. Câu kết thúc bằng ":?" (như "Các phương pháp tối ưu cơ bản:?")
    // 2. Câu trần có đuôi '?' xuất hiện khi câu trước đã có >= 2 đáp án A, B, C, D
    const isUnnumberedQ = (line.endsWith(":?") && !line.startsWith("*") && !/^[A-Fa-f][\.\)\:\/]/.test(line)) ||
                          ((line.endsWith("?") || line.endsWith(":?")) && currentOptionsCount >= 2);

    if (isUnnumberedQ) {
      currentOptionsCount = 0;
      seenLetters.clear();
      processedLines.push(`\nCâu: ${line}`);
      continue;
    }

    // Kiểm tra dòng đáp án A, B, C, D, E, F... (không phải lời gọi hàm như L.append(...), D.clear())
    const optMatch = !isMethodCall ? line.match(/^(\*+|\+|\([xX]\)|\[[xX]\])?\s*([A-Ha-h])[\.\)\:\/]\s+(.*)$/) : null;
    if (optMatch) {
      const isStar = !!optMatch[1];
      const letter = optMatch[2].toUpperCase();
      const content = optMatch[3].trim();

      // Kiểm tra xem dòng này có thực sự là câu hỏi bị gán nhãn phương án không:
      const isActuallyQuestion = (content.endsWith("?") || content.endsWith(":?") || /\b(?:là gì|như thế nào|sự gì)\s*[\?\:]?$/i.test(content)) &&
                                 (currentOptionsCount >= 3 || seenLetters.has('A'));

      if (isActuallyQuestion) {
        currentOptionsCount = 0;
        seenLetters.clear();
        processedLines.push(`\nCâu: ${content}`);
        continue;
      }

      // Nếu gặp lại 'A.' khi đã có từ 2 đáp án trở lên -> Chắc chắn bắt đầu câu hỏi mới
      if (letter === 'A' && currentOptionsCount >= 2) {
        currentOptionsCount = 0;
        seenLetters.clear();
        processedLines.push(`\nCâu:`);
      }

      let adjustedLetter = letter;
      if (currentOptionsCount === 0 && letter !== 'A') {
        adjustedLetter = String.fromCharCode(65 + currentOptionsCount);
      } else if (currentOptionsCount > 0) {
        const expectedLetter = String.fromCharCode(65 + currentOptionsCount);
        if (letter > expectedLetter && (letter.charCodeAt(0) - 65) >= 4) {
          adjustedLetter = expectedLetter;
        }
      }

      currentOptionsCount++;
      seenLetters.add(adjustedLetter);
      processedLines.push(`${isStar ? '*' : ''}${adjustedLetter}. ${content}`);
      continue;
    }

    processedLines.push(line);
  }

  // Đánh lại số thứ tự Câu 1:, Câu 2:, Câu 3:... chuẩn mực
  let result = processedLines.join("\n");
  let qNum = 1;
  result = result.replace(/^Câu(?:\s*\d+)?\s*[:\.]/gim, () => `Câu ${qNum++}:`);

  return result.trim();
}

/**
 * Tách danh sách các dòng văn bản thành các khối câu hỏi độc lập,
 * xử lý chính xác vị trí của hình ảnh (hình ảnh nằm trước câu hỏi sẽ được gán cho câu hỏi đó)
 */
function splitIntoQuestionBlocks(lines) {
  const questionBlocks = [];
  let currentBlockLines = [];
  const isNumberedCodeOrList = /^\d+[\.\:\/]\s*(?:[a-zA-Z_]\w*\s*[\=\+\-\*\/\%]|(?:def|class|import|from|for|while|if|return|print|console)\b|.*[\[\{\}\]\(\)\=\+\-\*\/;])/i;
  const isMethodCall = /^[A-Za-z_]\w*\.[a-zA-Z_]\w*\s*\(/;

  function isLineQuestionStart(t) {
    if (!t) return false;
    if (isMethodCall.test(t)) return false;
    if (isNumberedCodeOrList.test(t)) return false;
    if (/^(?:Câu|Bài|Question|Part)\s*\d+[\.\:\/\s]/i.test(t)) return true;
    if (/^(?:Câu|Bài|Question)\s*[:\.]/i.test(t)) return true;
    if (t.endsWith(":?")) return true;
    const currentHasOptions = currentBlockLines.some(l => /^(\*|\+)?\s*[A-Fa-f][\.\)\:\/]\s*/.test(l.trim()));
    if (/^\d+[\.\:\/]\s*[A-Za-zÀ-ỹ]/i.test(t) || /^\d+\s+[A-Za-zÀ-ỹ]{2,}/i.test(t)) {
      return currentHasOptions || currentBlockLines.length === 0;
    }
    return false;
  }

  function hasSubsequentQuestionStart(startIndex) {
    for (let k = startIndex; k < lines.length; k++) {
      const t = lines[k].trim();
      if (!t || t.startsWith("[HINHANH:")) continue;
      if (isLineQuestionStart(t)) return true;
      return false;
    }
    return false;
  }

  function currentBlockHasOnlyImagesOrEmpty() {
    return currentBlockLines.every(l => {
      const t = l.trim();
      return !t || t.startsWith("[HINHANH:");
    });
  }

  function isValidQuestionCandidateBlock(blockLines) {
    if (!blockLines || blockLines.length === 0) return false;
    const hasOptions = blockLines.some(l => /^(\*|\+)?\s*[A-Fa-f][\.\)\:\/]\s*/.test(l.trim()));
    const firstLine = blockLines.find(l => l.trim().length > 0 && !l.startsWith("[HINHANH:")) || "";
    const trimmedFirst = firstLine.trim();
    return hasOptions || isLineQuestionStart(trimmedFirst);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Dòng thẻ hình ảnh
    if (trimmed.startsWith("[HINHANH:")) {
      if (hasSubsequentQuestionStart(i + 1) && !currentBlockHasOnlyImagesOrEmpty() && currentBlockLines.length > 0) {
        if (isValidQuestionCandidateBlock(currentBlockLines)) {
          questionBlocks.push(currentBlockLines.join("\n"));
        }
        currentBlockLines = [];
      }
      currentBlockLines.push(line);
      continue;
    }

    if (isLineQuestionStart(trimmed)) {
      if (!currentBlockHasOnlyImagesOrEmpty() && currentBlockLines.length > 0) {
        if (isValidQuestionCandidateBlock(currentBlockLines)) {
          questionBlocks.push(currentBlockLines.join("\n"));
        }
        currentBlockLines = [];
      }
      currentBlockLines.push(line);
      continue;
    }

    currentBlockLines.push(line);
  }

  if (currentBlockLines.length > 0 && !currentBlockHasOnlyImagesOrEmpty()) {
    if (isValidQuestionCandidateBlock(currentBlockLines)) {
      questionBlocks.push(currentBlockLines.join("\n"));
    }
  }

  return questionBlocks;
}

/**
 * Phân tích văn bản trắc nghiệm thông minh:
 * Nhận diện dạng:
 * Câu 1: [Nội dung]
 * A. ...
 * *B. ... (Đáp án đúng)
 * C. ...
 * D. ...
 * Hoặc:
 * Đáp án: B / ĐA: B / Key: B
 * Giải thích: ...
 */
function parseRawQuestions(rawText) {
  if (!rawText || !rawText.trim()) {
    return { questions: [], totalCount: 0, validCount: 0, invalidCount: 0 };
  }

  // 1. Tách và làm sạch tiêu đề mở đầu / watermark đề thi
  const headerInfo = extractAndCleanExamHeader(rawText);
  if (headerInfo.title) {
    maybeApplyExtractedQuizTitle(headerInfo.title);
  }

  // 2. Tiền xử lý thông minh để sửa lỗi nhận diện
  const preprocessed = smartPreprocessExamText(headerInfo.text);

  const normalized = preprocessed
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  // Tách các câu hỏi bằng thuật toán thông minh, đảm bảo hình ảnh nằm đúng câu
  const lines = normalized.split("\n");
  let candidateBlocks = splitIntoQuestionBlocks(lines);

  // Nếu không nhận diện được tiền tố "Câu X:", thử chia theo 2 dòng trống liên tiếp
  if (candidateBlocks.length <= 1) {
    const doubleNewlineBlocks = normalized.split(/\n\s*\n+/);
    if (doubleNewlineBlocks.length > 1) {
      candidateBlocks = doubleNewlineBlocks;
    }
  }

  const globalAnswerTableMap = extractAnswerKeyTable(rawText);
  const parsedQuestions = [];
  let validCount = 0;
  let invalidCount = 0;

  candidateBlocks.forEach((block, bIdx) => {
    const bLines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (bLines.length < 2) return;

    // Trích xuất hình ảnh nếu có trong khối câu hỏi (hỗ trợ cả data:image/... và token pdf_img_...)
    let questionImage = null;
    let questionImages = [];
    const imgMatches = [...block.matchAll(/\[HINHANH:([^\]]+)\]/gi)];
    if (imgMatches.length > 0) {
      questionImages = imgMatches.map(m => {
        const rawKey = m[1].trim();
        return pdfImageRegistry.get(rawKey) || rawKey;
      });
      questionImage = questionImages[0];
    }

    let questionText = "";
    const options = [];
    let correctIndex = -1;
    let explanation = "";

    // Regex nhận diện các lựa chọn: A. / A) / A: / [A] / *A. / **A. / +A. (cho phép \s*)
    const optionRegex = /^(\*+|\[x\]|\(x\)|\+)?\s*([A-Fa-f])[\.\)\:\/]\s*(.*)$/;
    // Regex nhận diện giải thích (hỗ trợ cả markdown **Lời giải:**, Lời giải chi tiết:, Hướng dẫn giải:...)
    const explanationRegex = /^[\*\#\-\–\—\>\s💡✍️⚡]*(?:Giải\s*thích(?:\s*chi\s*tiết)?|Lời\s*giải(?:\s*chi\s*tiết)?|Hướng\s*dẫn(?:\s*giải)?|Explanation)[\s\:\-\.\*]+(.*)$/i;

    let readingQuestion = true;
    let readingExplanation = false;
    let questionTitleFound = false;
    const multiLineQuestionExtra = [];
    const plainCandidateOptionLines = [];

    for (let i = 0; i < bLines.length; i++) {
      let line = bLines[i];

      // Bỏ qua dòng thẻ ảnh khi đọc văn bản câu hỏi
      if (line.startsWith("[HINHANH:")) {
        continue;
      }

      // Kiểm tra dòng giải thích
      const explMatch = line.match(explanationRegex);
      if (explMatch) {
        readingExplanation = true;
        readingQuestion = false;
        explanation = explMatch[1] || "";
        continue;
      }
      if (readingExplanation) {
        explanation += " " + line;
        continue;
      }

      // Kiểm tra dòng đáp án (hỗ trợ DA: C, ĐA: C, Key: C, Đáp án: C, Ans: C, Chọn: C...)
      const ansMatch = line.match(ANSWER_LINE_REGEX);
      if (ansMatch) {
        readingQuestion = false;
        const letter = ansMatch[1].toUpperCase();
        correctIndex = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3...
        continue;
      }

      // Kiểm tra dòng lựa chọn A, B, C, D
      const optMatch = line.match(optionRegex);
      if (optMatch) {
        readingQuestion = false;
        const isStar = !!optMatch[1];
        const letter = optMatch[2].toUpperCase();
        let text = optMatch[3].trim();
        const optionIdx = options.length;

        // Nếu có dấu * hoặc (x), đánh dấu là đáp án đúng
        if (isStar || text.endsWith("(đúng)") || text.endsWith("*")) {
          correctIndex = optionIdx;
        }

        // Tách Lời giải / Giải thích nếu nó bị dính cùng dòng với phương án lựa chọn
        const inlineExplMatch = text.match(/(?:[\.\;\-\–\—\s]+|\s*[\(\[\{]\s*)(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn|Explanation)[\s\:\-\.]+([^\)\]\}]+)[\)\]\}]?$/i);
        if (inlineExplMatch) {
          if (!explanation) {
            explanation = inlineExplMatch[1].trim();
          }
          text = text.slice(0, inlineExplMatch.index).trim();
        }

        // Làm sạch đuôi (đúng) hoặc * nếu có trong nội dung
        const cleanedText = text.replace(/\s*\((?:đúng|dung)\)$/i, "").replace(/\*$/, "").trim();
        options.push(cleanedText);
        continue;
      }

      // Nếu đang ở phần câu hỏi
      if (readingQuestion) {
        if (!questionTitleFound) {
          const stripped = line.replace(/^(?:Câu|Bài|Question)?\s*\d+[\.\:\/]\s*/i, "");
          questionText = stripped;
          questionTitleFound = true;
        } else {
          multiLineQuestionExtra.push(line);
          plainCandidateOptionLines.push(line);
        }
      }
    }

    // Nếu đã có các phương án lựa chọn chính thức (A, B, C, D), thì các dòng văn bản phụ trước đó chính là phần mô tả của câu hỏi (giữ nguyên ngắt dòng để hiển thị khối code đẹp mắt)!
    if (options.length >= 2 && multiLineQuestionExtra.length > 0) {
      questionText += "\n" + multiLineQuestionExtra.join("\n");
    }

    // TỰ ĐỘNG THÊM A, B, C, D NẾU CÂU HỎI CHƯA CÓ TIỀN TỐ LỰA CHỌN
    const isExplicitQuestionStart = questionTitleFound && (
      /^(?:Câu|Bài|Question|Part)\s*\d+/i.test(bLines[0]) ||
      /^\d+[\.\:\)]/.test(bLines[0]) ||
      bLines[0].trim().endsWith("?") ||
      bLines[0].trim().endsWith(":?")
    );

    if (isExplicitQuestionStart && options.length < 2 && plainCandidateOptionLines.length >= 2) {
      plainCandidateOptionLines.forEach((pLine, pIdx) => {
        let cleanOpt = pLine;
        const isStar = cleanOpt.startsWith("*") || cleanOpt.startsWith("+") || cleanOpt.includes("(đúng)");
        cleanOpt = cleanOpt.replace(/^[\*\+]\s*/, "");
        cleanOpt = cleanOpt.replace(/^[\-\•\o\d\.]+\s*/, "");
        cleanOpt = cleanOpt.replace(/\s*\((?:đúng|dung)\)$/i, "").trim();

        if (isStar) {
          correctIndex = pIdx;
        }
        options.push(cleanOpt);
      });
    }

    // Làm sạch thẻ hình ảnh còn sót lại trong questionText
    questionText = questionText.replace(/\[HINHANH:[^\]]+\]/gi, "").trim();

    // Nhận diện đáp án nhúng trong tiêu đề hoặc bảng đáp án riêng nếu chưa có
    if (correctIndex === -1) {
      const embeddedMatch = questionText.match(EMBEDDED_ANSWER_REGEX);
      if (embeddedMatch) {
        const letter = embeddedMatch[1].toUpperCase();
        correctIndex = letter.charCodeAt(0) - 65;
        questionText = questionText.replace(EMBEDDED_ANSWER_REGEX, "").trim();
      }
    }

    if (correctIndex === -1 && globalAnswerTableMap && globalAnswerTableMap.has(bIdx + 1)) {
      const letter = globalAnswerTableMap.get(bIdx + 1);
      correctIndex = letter.charCodeAt(0) - 65;
    }

    if (questionText && options.length >= 2) {
      const isValid = correctIndex >= 0 && correctIndex < options.length;
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }

      parsedQuestions.push({
        id: `q-${Date.now()}-${bIdx}`,
        text: questionText.trim(),
        image: questionImage,
        images: questionImages,
        options: options,
        correctIndex: isValid ? correctIndex : 0, // Fallback default to A if missing
        hasValidAnswer: isValid,
        explanation: explanation.trim()
      });
    }
  });

  return {
    questions: parsedQuestions,
    totalCount: parsedQuestions.length,
    validCount: validCount,
    invalidCount: invalidCount
  };
}

// Debounce helper for fast typing without lag
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Live preview & status bar update for Smart Paste
const updateSmartParsePreview = debounce(() => {
  const textarea = document.getElementById("smart-text-input");
  if (!textarea) return;

  const result = parseRawQuestions(textarea.value);

  const totalEl = document.getElementById("parse-stat-total");
  const validEl = document.getElementById("parse-stat-valid");
  const invalidEl = document.getElementById("parse-stat-invalid");
  const invalidContainer = document.getElementById("parse-stat-invalid-container");

  if (totalEl) totalEl.textContent = result.totalCount;
  if (validEl) validEl.textContent = result.validCount;
  if (invalidEl) invalidEl.textContent = result.invalidCount;

  if (invalidContainer) {
    invalidContainer.style.display = result.invalidCount > 0 ? "flex" : "none";
  }

  // Render preview questions
  const previewContainer = document.getElementById("parsed-preview-container");
  if (previewContainer && previewContainer.style.display !== "none") {
    renderParsedQuestionsList(result.questions);
  }
}, 250);

function renderParsedQuestionsList(questions) {
  const container = document.getElementById("parsed-preview-container");
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.875rem;">Chưa có câu hỏi nào được nhận diện.</p>`;
    return;
  }

  container.innerHTML = questions.map((q, idx) => {
    return `
      <div class="preview-question-card">
        <div class="preview-question-header">
          <strong>Câu ${idx + 1}: ${escapeHtml(q.text)}</strong>
          ${q.hasValidAnswer 
            ? `<span class="badge badge-success">Đã có đáp án</span>` 
            : `<span class="badge badge-danger">Chưa có đáp án!</span>`}
        </div>
        ${q.image ? `<div style="margin: 0.5rem 0;"><img src="${q.image}" alt="Hình ảnh câu hỏi" style="max-height: 140px; max-width: 100%; border-radius: 8px; border: 1px solid var(--border-subtle); display: block;" /></div>` : ''}
        <div class="preview-options-list">
          ${q.options.map((opt, optIdx) => {
            const isCorrect = optIdx === q.correctIndex;
            const letter = String.fromCharCode(65 + optIdx);
            return `
              <div class="preview-option-item ${isCorrect ? 'correct' : ''}">
                <strong>${letter}.</strong>
                <span>${escapeHtml(opt)}</span>
                ${isCorrect ? `<span style="margin-left: auto;">✔ Đáp án đúng</span>` : ''}
              </div>
            `;
          }).join("")}
        </div>
        ${q.explanation ? `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-muted);">💡 <em>Giải thích: ${escapeHtml(q.explanation)}</em></div>` : ''}
      </div>
    `;
  }).join("");
}

// =============================================================================
// 8. CREATOR TABS & MANUAL BUILDER
// =============================================================================

let manualQuestionsList = [];

// Đặt lại toàn bộ dữ liệu Creator về trạng thái ban đầu sạch sẽ như lúc vừa tải trang
function resetCreatorForm() {
  const titleInput = document.getElementById("input-quiz-title");
  const catInput = document.getElementById("input-quiz-category");
  const timeInput = document.getElementById("input-quiz-time");
  const descInput = document.getElementById("input-quiz-desc");
  const textarea = document.getElementById("smart-text-input");

  if (titleInput) titleInput.value = "";
  if (catInput) catInput.value = "Chung";
  if (timeInput) timeInput.value = 15;
  if (descInput) descInput.value = "";
  if (textarea) textarea.value = "";

  // Reset file uploader nếu có
  const fileUploader = document.getElementById("file-uploader");
  if (fileUploader) fileUploader.value = "";

  // Reset OCR images
  const ocrInput = document.getElementById("input-ai-ocr-files");
  if (ocrInput) ocrInput.value = "";
  const ocrGallery = document.getElementById("ocr-thumbnails-grid");
  if (ocrGallery) ocrGallery.innerHTML = "";
  const ocrPreviewArea = document.getElementById("ocr-selected-images-container");
  if (ocrPreviewArea) ocrPreviewArea.style.display = "none";
  if (AppState) AppState.ocrImages = [];
  if (window.uploadedOcrImages) window.uploadedOcrImages = [];

  // Reset toàn bộ thông báo và panel "AI vừa sửa đáp án"
  currentAiAuditChanges = [];
  lastAuditSnapshot = null;
  const statAuditedContainer = document.getElementById("parse-stat-audited-container");
  if (statAuditedContainer) statAuditedContainer.style.display = "none";
  const statAuditedCount = document.getElementById("parse-stat-audited-count");
  if (statAuditedCount) statAuditedCount.textContent = "0";

  const btnToggleAudited = document.getElementById("btn-toggle-audited-panel");
  if (btnToggleAudited) btnToggleAudited.style.display = "none";
  const btnToggleAuditedCount = document.getElementById("btn-toggle-audited-count");
  if (btnToggleAuditedCount) btnToggleAuditedCount.textContent = "0";

  const diffPanel = document.getElementById("ai-audit-diff-panel");
  if (diffPanel) diffPanel.style.display = "none";
  const diffItems = document.getElementById("ai-audit-diff-items-container");
  if (diffItems) diffItems.innerHTML = "";
  const diffBadge = document.getElementById("ai-audit-diff-badge");
  if (diffBadge) diffBadge.textContent = "0 câu đã sửa";

  // Reset thống kê số câu đã nhận diện
  const totalEl = document.getElementById("parse-stat-total");
  const validEl = document.getElementById("parse-stat-valid");
  const invalidEl = document.getElementById("parse-stat-invalid");
  const invalidContainer = document.getElementById("parse-stat-invalid-container");
  if (totalEl) totalEl.textContent = "0";
  if (validEl) validEl.textContent = "0";
  if (invalidEl) invalidEl.textContent = "0";
  if (invalidContainer) invalidContainer.style.display = "none";

  const parsedPreview = document.getElementById("parsed-preview-container");
  if (parsedPreview) {
    parsedPreview.style.display = "none";
    parsedPreview.innerHTML = "";
  }
  const btnToggleParsed = document.getElementById("btn-toggle-parsed-preview");
  if (btnToggleParsed) btnToggleParsed.textContent = "Xem chi tiết các câu đã phân tích";

  // Reset câu hỏi soạn thủ công
  manualQuestionsList = [];
  renderManualQuestions();

  // Reset tab về tab-smart-paste
  document.querySelectorAll(".creator-tab").forEach(t => t.classList.remove("active"));
  const firstTab = document.querySelector('.creator-tab[data-tab="tab-smart-paste"]');
  if (firstTab) firstTab.classList.add("active");
  document.querySelectorAll(".tab-pane").forEach(p => p.style.display = "none");
  const firstPane = document.getElementById("tab-smart-paste");
  if (firstPane) firstPane.style.display = "block";
}

function openCreator(editQuiz = null) {
  switchView("view-creator");
  resetCreatorForm();

  if (editQuiz) {
    const titleInput = document.getElementById("input-quiz-title");
    const catInput = document.getElementById("input-quiz-category");
    const timeInput = document.getElementById("input-quiz-time");
    const descInput = document.getElementById("input-quiz-desc");
    if (titleInput) titleInput.value = editQuiz.title || "";
    if (catInput) catInput.value = editQuiz.category || "";
    if (timeInput) timeInput.value = editQuiz.timeLimit || 15;
    if (descInput) descInput.value = editQuiz.description || "";
  }

  updateSmartParsePreview();
}

function renderManualQuestions() {
  const container = document.getElementById("manual-questions-container");
  if (!container) return;

  if (manualQuestionsList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: var(--bg-app); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
        <p style="color: var(--text-muted); margin-bottom: 0.75rem;">Chưa có câu hỏi thủ công nào. Bấm nút bên dưới để thêm câu hỏi đầu tiên!</p>
        <button class="btn btn-secondary btn-sm" onclick="addManualQuestion()">+ Thêm Câu Hỏi</button>
      </div>
    `;
    return;
  }

  container.innerHTML = manualQuestionsList.map((q, idx) => {
    return `
      <div class="preview-question-card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--primary);">Câu hỏi ${idx + 1}</h4>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <button type="button" class="btn btn-ghost btn-sm" onclick="fixSpellingManualQuestion(${idx})" title="Sửa lỗi chính tả & dãn chữ cho câu này (Giữ nguyên đáp án)" style="color: #10b981; font-size: 0.8rem; padding: 0.25rem 0.5rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Sửa chính tả
            </button>
            <button class="btn btn-ghost btn-sm" onclick="removeManualQuestion(${idx})" style="color: var(--danger);">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Xóa
            </button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Nội dung câu hỏi:</label>
          <input type="text" class="form-input" value="${escapeHtml(q.text)}" onchange="updateManualQuestionText(${idx}, this.value)" placeholder="Nhập câu hỏi...">
        </div>

        <div style="margin-bottom: 1rem;">
          <label class="form-label">Các lựa chọn (Tích chọn đáp án ĐÚNG):</label>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.35rem;">
            ${q.options.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isChecked = optIdx === q.correctIndex;
              return `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="radio" name="manual-correct-${idx}" ${isChecked ? 'checked' : ''} onchange="setManualCorrect(${idx}, ${optIdx})" style="cursor: pointer; width: 18px; height: 18px;">
                  <strong style="width: 24px;">${letter}.</strong>
                  <input type="text" class="form-input" value="${escapeHtml(opt)}" onchange="updateManualOptionText(${idx}, ${optIdx}, this.value)" placeholder="Lựa chọn ${letter}..." style="flex: 1;">
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Giải thích chi tiết (tùy chọn):</label>
          <input type="text" class="form-input" value="${escapeHtml(q.explanation || '')}" onchange="updateManualExplanation(${idx}, this.value)" placeholder="Giải thích vì sao đáp án này đúng...">
        </div>
      </div>
    `;
  }).join("");
}

function addManualQuestion() {
  manualQuestionsList.push({
    id: `mq-${Date.now()}`,
    text: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: ""
  });
  renderManualQuestions();
}

function removeManualQuestion(idx) {
  manualQuestionsList.splice(idx, 1);
  renderManualQuestions();
}

function updateManualQuestionText(idx, val) {
  if (manualQuestionsList[idx]) manualQuestionsList[idx].text = val;
}

function updateManualOptionText(qIdx, optIdx, val) {
  if (manualQuestionsList[qIdx]) manualQuestionsList[qIdx].options[optIdx] = val;
}

function setManualCorrect(qIdx, optIdx) {
  if (manualQuestionsList[qIdx]) manualQuestionsList[qIdx].correctIndex = optIdx;
}

function updateManualExplanation(idx, val) {
  if (manualQuestionsList[idx]) manualQuestionsList[idx].explanation = val;
}

function fixSpellingManualQuestion(idx) {
  if (idx < 0 || idx >= manualQuestionsList.length) return;
  const q = manualQuestionsList[idx];
  q.text = fixSpacedVietnamese(q.text || "");
  if (Array.isArray(q.options)) {
    q.options = q.options.map(opt => fixSpacedVietnamese(opt || ""));
  }
  if (q.explanation) {
    q.explanation = fixSpacedVietnamese(q.explanation);
  }
  renderManualQuestions();
  showToast(`✓ Đã sửa chính tả cho Câu ${idx + 1} (Giữ nguyên đáp án)!`, "success");
}

function fixSpellingManualQuestionsAll() {
  if (manualQuestionsList.length === 0) {
    showToast("Chưa có câu hỏi nào để sửa chính tả!", "warning");
    return;
  }
  manualQuestionsList.forEach(q => {
    q.text = fixSpacedVietnamese(q.text || "");
    if (Array.isArray(q.options)) {
      q.options = q.options.map(opt => fixSpacedVietnamese(opt || ""));
    }
    if (q.explanation) {
      q.explanation = fixSpacedVietnamese(q.explanation);
    }
  });
  renderManualQuestions();
  showToast(`✓ Đã sửa sạch chính tả cho toàn bộ ${manualQuestionsList.length} câu hỏi (Giữ nguyên đáp án)!`, "success");
}

// =============================================================================
// AI FILTER, CLEANER & GEMINI ENHANCER
// =============================================================================

function aiFilterAndCleanExam(rawText) {
  if (!rawText || !rawText.trim()) return rawText;

  // 1. Tách và làm sạch tiêu đề mở đầu / watermark đề thi
  const headerInfo = extractAndCleanExamHeader(rawText);
  if (headerInfo.title) {
    maybeApplyExtractedQuizTitle(headerInfo.title);
  }

  let text = cleanExamNoiseLines(headerInfo.text);

  // 1. Loại bỏ các thông tin rác đầu đề/cuối đề của kỳ thi
  const noisePatterns = [
    /^(?:SỞ|PHÒNG)\s+GD(?:&|\s+VÀ\s+)ĐT[^\n]*/gim,
    /^TRƯỜNG\s+THPT[^\n]*/gim,
    /^ĐỀ\s+THI\s+(?:HỌC\s+KỲ|THỬ|CHÍNH\s+THỨC)[^\n]*/gim,
    /^NĂM\s+HỌC\s+\d{4}[^\n]*/gim,
    /^MÃ\s+ĐỀ(?:\s+THI)?\s*[:\s]\s*\w+/gim,
    /^(?:Họ\s+và\s+tên|Họ\s+tên)\s+thí\s+sinh\s*[:\s\.…_-]+/gim,
    /^Số\s+báo\s+danh\s*[:\s\.…_-]+/gim,
    /^Lớp\s*[:\s\.…_-]+/gim,
    /^Trang\s+\d+\s*\/\s*\d+/gim,
    /^---\s*(?:HẾT|HET)\s*---/gim,
    /^Cán\s+bộ\s+coi\s+thi\s+không\s+giải\s+thích\s+gì\s+thêm\.?/gim
  ];

  noisePatterns.forEach(pattern => {
    text = text.replace(pattern, "");
  });

  // 2. Chạy bộ tiền xử lý thông minh để chuẩn hóa và tách các câu hỏi bị dính chùm
  text = smartPreprocessExamText(text);

  // 3. Tự động thêm A, B, C, D cho những câu còn lại nếu chưa có tiền tố
  const questionBlocks = splitIntoQuestionBlocks(text.split("\n"));
  const cleanedParts = questionBlocks.map(part => {
    const lines = part.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 3) return part;

    const imageLines = lines.filter(l => l.startsWith("[HINHANH:"));
    const textLines = lines.filter(l => !l.startsWith("[HINHANH:"));

    if (textLines.length < 2) return part;

    const qLine = textLines[0];
    const restLines = textLines.slice(1);

    // Kiểm tra xem đã có A., B., C., D. chưa (cho phép \s*)
    const hasAbcd = restLines.some(l => /^(\*|\+)?\s*[A-Fa-f][\.\)\:\/]\s*/.test(l));
    if (hasAbcd) return part;

    // Tách riêng giải thích hoặc dòng đáp án
    const optionLines = [];
    const trailing = [];
    restLines.forEach(l => {
      if (ANSWER_PREFIX_TEST_REGEX.test(l)) {
        trailing.push(l);
      } else {
        optionLines.push(l);
      }
    });

    if (optionLines.length >= 2 && optionLines.length <= 6) {
      const formattedOptions = optionLines.map((opt, idx) => {
        let cleanedOpt = opt.replace(/^[\*\+]\s*/, "");
        cleanedOpt = cleanedOpt.replace(/^[A-Fa-f][\.\)\:\/]\s*/, "");
        cleanedOpt = cleanedOpt.replace(/^[\-\•\o\d\.]+\s*/, "");
        const isCorrect = opt.startsWith("*") || opt.startsWith("+") || opt.includes("(đúng)");
        cleanedOpt = cleanedOpt.replace(/\s*\((?:đúng|dung)\)$/i, "").trim();
        const letter = String.fromCharCode(65 + idx);
        return `${isCorrect ? '*' : ''}${letter}. ${cleanedOpt}`;
      });

      return [qLine, ...imageLines, ...formattedOptions, ...trailing].join("\n");
    }

    return part;
  });

  return cleanedParts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

// =============================================================================
// GEMINI AI INTEGRATION - DYNAMIC MODEL DISCOVERY & QUIZ AUDITOR
// =============================================================================

// Danh sách các mô hình Google Gemini văn bản hỗ trợ chuẩn generateContent ổn định nhất (Thế hệ Gemini 3+ mới nhất)
const GEMINI_FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.8-pro",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.5-pro",
  "gemini-3.0-flash"
];

// Danh sách độ ưu tiên mô hình văn bản MỚI NHẤT & ỔN ĐỊNH của Google cho generateContent
const GEMINI_NEWEST_PRIORITY = [
  "gemini-3.8-flash",
  "gemini-3.8-pro",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.5-pro",
  "gemini-3.0-flash"
];

let activeGeminiModel = getSavedGeminiModel();

// Tự động khám phá danh sách model Google Gemini thực tế được cấp phép, LỌC BỎ các model chỉ hỗ trợ AUDIO/TTS hoặc chỉ hỗ trợ Interactions API hoặc đã bị ngưng
async function discoverGeminiModels(apiKey) {
  const cleanKey = (apiKey || "").trim();
  if (!cleanKey) return [];

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${resp.status}`);
    }
    const data = await resp.json();
    const nonGenerateContentPatterns = [
      "deep-research", "research", "interactions", "computer-use", "8b",
      "tts", "-audio", "audio", "embedding", "imagen", "veo", "aqa", "robotics", "whisper", "sound",
      "learnlm", "medlm"
    ];

    const validModels = (data.models || [])
      .filter(m => {
        // 1. Phải hỗ trợ sinh nội dung generateContent
        if (!Array.isArray(m.supportedGenerationMethods) || !m.supportedGenerationMethods.includes("generateContent")) {
          return false;
        }
        const modelId = m.name.toLowerCase();
        // 2. Loại bỏ các model không hỗ trợ văn bản, audio, hoặc model chuyên biệt không tương thích
        if (nonGenerateContentPatterns.some(p => modelId.includes(p))) {
          return false;
        }
        // 3. Nếu model chỉ hỗ trợ AUDIO thì loại ngay
        if (Array.isArray(m.responseModalities)) {
          const mods = m.responseModalities.map(x => String(x).toUpperCase());
          if (!mods.includes("TEXT")) return false;
        }
        return true;
      })
      .map(m => {
        const id = m.name.replace(/^models\//, "");
        return {
          id,
          name: m.name,
          displayName: m.displayName || id
        };
      });

    // Sắp xếp các model theo thứ tự ưu tiên (Gemini 3.8 Flash -> 3.8 Pro -> 3.5 Flash-Lite -> 3.5 Flash -> 3.5 Pro -> 3.0 Flash...)
    validModels.sort((a, b) => {
      const idxA = GEMINI_NEWEST_PRIORITY.indexOf(a.id);
      const idxB = GEMINI_NEWEST_PRIORITY.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id.localeCompare(b.id);
    });

    return validModels;
  } catch (e) {
    console.warn("Could not list Gemini models dynamically:", e.message);
    throw e;
  }
}

// Cập nhật danh sách các mô hình trong dropdown
function populateGeminiModelDropdown(modelsList, preferredModel) {
  const select = document.getElementById("select-gemini-model");
  if (!select) return;

  let currentVal = preferredModel || select.value || getSavedGeminiModel();

  select.innerHTML = "";

  const autoOpt = document.createElement("option");
  autoOpt.value = "auto";
  autoOpt.textContent = "🚀 Tự động chọn mô hình tối ưu (Ưu tiên Gemini 3.8 Flash / 3.5 Flash-Lite)";
  select.appendChild(autoOpt);

  if (modelsList && modelsList.length > 0) {
    modelsList.forEach(m => {
      if (m.id.includes("interactions") || m.id.includes("deep-research") || m.id.includes("tts") || m.id.includes("8b")) return;
      const opt = document.createElement("option");
      opt.value = m.id;
      let label = m.displayName || m.id;
      if (m.id.includes("3.8-flash")) label = `🔥 ${label} (Thế hệ 3.8 MỚI NHẤT - Đỉnh cao trí tuệ & siêu tốc)`;
      else if (m.id.includes("3.8-pro")) label = `🧠 ${label} (Tư duy suy luận sâu thế hệ 3.8)`;
      else if (m.id.includes("3.5-flash-lite")) label = `⚡ ${label} (Siêu nhanh, ổn định & tối ưu Quota)`;
      else if (m.id.includes("3.5-flash")) label = `⚡ ${label} (Thế hệ 3.5 toàn diện & chính xác cao)`;
      else if (m.id.includes("3.5-pro")) label = `🧠 ${label} (Tư duy chuyên gia 3.5)`;
      else if (m.id.includes("3.0-flash") || m.id.includes("3-flash")) label = `⚡ ${label} (Chuẩn thế hệ 3.0)`;
      else if (m.id.includes("pro")) label = `🧠 ${label} (Tư duy sâu & lập luận chuyên gia)`;
      else label = `⚡ ${label}`;
      opt.textContent = label;
      select.appendChild(opt);
    });
  } else {
    GEMINI_FALLBACK_MODELS.forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      let label = id;
      if (id.includes("3.8-flash")) label = `🔥 ${id} (Thế hệ 3.8 MỚI NHẤT - Đỉnh cao trí tuệ & siêu tốc)`;
      else if (id.includes("3.8-pro")) label = `🧠 ${id} (Tư duy suy luận sâu thế hệ 3.8)`;
      else if (id.includes("3.5-flash-lite")) label = `⚡ ${id} (Siêu nhanh, ổn định & tối ưu Quota)`;
      else if (id.includes("3.5-flash")) label = `⚡ ${id} (Thế hệ 3.5 toàn diện & chính xác cao)`;
      else if (id.includes("3.5-pro")) label = `🧠 ${id} (Tư duy chuyên gia 3.5)`;
      else if (id.includes("3.0-flash")) label = `⚡ ${id} (Chuẩn thế hệ 3.0)`;
      else label = `⚡ ${id}`;
      opt.textContent = label;
      select.appendChild(opt);
    });
  }

  const customOpt = document.createElement("option");
  customOpt.value = "custom";
  customOpt.textContent = "✏️ Nhập mã mô hình tùy chọn khác (Gemini 3+, 4...)...";
  select.appendChild(customOpt);

  if (currentVal && currentVal !== "auto" && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  } else {
    select.value = "gemini-3.8-flash";
  }
}

// Hàm kiểm tra API Key trực tiếp với Google AI, tự động nhận diện mô hình hoạt động
async function testGeminiApiKey(apiKey) {
  const resultDiv = document.getElementById("gemini-key-test-result");
  const modelBadge = document.getElementById("gemini-model-badge-info");
  const selectModel = document.getElementById("select-gemini-model");
  if (!resultDiv) return;

  const cleanKey = (apiKey || "").trim();
  if (!cleanKey) {
    resultDiv.style.display = "block";
    resultDiv.style.background = "var(--danger-light)";
    resultDiv.style.color = "var(--danger)";
    resultDiv.innerHTML = "❌ Vui lòng dán mã API Key vào ô trước khi kiểm tra!";
    return;
  }

  resultDiv.style.display = "block";
  resultDiv.style.background = "var(--bg-accent)";
  resultDiv.style.color = "var(--text-main)";
  resultDiv.innerHTML = "⏳ Đang kết nối Google AI để xác thực và chọn mô hình mới nhất...";

  try {
    let availableModels = [];
    try {
      availableModels = await discoverGeminiModels(cleanKey);
    } catch (listErr) {
      const errMsg = listErr.message || "";
      if (errMsg.toLowerCase().includes("api key not valid") || errMsg.includes("API_KEY_INVALID")) {
        resultDiv.style.background = "var(--danger-light)";
        resultDiv.style.color = "var(--danger)";
        resultDiv.innerHTML = `❌ <strong>API Key không hợp lệ!</strong><br><small>${errMsg}</small><br>👉 Vui lòng tạo hoặc copy lại Key mới tại <a href="https://aistudio.google.com/app/apikey" target="_blank" style="text-decoration: underline; font-weight: 600;">Google AI Studio</a>.`;
        return;
      }
      if (errMsg.includes("403") || errMsg.toLowerCase().includes("permission denied")) {
        resultDiv.style.background = "var(--danger-light)";
        resultDiv.style.color = "var(--danger)";
        resultDiv.innerHTML = `❌ <strong>API Key bị hạn chế quyền (403):</strong><br><small>${errMsg}</small><br>👉 Hãy kiểm tra cài đặt của Key trên Google Cloud Console (đảm bảo đã bật Generative Language API).`;
        return;
      }
      if (errMsg.includes("429")) {
        resultDiv.style.background = "var(--warning-light)";
        resultDiv.style.color = "var(--warning)";
        resultDiv.innerHTML = `⚠️ <strong>Hết hạn mức yêu cầu (Quota)!</strong><br>Key đúng nhưng tài khoản Google đã tạm hết quota miễn phí. Hãy bấm dùng nút <strong>"⚡ Dùng AI Lọc Tự Động (Offline)"</strong> có sẵn!`;
        return;
      }
      availableModels = GEMINI_FALLBACK_MODELS.map(id => ({ id, name: `models/${id}`, displayName: id }));
    }

    if (!availableModels || availableModels.length === 0) {
      availableModels = GEMINI_FALLBACK_MODELS.map(id => ({ id, name: `models/${id}`, displayName: id }));
    }

    // Cập nhật dropdown mô hình
    populateGeminiModelDropdown(availableModels);

    // Xác định mô hình ưu tiên kiểm tra
    let userSelected = selectModel ? selectModel.value : "auto";
    const customInput = document.getElementById("input-custom-gemini-model");
    if (userSelected === "custom" && customInput && customInput.value.trim()) {
      userSelected = customInput.value.trim();
    }
    let candidateIds = [];

    // Nếu người dùng chọn mô hình tương thích hợp lệ
    if (userSelected && userSelected !== "auto" && !userSelected.includes("interactions") && !userSelected.includes("8b")) {
      candidateIds = [userSelected, ...availableModels.map(m => m.id).filter(id => id !== userSelected)];
    } else {
      candidateIds = availableModels.map(m => m.id);
    }

    // Đảm bảo các mô hình thế hệ Gemini 3+ luôn có mặt trong danh sách thử
    GEMINI_FALLBACK_MODELS.forEach(fb => {
      if (!candidateIds.includes(fb)) candidateIds.push(fb);
    });
    if (!candidateIds.includes("gemini-3.8-flash")) {
      candidateIds.unshift("gemini-3.8-flash");
    }
    if (!candidateIds.includes("gemini-3.5-flash-lite")) {
      candidateIds.push("gemini-3.5-flash-lite");
    }

    let testSuccess = false;
    let lastErrMsg = "";

    // Thử từng mô hình tương thích cho tới khi tìm thấy mô hình hoạt động hoàn hảo
    for (const modelCandidate of candidateIds) {
      if (modelCandidate.includes("interactions") || modelCandidate.includes("deep-research") || modelCandidate.includes("tts") || modelCandidate.includes("8b")) {
        continue;
      }

      for (const apiVer of ["v1beta", "v1"]) {
        try {
          const testResp = await fetch(`https://generativelanguage.googleapis.com/${apiVer}/models/${modelCandidate}:generateContent?key=${cleanKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: "ping" }]
                }
              ],
              generationConfig: {
                maxOutputTokens: 10
              }
            })
          });

          if (testResp.ok) {
            activeGeminiModel = modelCandidate;
            setSavedGeminiModel(modelCandidate);
            setSavedGeminiKey(cleanKey);
            testSuccess = true;

            if (selectModel) {
              if (Array.from(selectModel.options).some(o => o.value === modelCandidate)) {
                selectModel.value = modelCandidate;
                const customContainer = document.getElementById("container-custom-gemini-model");
                if (customContainer) customContainer.style.display = "none";
              } else {
                selectModel.value = "custom";
                if (customInput) customInput.value = modelCandidate;
                const customContainer = document.getElementById("container-custom-gemini-model");
                if (customContainer) customContainer.style.display = "block";
              }
            }
            if (modelBadge) {
              modelBadge.textContent = `Đang kết nối: ${modelCandidate}`;
            }

            let noteExtra = "";
            if (userSelected && userSelected !== "auto" && userSelected !== modelCandidate) {
              noteExtra = `<div style="margin-top: 0.45rem; padding: 0.4rem 0.65rem; border-radius: var(--radius-sm); background: rgba(59, 130, 246, 0.12); color: var(--primary); font-size: 0.8rem; line-height: 1.4;">
                💡 <em>Lưu ý: Mô hình <code>${userSelected}</code> tạm thời chạm hạn mức (Rate limit) hoặc không hỗ trợ. Hệ thống đã tự động kết nối mô hình thay thế tốt nhất: <strong>${modelCandidate}</strong>!</em>
              </div>`;
            }

            resultDiv.style.background = "var(--success-light)";
            resultDiv.style.color = "var(--success)";
            resultDiv.innerHTML = `✅ <strong>API Key hoạt động xuất sắc!</strong><br>Đã kết nối thành công mô hình: <code style="font-weight: 700; font-size: 0.95rem;">${modelCandidate}</code>.<br><small>Hệ thống đã sẵn sàng giải đề, rà soát và sinh đề thi bằng AI Gemini 3+!</small>${noteExtra}`;
            showToast(`Đã kết nối thành công Google Gemini (${modelCandidate})!`, "success");
            return;
          } else {
            const errJson = await testResp.json().catch(() => ({}));
            const errMsg = errJson.error?.message || `HTTP ${testResp.status}`;
            lastErrMsg = errMsg;

            if (testResp.status === 400 && errMsg.toLowerCase().includes("api key not valid")) {
              resultDiv.style.background = "var(--danger-light)";
              resultDiv.style.color = "var(--danger)";
              resultDiv.innerHTML = `❌ <strong>API Key không hợp lệ!</strong><br><small>${errMsg}</small><br>👉 Vui lòng tạo hoặc copy lại Key mới tại Google AI Studio.`;
              return;
            }
            if (testResp.status === 429) {
              console.warn(`Mô hình ${modelCandidate} (${apiVer}) tạm hết hạn mức (429 Rate Limit/Quota), thử tiếp...`);
              lastErrMsg = `Mô hình ${modelCandidate} tạm hết hạn mức (429 Quota/RPM)`;
              continue;
            }

            if (errMsg.includes("no longer available") || errMsg.includes("is not found")) {
              console.warn(`Mô hình ${modelCandidate} không khả dụng trên ${apiVer}, chuyển tiếp...`);
            } else {
              console.warn(`Mô hình ${modelCandidate} (${apiVer}) không tương thích (${errMsg}), chuyển sang mô hình tiếp theo...`);
            }
          }
        } catch (err) {
          lastErrMsg = err.message;
        }
      }
    }

    if (!testSuccess) {
      resultDiv.style.background = "var(--danger-light)";
      resultDiv.style.color = "var(--danger)";
      resultDiv.innerHTML = `❌ Không thể kích hoạt mô hình: ${lastErrMsg}. Bạn hãy dùng nút <strong>"⚡ Dùng AI Lọc Tự Động (Offline)"</strong> có sẵn!`;
    }
  } catch (netErr) {
    resultDiv.style.background = "var(--danger-light)";
    resultDiv.style.color = "var(--danger)";
    resultDiv.innerHTML = `❌ Lỗi mạng hoặc CORS kết nối: ${netErr.message}. Vui lòng kiểm tra đường truyền Internet.`;
  }
}

// Thực hiện một lệnh gọi sinh nội dung đơn lẻ tới Google Gemini với cơ chế thử cả v1beta và v1
async function executeSingleGeminiRequest(promptText, cleanKey) {
  let modelToUse = activeGeminiModel || getSavedGeminiModel();
  const selectModel = document.getElementById("select-gemini-model");
  const customInput = document.getElementById("input-custom-gemini-model");
  if (selectModel && selectModel.value === "custom" && customInput && customInput.value.trim()) {
    modelToUse = customInput.value.trim();
  }

  // Tự động nâng cấp nếu model rỗng hoặc là model cũ < 3 đã bị khai tử
  if (!modelToUse || modelToUse === "auto" || modelToUse.includes("1.5") || modelToUse.includes("2.0") || modelToUse.includes("2.5") || modelToUse.includes("1.0") || modelToUse.includes("interactions") || modelToUse.includes("tts") || modelToUse.includes("8b")) {
    modelToUse = "gemini-3.8-flash";
    activeGeminiModel = "gemini-3.8-flash";
    setSavedGeminiModel("gemini-3.8-flash");
  }

  const rawCandidates = [
    modelToUse,
    ...GEMINI_FALLBACK_MODELS.filter(m => m !== modelToUse)
  ];
  if (!rawCandidates.includes("gemini-3.8-flash")) {
    rawCandidates.unshift("gemini-3.8-flash");
  }
  if (!rawCandidates.includes("gemini-3.5-flash-lite")) {
    rawCandidates.push("gemini-3.5-flash-lite");
  }
  if (!rawCandidates.includes("gemini-3.5-flash")) {
    rawCandidates.push("gemini-3.5-flash");
  }
  const modelsToTry = rawCandidates.filter(m => !m.includes("8b") && !m.includes("tts") && !m.includes("interactions"));

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 8192
    }
  };

  let lastError = null;

  for (const model of modelsToTry) {
    const apiVersions = ["v1beta", "v1"];
    for (const apiVer of apiVersions) {
      const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${cleanKey}`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (resp.ok) {
          const data = await resp.json();
          const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textOutput) {
            activeGeminiModel = model;
            setSavedGeminiModel(model);
            return textOutput;
          }
        } else {
          const errJson = await resp.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${resp.status}`;
          lastError = new Error(errMsg);

          if (resp.status === 400 && errMsg.toLowerCase().includes("api key not valid")) {
            throw new Error("Mã API Key không hợp lệ! Vui lòng bấm nút 'Kiểm tra Key' hoặc lấy lại tại aistudio.google.com");
          }
          if (resp.status === 429) {
            console.warn(`[NovaQuiz AI] Model ${model} đạt giới hạn tốc độ (Rate Limit / Quota), tự động thử mô hình tiếp theo...`);
            continue;
          }
          if (errMsg.includes("no longer available") || errMsg.includes("is not found") || errMsg.includes("Interactions API")) {
            console.warn(`[NovaQuiz AI] Model ${model} không khả dụng trên ${apiVer}, chuyển tiếp...`);
            continue;
          } else {
            console.warn(`[NovaQuiz AI] Model ${model} (${apiVer}) không phản hồi: ${errMsg}`);
          }
        }
      } catch (e) {
        if (e.message && (e.message.includes("API Key") || e.message.includes("hạn mức"))) {
          throw e;
        }
        lastError = e;
      }
    }
  }

  throw lastError || new Error("Không thể kết nối đến Google Gemini AI. Vui lòng kiểm tra lại API Key hoặc sử dụng bộ lọc AI Offline!");
}

// Thực hiện một lệnh gọi đa phương tiện Multimodal (văn bản + nhiều hình ảnh) tới Google Gemini Vision
async function executeGeminiMultimodalRequest(parts, cleanKey) {
  let modelToUse = activeGeminiModel || getSavedGeminiModel();
  const selectModel = document.getElementById("select-gemini-model");
  const customInput = document.getElementById("input-custom-gemini-model");
  if (selectModel && selectModel.value === "custom" && customInput && customInput.value.trim()) {
    modelToUse = customInput.value.trim();
  }

  if (!modelToUse || modelToUse === "auto" || modelToUse.includes("1.5") || modelToUse.includes("2.0") || modelToUse.includes("2.5") || modelToUse.includes("1.0") || modelToUse.includes("interactions") || modelToUse.includes("tts") || modelToUse.includes("8b")) {
    modelToUse = "gemini-3.8-flash";
    activeGeminiModel = "gemini-3.8-flash";
    setSavedGeminiModel("gemini-3.8-flash");
  }

  const rawCandidates = [
    modelToUse,
    ...GEMINI_FALLBACK_MODELS.filter(m => m !== modelToUse)
  ];
  if (!rawCandidates.includes("gemini-3.8-flash")) {
    rawCandidates.unshift("gemini-3.8-flash");
  }
  if (!rawCandidates.includes("gemini-3.5-flash-lite")) {
    rawCandidates.push("gemini-3.5-flash-lite");
  }
  if (!rawCandidates.includes("gemini-3.5-flash")) {
    rawCandidates.push("gemini-3.5-flash");
  }
  const modelsToTry = rawCandidates.filter(m => !m.includes("8b") && !m.includes("tts") && !m.includes("interactions"));

  const payload = {
    contents: [
      {
        role: "user",
        parts: parts
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  };

  let lastError = null;

  for (const model of modelsToTry) {
    const apiVersions = ["v1beta", "v1"];
    for (const apiVer of apiVersions) {
      const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${cleanKey}`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (resp.ok) {
          const data = await resp.json();
          const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textOutput) {
            activeGeminiModel = model;
            setSavedGeminiModel(model);
            return textOutput;
          }
        } else {
          const errJson = await resp.json().catch(() => ({}));
          const errMsg = errJson.error?.message || `HTTP ${resp.status}`;
          lastError = new Error(errMsg);

          if (resp.status === 400 && errMsg.toLowerCase().includes("api key not valid")) {
            throw new Error("Mã API Key không hợp lệ! Vui lòng bấm nút 'Cài đặt Gemini API Key' để kiểm tra lại.");
          }
          if (resp.status === 429) {
            console.warn(`[NovaQuiz AI OCR] Model ${model} đạt giới hạn tốc độ (Rate Limit / Quota), tự động thử mô hình tiếp theo...`);
            continue;
          }
          if (errMsg.includes("no longer available") || errMsg.includes("is not found") || errMsg.includes("Interactions API")) {
            console.warn(`[NovaQuiz AI OCR] Model ${model} không khả dụng trên ${apiVer}, chuyển tiếp...`);
            continue;
          } else {
            console.warn(`[NovaQuiz AI OCR] Model ${model} (${apiVer}) không phản hồi: ${errMsg}`);
          }
        }
      } catch (e) {
        if (e.message && (e.message.includes("API Key") || e.message.includes("hạn mức"))) {
          throw e;
        }
        lastError = e;
      }
    }
  }

  throw lastError || new Error("Không thể kết nối đến Google Gemini Vision. Vui lòng kiểm tra lại API Key hoặc chất lượng ảnh!");
}

// Nén và tối ưu kích thước ảnh trước khi gửi sang AI (Đảm bảo chạy mượt và siêu nhẹ trên cả điện thoại 4G)
function resizeImageIfNeeded(file, maxDimension = 2000, quality = 0.85) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width <= maxDimension && height <= maxDimension && file.size < 2.5 * 1024 * 1024) {
          const base64Data = e.target.result.split(",")[1];
          resolve({
            mimeType: file.type || "image/jpeg",
            base64: base64Data,
            dataUrl: e.target.result
          });
          return;
        }

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Data = dataUrl.split(",")[1];
        resolve({
          mimeType: "image/jpeg",
          base64: base64Data,
          dataUrl: dataUrl
        });
      };
      img.onerror = () => {
        const base64Data = e.target.result.split(",")[1];
        resolve({
          mimeType: file.type || "image/jpeg",
          base64: base64Data,
          dataUrl: e.target.result
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function openGeminiKeyModal() {
  const modal = document.getElementById("modal-ai-gemini");
  const input = document.getElementById("input-gemini-api-key");
  if (input) input.value = getSavedGeminiKey();
  if (modal) modal.classList.add("open");
}

// =============================================================================
// 8B. MULTI-IMAGE AI OCR ENGINE (NHẬN DIỆN ĐỀ THI NHIỀU ẢNH QUA GEMINI VISION)
// =============================================================================

function setupAiImageOcr() {
  const fileInput = document.getElementById("input-ai-ocr-files");
  const dropzone = document.getElementById("ocr-dropzone");
  const btnTrigger = document.getElementById("btn-trigger-ocr-file-select");
  const btnAddMore = document.getElementById("btn-ocr-add-more");
  const btnClearAll = document.getElementById("btn-ocr-clear-all");
  const btnKey = document.getElementById("btn-ocr-config-key");
  const btnRun = document.getElementById("btn-run-ai-ocr");
  const btnQuickOcr = document.getElementById("btn-quick-ocr-upload");

  if (btnQuickOcr) {
    btnQuickOcr.addEventListener("click", () => {
      const tabOcr = document.getElementById("tab-btn-ai-ocr");
      if (tabOcr) tabOcr.click();
      if (fileInput) fileInput.click();
    });
  }

  if (btnTrigger && fileInput) {
    btnTrigger.addEventListener("click", () => fileInput.click());
  }
  if (btnAddMore && fileInput) {
    btnAddMore.addEventListener("click", () => fileInput.click());
  }

  if (btnKey) {
    btnKey.addEventListener("click", openGeminiKeyModal);
  }

  if (btnClearAll) {
    btnClearAll.addEventListener("click", () => {
      AppState.ocrImages = [];
      renderOcrThumbnails();
      if (fileInput) fileInput.value = "";
      showToast("Đã xóa danh sách ảnh đã chọn", "info");
    });
  }

  if (btnRun) {
    btnRun.addEventListener("click", runAiImageOcr);
  }

  async function handleOcrFiles(files) {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter(f => f.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp)$/i.test(f.name));
    if (validFiles.length === 0) {
      showToast("Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP)!", "warning");
      return;
    }

    showToast(`⏳ Đang xử lý và tối ưu ${validFiles.length} ảnh đề thi...`, "info");

    for (const f of validFiles) {
      try {
        const item = await resizeImageIfNeeded(f, 2048, 0.85);
        item.name = f.name;
        item.size = f.size;
        AppState.ocrImages.push(item);
      } catch (err) {
        console.error("Error loading image file", f.name, err);
      }
    }

    renderOcrThumbnails();
    showToast(`📸 Đã nạp thành công ảnh (Tổng cộng: ${AppState.ocrImages.length} ảnh)`, "success");
    if (fileInput) fileInput.value = "";
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      handleOcrFiles(e.target.files);
    });
  }

  if (dropzone) {
    ["dragenter", "dragover"].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleOcrFiles(e.dataTransfer.files);
      }
    });

    dropzone.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("a") || e.target.closest("input")) return;
      if (fileInput) fileInput.click();
    });
  }
}

function renderOcrThumbnails() {
  const container = document.getElementById("ocr-selected-images-container");
  const grid = document.getElementById("ocr-thumbnails-grid");
  const countSpan = document.getElementById("ocr-selected-count");

  if (!container || !grid) return;

  const count = AppState.ocrImages ? AppState.ocrImages.length : 0;
  if (countSpan) countSpan.textContent = count;

  if (count === 0) {
    container.style.display = "none";
    grid.innerHTML = "";
    return;
  }

  container.style.display = "block";
  grid.innerHTML = AppState.ocrImages.map((img, idx) => `
    <div class="ocr-thumb-card" data-index="${idx}">
      <div class="ocr-thumb-img-wrapper">
        <img src="${img.dataUrl}" alt="Trang ${idx + 1}" />
        <span class="ocr-thumb-badge">Trang ${idx + 1}</span>
        <button type="button" class="ocr-thumb-btn-remove" onclick="removeOcrImage(${idx})" title="Xóa ảnh này">×</button>
      </div>
      <div class="ocr-thumb-meta">
        <span class="ocr-thumb-name" title="${escapeHtml(img.name || `Trang ${idx + 1}`)}">${escapeHtml(img.name || `Trang ${idx + 1}`)}</span>
        <span class="ocr-thumb-size">${formatBytes(img.size || 0)}</span>
      </div>
    </div>
  `).join("");
}

function removeOcrImage(index) {
  if (AppState.ocrImages && AppState.ocrImages[index]) {
    AppState.ocrImages.splice(index, 1);
    renderOcrThumbnails();
  }
}

async function runAiImageOcr() {
  const apiKey = getSavedGeminiKey();
  if (!apiKey) {
    showToast("Vui lòng nhập Google Gemini API Key để sử dụng tính năng nhận diện ảnh!", "warning");
    openGeminiKeyModal();
    return;
  }

  if (!AppState.ocrImages || AppState.ocrImages.length === 0) {
    showToast("Vui lòng chọn hoặc kéo thả ít nhất 1 ảnh đề thi!", "warning");
    return;
  }

  const btnRun = document.getElementById("btn-run-ai-ocr");
  const origBtnHtml = btnRun ? btnRun.innerHTML : "";
  if (btnRun) {
    btnRun.disabled = true;
    btnRun.innerHTML = `<span class="spinner" style="display:inline-block; width:18px; height:18px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span> AI đang đọc & xử lý ${AppState.ocrImages.length} ảnh đề thi...`;
  }

  const detectMarked = document.getElementById("ocr-opt-detect-marked") ? document.getElementById("ocr-opt-detect-marked").checked : true;
  const autoSolve = document.getElementById("ocr-opt-auto-solve") ? document.getElementById("ocr-opt-auto-solve").checked : true;
  const fixSpelling = document.getElementById("ocr-opt-fix-spelling") ? document.getElementById("ocr-opt-fix-spelling").checked : true;

  try {
    const parts = [];

    let promptInstruction = `Bạn là chuyên gia số hóa đề thi và thị giác máy tính hàng đầu cho tiếng Việt (Multimodal OCR & Exam Parser).
Dưới đây là ${AppState.ocrImages.length} hình ảnh chứa các trang đề thi trắc nghiệm tiếng Việt (sắp xếp theo thứ tự Trang 1, Trang 2...).
Nhiệm vụ của bạn là: Đọc kỹ từng trang ảnh và trích xuất TOÀN BỘ các câu hỏi trắc nghiệm có trong TẤT CẢ các ảnh, ghép lại thành một bộ đề thi hoàn chỉnh.

QUY TẮC ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Xuất ra văn bản theo cấu trúc chuẩn sau cho từng câu hỏi:
Câu 1: [Nội dung câu hỏi đầy đủ]
A. [Nội dung phương án A]
*B. [Nội dung phương án đúng - Đặt dấu * ngay trước chữ cái của phương án đúng (nếu A đúng ghi *A., nếu B đúng ghi *B., nếu C đúng ghi *C., nếu D đúng ghi *D.)]
C. [Nội dung phương án C]
D. [Nội dung phương án D]
Lời giải: [Giải thích ngắn gọn lý do vì sao đáp án đúng]

QUY TẮC PHƯƠNG ÁN & LỜI GIẢI (CỰC KỲ QUAN TRỌNG):
1. Dòng 'Lời giải: ...' BẮT BUỘC NẰM Ở MỘT DÒNG RIÊNG BIỆT ĐỘC LẬP sau phương án cuối cùng.
2. TUYỆT ĐỐI KHÔNG ĐƯỢC viết lời giải lồng vào bên trong nội dung câu trả lời A, B, C, D (ví dụ CẤM viết 'A. Hà Nội (Lời giải: ...)' hay 'D. Cần Thơ Lời giải: ...'). Nội dung mỗi phương án A, B, C, D chỉ chứa câu trả lời thuần túy!
3. Dấu * đặt trước phương án đúng nhất (ví dụ: *A. hoặc *B. hoặc *C. hoặc *D.).`;

    if (detectMarked) {
      promptInstruction += `\n4. NHẬN DIỆN ĐÁP ÁN ĐÃ KHOANH: Nếu trên hình ảnh câu hỏi có phương án được khoanh tròn bằng bút chì/bút bi, gạch chân hoặc in đậm, hãy nhận diện đó là đáp án đúng và đặt dấu * ngay trước chữ cái đó (ví dụ: *A. hoặc *B.).`;
    }

    if (autoSolve) {
      promptInstruction += `\n5. TỰ ĐỘNG GIẢI ĐỀ: Với những câu hỏi mà người làm chưa khoanh hoặc chưa đánh dấu đáp án trên ảnh, bạn hãy tự suy luận, phân tích và chọn đáp án chính xác nhất bằng cách đặt dấu * trước phương án đó, kèm lời giải ngắn gọn ở dòng 'Lời giải:'.`;
    } else {
      promptInstruction += `\n5. Với câu chưa có đáp án, giữ nguyên trạng thái không đặt dấu *.`;
    }

    if (fixSpelling) {
      promptInstruction += `\n6. SỬA CHÍNH TẢ & CHUẨN HÓA: Tự động sửa các lỗi nhòe chữ, dãn chữ do ảnh chụp (vd: 'dư ới đây' -> 'dưới đây', 'đáp á n' -> 'đáp án'). Giữ nguyên các ký hiệu toán học hoặc công thức.`;
    }

    promptInstruction += `\n7. BẢO TOÀN THỨ TỰ: Đánh số câu tăng dần liên tục từ Câu 1, Câu 2... theo thứ tự xuất hiện từ trang ảnh đầu tiên đến trang ảnh cuối cùng. Tuyệt đối không bỏ sót câu hỏi nào.
8. CHỈ TRẢ VỀ NỘI DUNG ĐỀ THI theo đúng cấu trúc trên. Không thêm lời chào, không thêm markdown code block \`\`\`.`;

    parts.push({ text: promptInstruction });

    for (let i = 0; i < AppState.ocrImages.length; i++) {
      const imgItem = AppState.ocrImages[i];
      parts.push({
        text: `\n\n--- [HÌNH ẢNH TRANG ĐỀ THI SỐ ${i + 1} TRÊN TỔNG SỐ ${AppState.ocrImages.length} TRANG] ---`
      });
      parts.push({
        inlineData: {
          mimeType: imgItem.mimeType || "image/jpeg",
          data: imgItem.base64
        }
      });
    }

    const extractedText = await executeGeminiMultimodalRequest(parts, apiKey.trim());
    if (!extractedText || !extractedText.trim()) {
      throw new Error("AI không nhận diện được nội dung từ các ảnh đã tải. Vui lòng kiểm tra lại độ rõ nét của ảnh!");
    }

    let cleanText = extractedText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```[a-z]*\s*\n/i, "").replace(/\n```$/g, "").trim();
    }

    const smartTextarea = document.getElementById("smart-text-input");
    if (smartTextarea) {
      smartTextarea.value = cleanText;
    }

    const titleInput = document.getElementById("input-quiz-title");
    if (titleInput && (!titleInput.value || titleInput.value.trim() === "Đề thi mới" || titleInput.value.includes("Đề thi quét"))) {
      titleInput.value = `Đề thi quét ảnh AI (${AppState.ocrImages.length} trang) - ${new Date().toLocaleDateString("vi-VN")}`;
    }

    if (typeof updateSmartParsePreview === "function") {
      updateSmartParsePreview();
    }

    const tabPasteBtn = document.querySelector('.creator-tab[data-tab="tab-smart-paste"]');
    if (tabPasteBtn) {
      tabPasteBtn.click();
    } else {
      document.querySelectorAll(".creator-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.style.display = "none");
      const pastePane = document.getElementById("tab-smart-paste");
      if (pastePane) pastePane.style.display = "block";
    }

    const parsed = parseRawQuestions(cleanText);
    const count = parsed && parsed.questions ? parsed.questions.length : 0;
    showToast(`🎉 Nhận diện thành công ${count} câu hỏi từ ${AppState.ocrImages.length} ảnh đề thi!`, "success");

  } catch (err) {
    console.error("[NovaQuiz AI OCR Error]", err);
    showToast(`❌ Lỗi nhận diện ảnh: ${err.message}`, "danger");
  } finally {
    if (btnRun) {
      btnRun.disabled = false;
      btnRun.innerHTML = origBtnHtml;
    }
  }
}

// Hàm xử lý văn bản đề thi với Google Gemini, hỗ trợ soát lỗi, giải đề, và xử lý chia đợt thông minh cho đề dài
async function callGeminiAiEnhancer(rawText, apiKey, taskType = "audit-correct") {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Vui lòng nhập Google Gemini API Key!");
  }

  const cleanKey = apiKey.trim();
  const loadingTitle = document.getElementById("ai-loading-title");
  const loadingSub = document.getElementById("ai-loading-sub");

  // Nếu là task gọi tùy biến từ AI Tutor
  if (taskType === "tutor-custom") {
    return await executeSingleGeminiRequest(rawText, cleanKey);
  }

  let promptInstruction = "";
  if (taskType === "fix-spelling-only") {
    promptInstruction = `Bạn là một chuyên gia hiệu đính, biên tập ngôn ngữ tiếng Việt và làm đẹp văn bản đề thi trắc nghiệm.
Nhiệm vụ của bạn là: TỰ ĐỘNG SỬA TẤT CẢ CÁC LỖI CHÍNH TẢ, NGỮ PHÁP, LỖI FONT, DÃN CHỮ, NỐI TỪ BỊ TÁCH, WATERMARK TRONG ĐỀ THI.

ĐIỀU KIỆN TIÊN QUYẾT & BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
1. TUYỆT ĐỐI KHÔNG ĐƯỢC THAY ĐỔI ĐÁP ÁN ĐÚNG!
   - Đáp án đúng của người dùng đang được đánh dấu bằng dấu * trước phương án nào (hoặc trong dòng Đáp án: ...), BẮT BUỘC GIỮ NGUYÊN 100% PHƯƠNG ÁN ĐÓ!
   - Tuyệt đối KHÔNG tự ý đổi đáp án đúng từ A sang B hay C, D. Bất kể đáp án gốc như thế nào, bạn CHỈ ĐƯỢC SỬA CHÍNH TẢ từ ngữ, câu chữ, KHÔNG can thiệp vào sự lựa chọn đáp án.
   - Nếu câu nào chưa có đáp án đánh dấu, hãy giữ nguyên trạng thái chưa đánh dấu, không tự ý đoán đáp án.
2. SỬA CÁC LỖI VĂN BẢN VÀ CHÍNH TẢ:
   - Sửa các từ tiếng Việt bị dãn chữ hoặc tách rời do lỗi quét OCR / PDF (vd: "đơ n" -> "đơn", "tươ ng tựnhư" -> "tương tự như", "đ ápán" -> "đáp án", "đ úng" -> "đúng", "củ a" -> "của", "máy ch ủứng dụng" -> "máy chủ ứng dụng", "dưới đ ây" -> "dưới đây").
   - Gỡ bỏ hoàn toàn mọi watermark rác lẫn vào câu chữ (như EDUQUIZ, QUIZLET, AZOTA, UIZ, số trang...).
   - Sửa các lỗi lặp từ/lặp tiêu đề (vd: "Kiểu String là:Kiểu String là:" -> "Kiểu String là:").
   - Chuẩn hóa khoảng trắng, dấu câu (., ?, :, !) sát chữ phía trước và cách chữ phía sau đúng chuẩn ngữ pháp tiếng Việt.
   - Chuẩn hóa cú pháp code nếu có dòng code bị lỗi ngắt dòng ngoặc kép do copy-paste.
3. BẢO TOÀN THẺ HÌNH ẢNH:
   - Giữ nguyên các thẻ [HINHANH_GOC_0], [HINHANH_GOC_1]... đúng vị trí.
4. ĐỊNH DẠNG ĐẦU RA (NovaQuiz):
Câu 1: [Nội dung câu hỏi đã sửa chính tả]
*A. [Phương án đúng gốc được giữ nguyên vị trí dấu *, chỉ sửa chính tả câu chữ]
B. [Phương án đã sửa chính tả]
C. [Phương án đã sửa chính tả]
D. [Phương án đã sửa chính tả]
[Nếu có sẵn dòng Giải thích: ... thì sửa chính tả giải thích, nếu không có thì không tự bịa ra]

(Chỉ xuất kết quả theo định dạng trên, không thêm bất kỳ lời chào nào khác)`;
  } else if (taskType === "audit-correct") {
    promptInstruction = `Bạn là một chuyên gia giáo dục và thẩm định đề thi trắc nghiệm hàng đầu.
Nhiệm vụ của bạn là RÀ SOÁT CHUYÊN MÔN VÀ SỬA TẤT CẢ CÁC CÂU BỊ SAI ĐÁP ÁN trong đề thi sau.

YÊU CẦU BẮT BUỘC:
1. VỚI MỖI CÂU HỎI:
   - Thẩm định tính chính xác của nội dung câu hỏi và 4 phương án A, B, C, D theo kiến thức khoa học chuẩn.
   - Kiểm tra xem đáp án hiện tại đang được đánh dấu (dấu * trước phương án hoặc trong dòng Đáp án) có CHÍNH XÁC không.
   - NẾU ĐÁP ÁN ĐANG BỊ SAI: Bỏ dấu * ở phương án sai, ĐẶT DẤU * TRƯỚC PHƯƠNG ÁN ĐÚNG THỰC SỰ!
   - NẾU CÂU HỎI CHƯA CÓ ĐÁP ÁN: Tìm phương án đúng nhất và thêm dấu * vào trước phương án đó.
   - NẾU CÂU HỎI THIẾU PHƯƠNG ÁN: Tự động bổ sung đủ 4 phương án A, B, C, D chuẩn xác và đánh dấu * đáp án đúng.
2. PHẦN GIẢI THÍCH:
   - Bắt buộc viết dòng "Giải thích: [Lý giải chi tiết]" cho từng câu.
   - ĐẶC BIỆT: Nếu bạn phát hiện và sửa một câu bị sai đáp án gốc, hãy mở đầu phần giải thích bằng:
     "⚠️ [ĐÃ ĐÍNH CHÍNH]: Đáp án gốc bị sai. Đã sửa sang đáp án đúng là [chữ cái] vì [lý do chi tiết]..."
3. BẢO TOÀN THẺ HÌNH ẢNH:
   - Nếu câu hỏi có thẻ hình ảnh dạng [HINHANH_GOC_0], [HINHANH_GOC_1]..., bạn BẮT BUỘC giữ nguyên thẻ đó đúng vị trí dưới câu hỏi.
4. ĐỊNH DẠNG ĐẦU RA (NovaQuiz):
Câu 1: [Nội dung câu hỏi]
*A. [Phương án đúng có dấu *]
B. [Phương án]
C. [Phương án]
D. [Phương án]
Giải thích: [Lời giải chi tiết hoặc đính chính]

(Chỉ xuất kết quả theo định dạng trên, không thêm bất kỳ lời chào nào khác)`;
  } else if (taskType === "full-solve") {
    promptInstruction = `Bạn là chuyên gia sư phạm trắc nghiệm. Hãy xử lý văn bản đề thi sau:
1. Lọc bỏ thông tin rác của trường, lớp, tiêu đề thi, số trang.
2. Với mọi câu hỏi, nếu chưa có A, B, C, D thì hãy tự động gắn A, B, C, D. Nếu câu hỏi bị thiếu đáp án hoặc câu tự luận, hãy tự động tạo ra 4 phương án trắc nghiệm A, B, C, D hợp lý.
3. Xác định đáp án chính xác và đánh dấu * trước chữ cái đáp án đúng (ví dụ: *A. hoặc *B.).
4. Viết phần Giải thích: ... chi tiết cho từng câu hỏi.
5. Nếu câu hỏi có thẻ [HINHANH_GOC_X], hãy giữ nguyên đúng vị trí.
Xuất định dạng chuẩn NovaQuiz:
Câu 1: [Câu hỏi]
*A. [Đáp án đúng có dấu *]
B. [Đáp án]
C. [Đáp án]
D. [Đáp án]
Giải thích: [Lời giải chi tiết]

(Chỉ xuất kết quả theo định dạng trên, không thêm bất kỳ văn bản chào hỏi nào khác)`;
  } else if (taskType === "add-options") {
    promptInstruction = `Hãy tự động viết 4 phương án A, B, C, D cho các câu hỏi sau, đánh dấu * trước đáp án đúng và viết giải thích. Giữ nguyên các thẻ [HINHANH_GOC_X]. Xuất định dạng chuẩn: Câu X: ... A. ... B. ... C. ... D. ... Giải thích: ...`;
  } else {
    promptInstruction = `Giữ nguyên nội dung câu hỏi và các phương án, xác định đáp án đúng (đánh dấu *) và viết thêm dòng Giải thích: ... cho từng câu hỏi. Giữ nguyên các thẻ [HINHANH_GOC_X].`;
  }

  // Tạm ẩn các chuỗi ảnh Base64 cực lớn để tránh làm nổ dung lượng request (hàng triệu ký tự)
  const imageMap = new Map();
  let imgCounter = 0;
  const textWithoutHugeImages = rawText.replace(/\[HINHANH:(data:image\/[^\]]+)\]/gi, (match, dataUri) => {
    const token = `[HINHANH_GOC_${imgCounter++}]`;
    imageMap.set(token, match);
    return token;
  });

  const rawLines = textWithoutHugeImages.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks = splitIntoQuestionBlocks(rawLines);

  let enhancedOutput = "";

  // Với đề thi ngắn (<= 15 câu), gửi 1 lần xử lý nhanh chóng
  if (blocks.length <= 15) {
    const fullPrompt = `${promptInstruction}\n\nNỘI DUNG ĐỀ THI:\n${textWithoutHugeImages}`;
    enhancedOutput = await executeSingleGeminiRequest(fullPrompt, cleanKey);
  } else {
    // Với đề thi dài (ví dụ 30, 50, 100 câu), xử lý chia đợt 12 câu để bảo toàn chất lượng và tránh quá tải token
    const batchSize = 12;
    const totalBatches = Math.ceil(blocks.length / batchSize);
    const enhancedChunks = [];

    for (let b = 0; b < totalBatches; b++) {
      const chunkBlocks = blocks.slice(b * batchSize, (b + 1) * batchSize);
      const chunkText = chunkBlocks.join("\n\n");
      const progressMsg = `Đang xử lý đợt ${b + 1}/${totalBatches} (Câu ${b * batchSize + 1} - ${Math.min((b + 1) * batchSize, blocks.length)})...`;

      if (loadingTitle) loadingTitle.textContent = "AI Gemini đang rà soát & giải đề thi...";
      if (loadingSub) loadingSub.textContent = progressMsg;

      const chunkPrompt = `${promptInstruction}\n\nNỘI DUNG ĐỀ THI (ĐỢT ${b + 1}/${totalBatches}):\n${chunkText}`;
      const resultChunk = await executeSingleGeminiRequest(chunkPrompt, cleanKey);
      enhancedChunks.push(resultChunk.trim());

      if (b < totalBatches - 1) {
        await new Promise(r => setTimeout(r, 350));
      }
    }
    enhancedOutput = enhancedChunks.join("\n\n\n");
  }

  // Khôi phục lại toàn bộ ảnh Base64 gốc nguyên vẹn vào các câu hỏi
  let finalText = enhancedOutput;
  for (const [token, originalTag] of imageMap.entries()) {
    finalText = finalText.replaceAll(token, originalTag);
  }

  return finalText;
}

// Bộ rà soát và sửa lỗi đề thi Offline (miễn phí, không cần kết nối mạng hoặc Key)
function offlineAuditAndFixExam(rawText) {
  if (!rawText || !rawText.trim()) {
    return { cleanedText: rawText, stats: { total: 0, fixed: 0, missingAnswers: 0, multiAnswers: 0 } };
  }

  let text = aiFilterAndCleanExam(rawText);
  const rawLines = text.split("\n");
  const blocks = splitIntoQuestionBlocks(rawLines);

  let missingAnswers = 0;
  let multiAnswers = 0;
  let fixedCount = 0;

  const auditedBlocks = blocks.map(block => {
    const lines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return block;

    const imageLines = lines.filter(l => l.startsWith("[HINHANH:"));
    const nonImageLines = lines.filter(l => !l.startsWith("[HINHANH:"));
    if (nonImageLines.length < 2) return block;

    const qLine = nonImageLines[0];
    const restLines = nonImageLines.slice(1);

    const optionLines = [];
    const trailingLines = [];
    restLines.forEach(l => {
      if (ANSWER_PREFIX_TEST_REGEX.test(l)) {
        trailingLines.push(l);
      } else {
        optionLines.push(l);
      }
    });

    let correctCount = optionLines.filter(l => l.startsWith("*") || l.startsWith("+")).length;
    let explicitKeyLetter = null;
    trailingLines.forEach(l => {
      const match = l.match(ANSWER_LINE_REGEX);
      if (match) explicitKeyLetter = match[1].toUpperCase();
    });

    // Nếu chưa thấy trong trailingLines, thử tìm thẻ đáp án nhúng trong câu hỏi: [DA: C], (ĐA: C)...
    if (!explicitKeyLetter) {
      const embMatch = qLine.match(EMBEDDED_ANSWER_REGEX);
      if (embMatch) explicitKeyLetter = embMatch[1].toUpperCase();
    }

    if (correctCount === 0 && explicitKeyLetter) {
      const targetIdx = explicitKeyLetter.charCodeAt(0) - 65;
      if (targetIdx >= 0 && targetIdx < optionLines.length) {
        optionLines[targetIdx] = `*${optionLines[targetIdx].replace(/^[\*\+]\s*/, "")}`;
        correctCount = 1;
        fixedCount++;
      }
    }

    if (correctCount === 0) {
      missingAnswers++;
      if (optionLines.length > 0) {
        optionLines[0] = `*${optionLines[0].replace(/^[\*\+]\s*/, "")}`;
        trailingLines.push("Giải thích: ⚠️ [CẦN SOÁT ĐÁP ÁN]: Câu hỏi này chưa có đáp án trong đề gốc.");
        fixedCount++;
      }
    } else if (correctCount > 1) {
      multiAnswers++;
      let foundFirst = false;
      for (let i = 0; i < optionLines.length; i++) {
        if (optionLines[i].startsWith("*") || optionLines[i].startsWith("+")) {
          if (!foundFirst) {
            foundFirst = true;
            optionLines[i] = `*${optionLines[i].replace(/^[\*\+]\s*/, "")}`;
          } else {
            optionLines[i] = optionLines[i].replace(/^[\*\+]\s*/, "");
          }
        }
      }
      trailingLines.push("Giải thích: ⚠️ [ĐÃ SỬA]: Phát hiện câu bị đánh dấu nhiều đáp án, hệ thống đã giữ lại đáp án đầu tiên.");
      fixedCount++;
    }

    return [qLine, ...imageLines, ...optionLines, ...trailingLines].join("\n");
  });

  const cleanedText = auditedBlocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    cleanedText,
    stats: {
      total: blocks.length,
      fixed: fixedCount,
      missingAnswers,
      multiAnswers
    }
  };
}

// =============================================================================
// AI AUDIT DIFF REVIEW ENGINE (MỤC RIÊNG CÁC CÂU HỎI AI VỪA SỬA ĐÁP ÁN)
// =============================================================================

let currentAiAuditChanges = [];
let lastAuditSnapshot = null;

function isQuestionMatch(t1, t2) {
  if (!t1 || !t2) return false;
  const c1 = t1.toLowerCase().replace(/[^a-z0-9à-ỹ]/gi, "").slice(0, 45);
  const c2 = t2.toLowerCase().replace(/[^a-z0-9à-ỹ]/gi, "").slice(0, 45);
  return c1.length > 5 && c2.length > 5 && (c1.includes(c2) || c2.includes(c1));
}

function detectAiAuditChanges(oldText, newText) {
  if (!oldText || !newText) return [];

  const oldParsed = parseRawQuestions(oldText);
  const newParsed = parseRawQuestions(newText);

  const oldQuestions = oldParsed.questions || [];
  const newQuestions = newParsed.questions || [];

  const changes = [];

  newQuestions.forEach((newQ, idx) => {
    let oldQ = oldQuestions[idx];
    if (!oldQ || (oldQ.text && newQ.text && !isQuestionMatch(oldQ.text, newQ.text))) {
      const match = oldQuestions.find(q => isQuestionMatch(q.text, newQ.text));
      if (match) oldQ = match;
    }

    const oldHasValid = !!(oldQ && oldQ.hasValidAnswer && oldQ.correctIndex >= 0);
    const newHasValid = !!(newQ.hasValidAnswer && newQ.correctIndex >= 0);

    const oldLetter = oldHasValid ? String.fromCharCode(65 + oldQ.correctIndex) : null;
    const newLetter = newHasValid ? String.fromCharCode(65 + newQ.correctIndex) : null;

    const oldAnswerText = (oldHasValid && oldQ.options[oldQ.correctIndex]) ? oldQ.options[oldQ.correctIndex] : "";
    const newAnswerText = (newHasValid && newQ.options[newQ.correctIndex]) ? newQ.options[newQ.correctIndex] : "";

    let isChanged = false;
    let changeType = "MODIFIED";
    let changeReason = "";

    // 1. Đáp án chữ cái bị đổi (A -> C)
    if (oldHasValid && newHasValid && oldLetter !== newLetter) {
      isChanged = true;
      changeType = "ANSWER_CHANGED";
      changeReason = `Đổi đáp án từ ${oldLetter} sang ${newLetter}`;
    }
    // 2. Trước đó chưa có đáp án, AI đã bổ sung
    else if (!oldHasValid && newHasValid) {
      isChanged = true;
      changeType = "ANSWER_ADDED";
      changeReason = `Bổ sung đáp án đúng: ${newLetter}`;
    }
    // 3. Giải thích có đánh dấu đính chính từ AI
    else if (newQ.explanation && (newQ.explanation.includes("[ĐÃ ĐÍNH CHÍNH]") || newQ.explanation.includes("[ĐÃ SỬA]") || newQ.explanation.includes("[CẦN SOÁT ĐÁP ÁN]"))) {
      isChanged = true;
      changeType = "EXPLANATION_CORRECTED";
      changeReason = "Đính chính đáp án và giải thích chi tiết";
    }

    if (isChanged) {
      changes.push({
        questionIndex: idx,
        displayNumber: idx + 1,
        questionText: newQ.text,
        image: newQ.image || (oldQ ? oldQ.image : null),
        oldLetter,
        oldAnswerText,
        newLetter,
        newAnswerText,
        oldCorrectIndex: oldQ ? oldQ.correctIndex : -1,
        newCorrectIndex: newQ.correctIndex,
        options: newQ.options || [],
        oldOptions: oldQ ? (oldQ.options || []) : [],
        explanation: newQ.explanation || "",
        changeType,
        changeReason,
        currentSelectedLetter: newLetter
      });
    }
  });

  return changes;
}

function renderAiAuditDiffPanel(changes) {
  const container = document.getElementById("ai-audit-diff-items-container");
  const countBadge = document.getElementById("ai-audit-diff-badge");
  const statCount = document.getElementById("parse-stat-audited-count");
  const btnCount = document.getElementById("btn-toggle-audited-count");

  if (countBadge) countBadge.textContent = `${changes.length} câu đã sửa`;
  if (statCount) statCount.textContent = changes.length;
  if (btnCount) btnCount.textContent = changes.length;

  if (!container) return;

  if (changes.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;">Không có câu hỏi nào bị sửa đổi.</p>`;
    return;
  }

  const letters = ["A", "B", "C", "D", "E", "F"];

  container.innerHTML = changes.map(item => {
    const qNum = item.displayNumber;
    const oldLetterDisplay = item.oldLetter || "Chưa có";
    const newLetterDisplay = item.newLetter || "Chưa có";

    let badgeText = `⚡ Sửa: ${oldLetterDisplay} ➔ ${newLetterDisplay}`;
    let badgeClass = "badge-warning";
    if (item.changeType === "ANSWER_ADDED") {
      badgeText = `➕ Bổ sung: ${newLetterDisplay}`;
      badgeClass = "badge-success";
    }

    const availableOptions = (item.options && item.options.length > 0) 
      ? item.options 
      : ((item.oldOptions && item.oldOptions.length > 0) ? item.oldOptions : ["", "", "", ""]);

    const optionButtonsHtml = availableOptions.map((opt, oIdx) => {
      const letter = letters[oIdx] || String.fromCharCode(65 + oIdx);
      const isActive = item.currentSelectedLetter === letter;
      return `
        <button type="button" class="diff-opt-btn ${isActive ? 'active' : ''}" data-letter="${letter}" onclick="setAuditedQuestionAnswer(${item.questionIndex}, '${letter}')" title="Chọn đáp án ${letter}">
          ${letter}
        </button>
      `;
    }).join("");

    return `
      <div class="ai-audit-diff-card" data-q-idx="${item.questionIndex}">
        <div class="ai-audit-diff-card-header">
          <div class="ai-audit-diff-q-title">
            <span style="color: var(--primary);">Câu ${qNum}:</span> ${escapeHtml(item.questionText)}
          </div>
          <span class="badge ${badgeClass}" style="font-weight: 700; flex-shrink: 0;">${badgeText}</span>
        </div>

        ${item.image ? `<div style="margin: 0.25rem 0;"><img src="${item.image}" alt="Hình ảnh câu hỏi" style="max-height: 120px; max-width: 100%; border-radius: 6px; border: 1px solid var(--border-subtle);" /></div>` : ''}

        <div class="ai-audit-diff-comparison-grid">
          <!-- Cột Đáp Án Ban Đầu -->
          <div class="diff-box old-answer">
            <div class="diff-box-label">
              <span>🔴 Đáp án gốc:</span>
              ${item.oldLetter ? `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger); font-size: 0.72rem;">Đề ban đầu</span>` : `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger); font-size: 0.72rem;">Thiếu đáp án</span>`}
            </div>
            <div class="diff-box-content">
              ${item.oldLetter ? `<strong>${item.oldLetter}.</strong> ${escapeHtml(item.oldAnswerText)}` : `<em style="color: var(--text-muted); font-weight: normal;">(Câu hỏi trong đề gốc chưa có đáp án)</em>`}
            </div>
            ${item.oldLetter ? `
              <div style="margin-top: 0.35rem;">
                <button type="button" class="btn btn-outline btn-xs" onclick="revertSingleAiQuestion(${item.questionIndex})" title="Bỏ qua sửa đổi của AI và giữ đáp án gốc">
                  ↩️ Giữ lại đáp án gốc (${item.oldLetter})
                </button>
              </div>
            ` : ''}
          </div>

          <!-- Cột Đáp Án AI Đã Sửa -->
          <div class="diff-box new-answer">
            <div class="diff-box-label">
              <span>🟢 Đáp án AI đã sửa:</span>
              <span class="badge badge-success diff-selected-badge" style="font-size: 0.72rem;">✓ Đang chọn (${item.currentSelectedLetter || newLetterDisplay})</span>
            </div>
            <div class="diff-box-content">
              <strong>${newLetterDisplay}.</strong> ${escapeHtml(item.newAnswerText)}
            </div>
            <div style="font-size: 0.78rem; color: var(--success); margin-top: 0.35rem;">
              ✓ Đã tự động cập nhật vào đề thi
            </div>
          </div>
        </div>

        ${item.explanation ? `
          <div class="diff-explanation-box">
            💡 <strong>Giải thích của AI:</strong> ${escapeHtml(item.explanation)}
          </div>
        ` : ''}

        <div class="diff-card-footer">
          <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <span>Hoặc chọn đáp án khác:</span>
            <div class="diff-option-buttons">
              ${optionButtonsHtml}
            </div>
          </div>
          ${item.oldLetter && item.currentSelectedLetter !== item.oldLetter ? `
            <button type="button" class="btn btn-ghost btn-xs" style="color: var(--danger);" onclick="revertSingleAiQuestion(${item.questionIndex})">
              ↩️ Đổi về đáp án cũ (${item.oldLetter})
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  renderMathInElementSafe(container);
}

function setAuditedQuestionAnswer(questionIndex, targetLetter) {
  const textarea = document.getElementById("smart-text-input");
  if (!textarea) return;

  const rawText = textarea.value;
  const lines = rawText.split("\n");
  const blocks = splitIntoQuestionBlocks(lines);

  if (questionIndex < 0 || questionIndex >= blocks.length) return;

  const block = blocks[questionIndex];
  const bLines = block.split("\n");

  const optionRegex = /^(\*+|\[x\]|\(x\)|\+)?\s*([A-Fa-f])[\.\)\:\/]\s*(.*)$/;
  const answerLineRegex = ANSWER_LINE_REGEX;

  let hasAnswerLine = false;
  let hasFoundTargetOption = false;

  const updatedLines = bLines.map(line => {
    if (answerLineRegex.test(line)) {
      hasAnswerLine = true;
      return line.replace(answerLineRegex, (m, letter) => m.replace(letter, targetLetter.toUpperCase()));
    }

    const optMatch = line.match(optionRegex);
    if (optMatch) {
      const optLetter = optMatch[2].toUpperCase();
      const rest = optMatch[3];
      if (optLetter === targetLetter.toUpperCase()) {
        hasFoundTargetOption = true;
        return `*${optLetter}. ${rest}`;
      } else {
        return `${optLetter}. ${rest}`;
      }
    }

    return line;
  });

  if (!hasFoundTargetOption && !hasAnswerLine) {
    updatedLines.push(`Đáp án: ${targetLetter.toUpperCase()}`);
  }

  blocks[questionIndex] = updatedLines.join("\n");
  textarea.value = blocks.join("\n\n");
  updateSmartParsePreview();

  const changeItem = currentAiAuditChanges.find(c => c.questionIndex === questionIndex);
  if (changeItem) {
    changeItem.currentSelectedLetter = targetLetter.toUpperCase();
  }

  const card = document.querySelector(`.ai-audit-diff-card[data-q-idx="${questionIndex}"]`);
  if (card) {
    const optButtons = card.querySelectorAll(".diff-opt-btn");
    optButtons.forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-letter") === targetLetter.toUpperCase());
    });

    const badge = card.querySelector(".diff-selected-badge");
    if (badge) {
      badge.textContent = `✓ Đang chọn (${targetLetter.toUpperCase()})`;
    }
  }

  showToast(`Đã chọn đáp án ${targetLetter.toUpperCase()} cho Câu ${questionIndex + 1}`, "info");
}

function revertSingleAiQuestion(questionIndex) {
  const changeItem = currentAiAuditChanges.find(c => c.questionIndex === questionIndex);
  if (!changeItem) return;

  if (changeItem.oldLetter) {
    setAuditedQuestionAnswer(questionIndex, changeItem.oldLetter);
    showToast(`Đã khôi phục đáp án gốc (${changeItem.oldLetter}) cho Câu ${questionIndex + 1}`, "info");
  } else {
    const textarea = document.getElementById("smart-text-input");
    if (!textarea) return;
    const lines = textarea.value.split("\n");
    const blocks = splitIntoQuestionBlocks(lines);
    if (questionIndex >= 0 && questionIndex < blocks.length) {
      const bLines = blocks[questionIndex].split("\n").filter(l => !/^(?:Đáp\s*án|ĐA|Key)[\s\:\-]+/i.test(l)).map(l => {
        return l.replace(/^(\*+|\[x\]|\(x\)|\+)\s*([A-Fa-f][\.\)\:\/])/i, "$2");
      });
      blocks[questionIndex] = bLines.join("\n");
      textarea.value = blocks.join("\n\n");
      updateSmartParsePreview();

      changeItem.currentSelectedLetter = null;
      const card = document.querySelector(`.ai-audit-diff-card[data-q-idx="${questionIndex}"]`);
      if (card) {
        card.querySelectorAll(".diff-opt-btn").forEach(btn => btn.classList.remove("active"));
        const badge = card.querySelector(".diff-selected-badge");
        if (badge) badge.textContent = "(Chưa chọn đáp án)";
      }
      showToast(`Đã đưa Câu ${questionIndex + 1} về trạng thái chưa có đáp án như ban đầu`, "info");
    }
  }
}

function revertAllAiAudit() {
  if (!lastAuditSnapshot || !lastAuditSnapshot.beforeText) {
    showToast("Không tìm thấy dữ liệu trước khi AI sửa để hoàn tác!", "warning");
    return;
  }
  const textarea = document.getElementById("smart-text-input");
  if (textarea) {
    textarea.value = lastAuditSnapshot.beforeText;
    updateSmartParsePreview();
  }
  const diffPanel = document.getElementById("ai-audit-diff-panel");
  if (diffPanel) diffPanel.style.display = "none";

  const statusBadge = document.getElementById("parse-stat-audited-container");
  const statusBtn = document.getElementById("btn-toggle-audited-panel");
  if (statusBadge) statusBadge.style.display = "none";
  if (statusBtn) statusBtn.style.display = "none";

  currentAiAuditChanges = [];
  showToast("↩️ Đã hoàn tác toàn bộ đề thi về trước khi AI rà soát!", "info");
}

function acceptAllAiAudit() {
  const diffPanel = document.getElementById("ai-audit-diff-panel");
  if (diffPanel) diffPanel.style.display = "none";
  showToast("✓ Đã đồng ý và áp dụng toàn bộ các câu hỏi AI vừa sửa!", "success");
}

function processAndShowAiAuditDiff(beforeText, afterText) {
  const changes = detectAiAuditChanges(beforeText, afterText);
  currentAiAuditChanges = changes;
  lastAuditSnapshot = { beforeText, afterText, changes };

  const diffPanel = document.getElementById("ai-audit-diff-panel");
  const statusBadge = document.getElementById("parse-stat-audited-container");
  const statusBtn = document.getElementById("btn-toggle-audited-panel");

  if (changes.length > 0) {
    renderAiAuditDiffPanel(changes);
    if (diffPanel) {
      diffPanel.style.display = "block";
      setTimeout(() => {
        diffPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 150);
    }
    if (statusBadge) statusBadge.style.display = "flex";
    if (statusBtn) statusBtn.style.display = "inline-flex";

    showToast(`🔍 AI đã rà soát xong! Phát hiện và sửa đáp án của ${changes.length} câu. Mục xem chi tiết đã được mở bên dưới để bạn duyệt lại!`, "success");
  } else {
    if (diffPanel) diffPanel.style.display = "none";
    if (statusBadge) statusBadge.style.display = "none";
    if (statusBtn) statusBtn.style.display = "none";

    showToast("✓ AI đã rà soát toàn bộ đề thi: Toàn bộ đáp án đều chuẩn xác, không có câu nào bị sai sót!", "success");
  }
}

function setupAiAuditDiffListeners() {
  const btnTogglePanel = document.getElementById("btn-toggle-audited-panel");
  const btnClosePanel = document.getElementById("btn-close-ai-audit-panel");
  const btnRevertAll = document.getElementById("btn-revert-all-ai-audit");
  const btnAcceptAll = document.getElementById("btn-accept-all-ai-audit");
  const statusAuditedContainer = document.getElementById("parse-stat-audited-container");

  const diffPanel = document.getElementById("ai-audit-diff-panel");

  if (btnTogglePanel && diffPanel) {
    btnTogglePanel.addEventListener("click", () => {
      const isHidden = diffPanel.style.display === "none";
      diffPanel.style.display = isHidden ? "block" : "none";
      if (isHidden) {
        diffPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (statusAuditedContainer && diffPanel) {
    statusAuditedContainer.addEventListener("click", () => {
      diffPanel.style.display = "block";
      diffPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  if (btnClosePanel && diffPanel) {
    btnClosePanel.addEventListener("click", () => {
      diffPanel.style.display = "none";
    });
  }

  if (btnRevertAll) {
    btnRevertAll.addEventListener("click", revertAllAiAudit);
  }

  if (btnAcceptAll) {
    btnAcceptAll.addEventListener("click", acceptAllAiAudit);
  }
}

// =============================================================================
// WORD (.DOCX) PARSER WITH IMAGES & COLORED QUESTION RECOGNITION
// =============================================================================

async function parseDocxFile(fileOrBuffer, fileName = "de_thi.docx") {
  if (typeof JSZip === "undefined") {
    showToast("Thư viện JSZip chưa sẵn sàng! Vui lòng tải lại trang.", "danger");
    return;
  }

  showToast(`Đang đọc tệp Word "${fileName}", quét hình ảnh & định dạng màu sắc...`, "info");

  try {
    let zip;
    if (fileOrBuffer instanceof Blob || fileOrBuffer instanceof File) {
      const arrayBuffer = await fileOrBuffer.arrayBuffer();
      zip = await JSZip.loadAsync(arrayBuffer);
    } else {
      zip = await JSZip.loadAsync(fileOrBuffer);
    }

    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
      showToast("Tệp không đúng định dạng Word chuẩn (thiếu word/document.xml)!", "danger");
      return;
    }

    // 1. Trích xuất bản đồ hình ảnh đính kèm từ word/_rels/document.xml.rels
    const mediaMap = {};
    const relsFile = zip.file("word/_rels/document.xml.rels");
    if (relsFile) {
      const relsXml = await relsFile.async("text");
      const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi;
      let rm;
      while ((rm = relRegex.exec(relsXml)) !== null) {
        let target = rm[2];
        if (!target.startsWith("word/")) {
          target = "word/" + target.replace(/^\.\.\//, "").replace(/^\//, "");
        }
        const mediaFile = zip.file(target);
        if (mediaFile) {
          const ext = target.split('.').pop().toLowerCase();
          let mime = "image/png";
          if (ext === "jpg" || ext === "jpeg") mime = "image/jpeg";
          else if (ext === "gif") mime = "image/gif";
          else if (ext === "svg") mime = "image/svg+xml";
          else if (ext === "webp") mime = "image/webp";
          const b64 = await mediaFile.async("base64");
          mediaMap[rm[1]] = `data:${mime};base64,${b64}`;
        }
      }
    }

    const xmlText = await docXmlFile.async("text");

    // Lấy tùy chọn nhận diện định dạng từ giao diện
    const useColor = document.getElementById("docx-opt-color") ? document.getElementById("docx-opt-color").checked : true;
    const useUnderline = document.getElementById("docx-opt-underline") ? document.getElementById("docx-opt-underline").checked : true;
    const useBold = document.getElementById("docx-opt-bold") ? document.getElementById("docx-opt-bold").checked : true;

    // Phân tích các khối đoạn văn <w:p>
    const pRegex = /<w:p\b(?:[\s>][\s\S]*?<\/w:p>|\/>)/g;
    const rRegex = /<w:r\b(?:[\s>][\s\S]*?<\/w:r>|\/>)/g;
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const tabRegex = /<w:tab\b[^>]*\/>/g;
    const colorRegex = /<w:color\s+[^>]*w:val="([^"]+)"/i;
    const highlightRegex = /<w:highlight\s+[^>]*w:val="([^"]+)"/i;
    const uRegex = /<w:u\s+[^>]*w:val="([^"]+)"/i;
    const boldRegex = /<w:b\b(?:[\s>][\s\S]*?<\/w:b>|\/?>)/i;
    const blipRegex = /(?:r:embed|r:id)="([^"]+)"/i;

    const paragraphs = xmlText.match(pRegex) || [];
    const lines = [];
    let detectedColoredOptionsCount = 0;
    let detectedImagesCount = 0;

    for (const p of paragraphs) {
      // Kiểm tra xem đoạn văn này có chứa hình ảnh hay không
      const blipMatches = [...p.matchAll(/(?:r:embed|r:id)="([^"]+)"/gi)];
      for (const bm of blipMatches) {
        if (mediaMap[bm[1]]) {
          lines.push(`[HINHANH:${mediaMap[bm[1]]}]`);
          detectedImagesCount++;
        }
      }

      const runs = p.match(rRegex) || [];
      let pRuns = [];

      for (const r of runs) {
        let isColored = false;
        if (useColor) {
          const colorMatch = r.match(colorRegex);
          if (colorMatch) {
            const c = colorMatch[1].toUpperCase();
            if (!['AUTO', '000000', '00000000', 'WINDOWTEXT', 'INHERIT'].includes(c)) {
              isColored = true;
            }
          }

          const hMatch = r.match(highlightRegex);
          if (hMatch && hMatch[1].toLowerCase() !== 'none') {
            isColored = true;
          }
        }

        let isUnderlined = false;
        if (useUnderline) {
          const uMatch = r.match(uRegex);
          if (uMatch && uMatch[1].toLowerCase() !== 'none') {
            isUnderlined = true;
          }
        }

        let isBold = false;
        if (useBold && boldRegex.test(r)) {
          isBold = true;
        }

        // Chuyển thẻ tab thành khoảng trắng và trích xuất chữ thuần từ <w:t>
        const rClean = r.replace(tabRegex, " ");
        let text = '';
        let tm;
        while ((tm = tRegex.exec(rClean)) !== null) {
          text += tm[1];
        }

        if (text) {
          pRuns.push({
            text,
            isSpecial: isColored || isUnderlined || isBold
          });
        }
      }

      if (pRuns.length === 0) continue;

      let fullText = '';
      const charMeta = [];

      for (const run of pRuns) {
        for (let ch of run.text) {
          charMeta.push(run.isSpecial);
        }
        fullText += run.text;
      }

      // Nhận diện xem trong dòng này có các lựa chọn A., B., C., D. hay không
      const optMatches = [...fullText.matchAll(/(?:^|[\s\t]+)([A-Fa-f])[\.\)\:\/]\s*/g)];

      if (optMatches.length > 0) {
        for (let i = 0; i < optMatches.length; i++) {
          const curMatch = optMatches[i];
          const endIdx = (i + 1 < optMatches.length) ? optMatches[i + 1].index : fullText.length;
          const optChunk = fullText.slice(curMatch.index, endIdx).trim();

          let hasSpecialChar = false;
          for (let c = curMatch.index; c < endIdx; c++) {
            if (charMeta[c]) {
              hasSpecialChar = true;
              break;
            }
          }

          if (hasSpecialChar) {
            detectedColoredOptionsCount++;
          }

          const prefix = (hasSpecialChar && !optChunk.startsWith('*')) ? '*' : '';
          if (i === 0 && curMatch.index > 0) {
            const preText = fullText.slice(0, curMatch.index).trim();
            if (preText) lines.push(preText);
          }
          lines.push(`${prefix}${optChunk}`);
        }
      } else {
        // Dòng không có A., B., C., D. (có thể là câu hỏi hoặc phương án gạch đầu dòng)
        const hasSpecialChar = charMeta.some(Boolean);
        if (hasSpecialChar) detectedColoredOptionsCount++;
        const prefix = (hasSpecialChar && !fullText.trim().startsWith('*')) ? '*' : '';
        lines.push(`${prefix}${fullText.trim()}`);
      }
    }

    let extractedText = lines.join("\n");

    // 1. Tự động kiểm tra xem có bảng đáp án riêng ở cuối file không
    const sepResult = autoDetectAndApplySeparateAnswers(extractedText);
    let sepApplied = false;
    if (sepResult.appliedCount > 0) {
      extractedText = sepResult.text;
      sepApplied = true;
    }

    // Tự động chạy bộ lọc AI làm sạch rác và gắn nhãn A, B, C, D cho các phương án chưa có nhãn
    extractedText = aiFilterAndCleanExam(extractedText);

    // Đưa kết quả vào smart-text-input
    const textarea = document.getElementById("smart-text-input");
    if (textarea) {
      textarea.value = extractedText;

      // Chuyển sang tab Dán văn bản nhanh để người dùng xem preview
      const tabBtn = document.querySelector('[data-tab="tab-smart-paste"]');
      if (tabBtn && typeof tabBtn.click === "function") tabBtn.click();

      // Gợi ý tên đề thi từ tên tệp (bỏ đuôi .docx)
      const titleInput = document.getElementById("input-quiz-title");
      if (titleInput && (!titleInput.value || titleInput.value.trim() === "")) {
        const cleanName = fileName.replace(/\.docx?$/i, '').replace(/[-_]/g, ' ');
        titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      }

      updateSmartParsePreview();

      const parsed = parseRawQuestions(extractedText);
      let toastMsg = `Đã đọc file Word! Nhận diện ${parsed.totalCount} câu hỏi (${detectedImagesCount} hình ảnh, ${detectedColoredOptionsCount} đáp án tô màu).`;
      if (sepApplied) {
        toastMsg += ` 🎉 Tự động ghép ${sepResult.appliedCount} đáp án từ bảng đáp án riêng!`;
      }
      showToast(toastMsg, "success");
    }
  } catch (error) {
    console.error("Lỗi đọc file Word:", error);
    showToast("Không thể đọc tệp Word. Vui lòng kiểm tra tệp .docx có bị hỏng không!", "danger");
  }
}

// =============================================================================
// SEPARATE ANSWER KEY ENGINE (GHÉP BẢNG ĐÁP ÁN RIÊNG)
// =============================================================================

// Phân tích và trích xuất danh sách cặp (Câu, Đáp án) từ văn bản bảng đáp án
function parseAnswerKeyText(text) {
  if (!text || typeof text !== "string") return new Map();
  const answerMap = new Map();
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  // Format 1: Câu 1: A hoặc Câu 1. A hoặc Câu 1 - A hoặc Q1: A hoặc Câu 1 | A
  const r1 = /(?:Câu|C\^au|\bQ)\s*(\d+)[\s\.\:\-\)\/\|]+([A-Fa-f])\b/gi;
  let m;
  while ((m = r1.exec(clean)) !== null) {
    answerMap.set(parseInt(m[1], 10), m[2].toUpperCase());
  }

  // Format 2: 1.A, 1. A, 1-A, 1:A, 1)A, 1/A, 1 | A, 1 A
  const r2 = /(?:^|[\s\t\,\;\|\(\[])(\d+)[\s\.\:\-\)\/\|]+([A-Fa-f])(?=[\s\t\,\;\|\)\]\.\:\-]|$)/gi;
  while ((m = r2.exec(clean)) !== null) {
    const qNum = parseInt(m[1], 10);
    if (!answerMap.has(qNum)) {
      answerMap.set(qNum, m[2].toUpperCase());
    }
  }

  // Format 3: Dính liền 1A 2B 3C 4D...
  const r3 = /(?:^|[\s\t\,\;\|\(\[])(\d+)([A-Fa-f])(?=[\s\t\,\;\|\)\]]|$)/gi;
  while ((m = r3.exec(clean)) !== null) {
    const qNum = parseInt(m[1], 10);
    if (!answerMap.has(qNum)) {
      answerMap.set(qNum, m[2].toUpperCase());
    }
  }

  // Format 4: Hai hàng bảng (Row 1 là số 1 2 3 4..., Row 2 là chữ A B C D...)
  const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < lines.length - 1; i++) {
    const nums = lines[i].split(/[\s\t\,\|\;]+/).filter(x => /^\d+$/.test(x));
    const letters = lines[i + 1].split(/[\s\t\,\|\;]+/).filter(x => /^[A-Fa-f]$/.test(x));
    if (nums.length >= 3 && nums.length === letters.length) {
      for (let j = 0; j < nums.length; j++) {
        const qNum = parseInt(nums[j], 10);
        if (!answerMap.has(qNum)) {
          answerMap.set(qNum, letters[j].toUpperCase());
        }
      }
      i++; // Skip row 2
    }
  }

  return answerMap;
}

// Gắn đáp án từ answerMap vào các khối câu hỏi tương ứng
function applyAnswerKeyToBlocks(blocks, answerMap) {
  if (!blocks || !answerMap || answerMap.size === 0) {
    return { updatedBlocks: blocks || [], appliedCount: 0 };
  }

  let appliedCount = 0;
  const updatedBlocks = blocks.map((rawBlock, idx) => {
    // 1. Tách nếu dòng có nhiều phương án trên 1 dòng
    let block = rawBlock.split('\n').map(line => {
      const matches = [...line.matchAll(/(?:^|[\s\t]{2,}|\t+)([A-Ha-h])[\.\)\:\/]\s*/g)];
      if (matches.length > 1) {
        let result = [];
        for (let i = 0; i < matches.length; i++) {
          const start = matches[i].index;
          const end = (i + 1 < matches.length) ? matches[i + 1].index : line.length;
          result.push(line.slice(start, end).trim());
        }
        return result.join('\n');
      }
      return line;
    }).join('\n');

    // Tìm số thứ tự câu hỏi: ví dụ 'Câu 1:', '1.', 'Câu 1'
    const qMatch = block.match(/(?:Câu|C\^au|\bQ)\s*(\d+)[\s\.\:\)]/i) || block.match(/^(\d+)[\.\:\)]/);
    const qNum = qMatch ? parseInt(qMatch[1], 10) : (idx + 1);

    const targetLetter = answerMap.get(qNum);
    if (!targetLetter) return block;

    const lines = block.split('\n');
    let foundOption = false;

    // Kiểm tra xem đã có tiền tố A., B., C., D. chưa
    const hasLetters = lines.some(l => /^(\*|\+)?\s*[A-Fa-f][\.\)\:\/\-]\s*/.test(l.trim()));

    if (hasLetters) {
      const updatedLines = lines.map(line => {
        const trimmed = line.trim();
        const optMatch = trimmed.match(/^(\*?)\s*([A-Fa-f])[\.\)\:\/\-]\s*(.*)$/);
        if (optMatch) {
          const curLetter = optMatch[2].toUpperCase();
          const restContent = optMatch[3];
          if (curLetter === targetLetter) {
            foundOption = true;
            return `*${curLetter}. ${restContent}`;
          } else {
            return `${curLetter}. ${restContent}`;
          }
        }
        return line;
      });

      if (foundOption) {
        appliedCount++;
        return updatedLines.join('\n');
      }
    } else {
      // Trường hợp các đáp án chưa có tiền tố A, B, C, D (ví dụ chỉ có các dòng văn bản)
      const targetIdx = targetLetter.charCodeAt(0) - 65; // A -> 0, B -> 1, C -> 2, D -> 3
      const textLines = lines.filter(l => l.trim().length > 0 && !l.startsWith('[HINHANH:'));
      if (textLines.length >= 3) {
        const qLine = textLines[0];
        const optLines = textLines.slice(1);
        if (targetIdx >= 0 && targetIdx < optLines.length) {
          const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
          const newOptLines = optLines.map((optText, oIdx) => {
            const letter = letters[oIdx] || String.fromCharCode(65 + oIdx);
            const cleanOpt = optText.replace(/^(?:[\-\•\*\+]|\d+[\.\)\:\/])\s*/, '').trim();
            if (oIdx === targetIdx) {
              return `*${letter}. ${cleanOpt}`;
            } else {
              return `${letter}. ${cleanOpt}`;
            }
          });
          appliedCount++;
          const imgLines = lines.filter(l => l.startsWith('[HINHANH:'));
          return [qLine, ...imgLines, ...newOptLines].join('\n');
        }
      }
    }

    return block;
  });

  return { updatedBlocks, appliedCount };
}

// Tự động phát hiện phân đoạn bảng đáp án ở cuối văn bản và ghép vào câu hỏi
function autoDetectAndApplySeparateAnswers(text) {
  if (!text) return { text, appliedCount: 0 };

  const keyHeaderRegex = /(?:^|\n)\s*(?:[-=*_]{3,}\s*)?(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN|PHIẾU\s+ĐÁP\s+ÁN|HƯỚNG\s+DẪN\s+CHẤM|BẢNG\s+TRẢ\s+LỜI|ANSWER\s+KEY|KEY\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s+THAM\s+KHẢO|ĐÁP\s+ÁN\s+CHI\s+TIẾT)[\s\:\.\-]*\n?([\s\S]*)$/i;

  const headerMatch = text.match(keyHeaderRegex);
  if (!headerMatch) {
    return { text, appliedCount: 0 };
  }

  const answerKeySection = headerMatch[1];
  const answerMap = parseAnswerKeyText(answerKeySection);

  if (answerMap.size < 2) {
    return { text, appliedCount: 0 };
  }

  // Tách phần đề thi (loại bỏ phần bảng đáp án ở cuối để không bị parse thành câu hỏi thừa)
  const questionPart = text.slice(0, headerMatch.index).trim();
  const rawLines = questionPart.split('\n');
  const blocks = splitIntoQuestionBlocks(rawLines);

  const { updatedBlocks, appliedCount } = applyAnswerKeyToBlocks(blocks, answerMap);

  if (appliedCount > 0) {
    return {
      text: updatedBlocks.join('\n\n'),
      appliedCount
    };
  }

  return { text, appliedCount: 0 };
}

/**
 * AI Tự Động Lọc & Khớp Đáp Án Thông Minh:
 * 1. Sửa lỗi dãn chữ tiếng Việt từ PDF/OCR (Khái ni ệ m -> Khái niệm...)
 * 2. Tự động nhận diện và ghép đáp án từ mọi định dạng:
 *    - Dòng đáp án riêng trong câu: DA: C, ĐA: C, Key: C, Đáp án: C, Ans: C, Chọn: C...
 *    - Thẻ đáp án nhúng trong tiêu đề câu: [DA: C], (ĐA: C), (Đáp án: C)...
 *    - Bảng đáp án riêng ở đầu hoặc cuối văn bản: 1.C 2.A 3.B... hoặc 1-C, 2-A...
 *    - Các dấu *A., +A., [x] A., (đúng)...
 * 3. Chuẩn hóa đánh dấu * trước phương án đúng và chuẩn hóa dòng Đáp án: [X].
 * 4. Cảnh báo và gợi ý nếu vẫn còn câu chưa có đáp án.
 */
function autoDetectAndLinkAnswers() {
  const textarea = document.getElementById("smart-text-input");
  if (!textarea || !textarea.value.trim()) {
    showToast("Vui lòng dán nội dung đề thi vào khung văn bản trước khi lọc!", "warning");
    return;
  }

  const beforeText = textarea.value;

  // 1. Tách và làm sạch tiêu đề mở đầu / watermark đề thi
  const headerInfo = extractAndCleanExamHeader(beforeText);
  if (headerInfo.title) {
    maybeApplyExtractedQuizTitle(headerInfo.title);
  }

  // 2. Sửa lỗi dãn chữ tiếng Việt
  let text = fixSpacedVietnamese(headerInfo.text);

  // 2. Kiểm tra xem có bảng đáp án riêng ở cuối không (nếu có, ghép trước)
  const sepResult = autoDetectAndApplySeparateAnswers(text);
  if (sepResult.appliedCount > 0) {
    text = sepResult.text;
  }

  // 3. Chuẩn hóa cấu trúc câu hỏi
  text = smartPreprocessExamText(text);

  // 4. Phân tích các khối câu hỏi
  const blocks = splitIntoQuestionBlocks(text.split("\n"));
  if (blocks.length === 0) {
    showToast("Không tìm thấy câu hỏi nào để lọc đáp án!", "warning");
    return;
  }

  // Trích xuất bảng đáp án nếu có trong văn bản
  const globalAnswerTable = extractAnswerKeyTable(beforeText);

  let totalQuestions = 0;
  let matchedCount = 0;
  let missingQuestionsList = [];

  const optionRegex = /^(\*+|\[x\]|\(x\)|\+)?\s*([A-Fa-f])[\.\)\:\/]\s*(.*)$/;

  const processedBlocks = blocks.map((block, qIdx) => {
    totalQuestions++;
    const bLines = block.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (bLines.length < 2) return block;

    let targetLetter = null;

    // Check 1: Dòng đáp án riêng (DA: C, ĐA: C, Key: C, Đáp án: C, Ans: C...)
    for (const line of bLines) {
      const match = line.match(ANSWER_LINE_REGEX);
      if (match) {
        targetLetter = match[1].toUpperCase();
        break;
      }
    }

    // Check 2: Thẻ đáp án nhúng trong tiêu đề câu hỏi: [DA: C] hoặc (Đáp án: C)
    if (!targetLetter) {
      for (const line of bLines) {
        const embMatch = line.match(EMBEDDED_ANSWER_REGEX);
        if (embMatch) {
          targetLetter = embMatch[1].toUpperCase();
          break;
        }
      }
    }

    // Check 3: Bảng đáp án riêng theo số thứ tự câu hỏi (qIdx + 1)
    if (!targetLetter && globalAnswerTable.has(qIdx + 1)) {
      targetLetter = globalAnswerTable.get(qIdx + 1);
    }

    // Check 4: Xem câu hỏi đã có dấu sao hoặc (đúng) ở phương án nào chưa
    if (!targetLetter) {
      for (const line of bLines) {
        const optMatch = line.match(optionRegex);
        if (optMatch) {
          const isStar = !!optMatch[1];
          const textContent = optMatch[3].trim();
          if (isStar || textContent.endsWith("(đúng)") || textContent.endsWith("*")) {
            targetLetter = optMatch[2].toUpperCase();
            break;
          }
        }
      }
    }

    // Check 5: Nếu dòng đáp án ghi nội dung đáp án thay vì chữ cái (ví dụ: "DA: 2011" hoặc "Đáp án: Hà Nội")
    if (!targetLetter) {
      const extractedOpts = [];
      bLines.forEach(l => {
        const m = l.match(optionRegex);
        if (m) extractedOpts.push({ letter: m[2].toUpperCase(), text: m[3].trim() });
      });

      for (const line of bLines) {
        if (ANSWER_PREFIX_TEST_REGEX.test(line)) {
          const afterColon = line.replace(ANSWER_PREFIX_TEST_REGEX, "").trim();
          if (afterColon) {
            const matchedOpt = extractedOpts.find(o => o.text && (o.text === afterColon || afterColon.includes(o.text) || o.text.includes(afterColon)));
            if (matchedOpt) {
              targetLetter = matchedOpt.letter;
              break;
            }
          }
        }
      }
    }

    if (targetLetter) {
      matchedCount++;
      const newLines = [];
      let answerLineAdded = false;

      bLines.forEach(line => {
        // Dòng lựa chọn
        const optMatch = line.match(optionRegex);
        if (optMatch) {
          const optLetter = optMatch[2].toUpperCase();
          const cleanText = optMatch[3]
            .replace(/\s*\((?:đúng|dung)\)$/i, "")
            .replace(/\*$/, "")
            .trim();
          if (optLetter === targetLetter) {
            newLines.push(`*${optLetter}. ${cleanText}`);
          } else {
            newLines.push(`${optLetter}. ${cleanText}`);
          }
          return;
        }

        // Dòng đáp án cũ (DA: ..., ĐA: ...)
        if (ANSWER_PREFIX_TEST_REGEX.test(line)) {
          if (!answerLineAdded && !line.includes("Giải thích") && !line.includes("Lời giải")) {
            newLines.push(`Đáp án: ${targetLetter}`);
            answerLineAdded = true;
            return;
          }
        }

        newLines.push(line);
      });

      // Nếu chưa có dòng Đáp án thì bổ sung cho rõ ràng
      if (!answerLineAdded && !newLines.some(l => ANSWER_LINE_REGEX.test(l))) {
        newLines.push(`Đáp án: ${targetLetter}`);
      }

      return newLines.join("\n");
    } else {
      missingQuestionsList.push(qIdx + 1);
      return block;
    }
  });

  const updatedExamText = processedBlocks.join("\n\n");
  textarea.value = updatedExamText;
  updateSmartParsePreview();

  // Hiệu ứng âm thanh phản hồi
  playSynthesizedAudio('success');

  if (matchedCount > 0) {
    if (matchedCount === totalQuestions) {
      showToast(`🎉 Tuyệt vời! AI đã tự động nhận diện và gắn đúng đáp án cho toàn bộ ${matchedCount}/${totalQuestions} câu hỏi!`, "success");
    } else {
      showToast(`⚡ Đã tự động khớp đáp án cho ${matchedCount}/${totalQuestions} câu! (Còn câu ${missingQuestionsList.slice(0, 5).join(", ")}${missingQuestionsList.length > 5 ? '...' : ''} chưa có đáp án)`, "info");
    }
  } else {
    showToast(`Chưa phát hiện được đáp án (DA:, ĐA:, Key: hoặc bảng đáp án) trong văn bản. Bạn có thể dùng tính năng "🔍 Soát & Sửa Câu Sai Bằng AI" để AI giải tự động!`, "warning");
  }

  // Nếu có sự thay đổi, mở diff review nếu cần
  const diffs = detectAiAuditChanges(beforeText, updatedExamText);
  if (diffs.length > 0) {
    processAndShowAiAuditDiff(beforeText, updatedExamText);
  }
}

// =============================================================================
// PDF (.PDF) PARSER USING PDF.JS (CLIENT-SIDE OFFLINE CAPABLE)
// =============================================================================

/**
 * Chuyển đổi đối tượng hình ảnh từ PDF.js (imgObj / ImageBitmap / Uint8Array) thành Data URL PNG
 */
function convertPdfImageToDataUrl(imgObj) {
  if (!imgObj || !imgObj.width || !imgObj.height) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = imgObj.width;
    canvas.height = imgObj.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (imgObj.bitmap) {
      ctx.drawImage(imgObj.bitmap, 0, 0);
    } else if ((typeof HTMLImageElement !== "undefined" && imgObj instanceof HTMLImageElement) || (typeof ImageBitmap !== "undefined" && imgObj instanceof ImageBitmap)) {
      ctx.drawImage(imgObj, 0, 0);
    } else if (imgObj.data) {
      const imgData = ctx.createImageData(imgObj.width, imgObj.height);
      const src = imgObj.data;
      const dst = imgData.data;
      const totalPixels = imgObj.width * imgObj.height;

      if (src.length === totalPixels * 3) {
        let s = 0, d = 0;
        for (let i = 0; i < totalPixels; i++) {
          dst[d++] = src[s++];
          dst[d++] = src[s++];
          dst[d++] = src[s++];
          dst[d++] = 255;
        }
      } else if (src.length === totalPixels * 4) {
        dst.set(src);
      } else if (src.length === totalPixels) {
        let s = 0, d = 0;
        for (let i = 0; i < totalPixels; i++) {
          const v = src[s++];
          dst[d++] = v;
          dst[d++] = v;
          dst[d++] = v;
          dst[d++] = 255;
        }
      } else {
        let s = 0, d = 0;
        for (let i = 0; i < totalPixels && s < src.length; i++) {
          dst[d++] = src[s++];
          dst[d++] = src[s++] || 0;
          dst[d++] = src[s++] || 0;
          dst[d++] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("Không thể chuyển ảnh PDF sang DataURL:", e);
    return null;
  }
}

async function parsePdfFile(fileOrBuffer, fileName = "de_thi.pdf") {
  if (typeof pdfjsLib === "undefined") {
    showToast("Thư viện PDF.js chưa sẵn sàng! Vui lòng tải lại trang.", "danger");
    return;
  }

  showToast(`Đang đọc tệp PDF "${fileName}", trích xuất văn bản & cấu trúc...`, "info");

  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js";
    }
    let arrayBuffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrBuffer;
    } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === "function") {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    } else if (fileOrBuffer && fileOrBuffer.buffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrBuffer.buffer;
    } else if (fileOrBuffer && fileOrBuffer.byteLength !== undefined) {
      arrayBuffer = fileOrBuffer;
    } else {
      throw new Error("Không thể đọc định dạng dữ liệu PDF");
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    let fullText = "";
    const questionImageMap = new Map();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);

      // 1. Trích xuất văn bản từ trang
      const textContent = await page.getTextContent();
      const items = textContent.items || [];

      // Sắp xếp các đoạn chữ theo tọa độ Y (từ trên xuống dưới) và X (từ trái sang phải)
      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 6) {
          return yDiff;
        }
        return a.transform[4] - b.transform[4];
      });

      let lastY = null;
      let pageText = "";

      for (const item of items) {
        const curY = item.transform[5];
        const str = item.str;
        const isBold = item.fontName && (item.fontName.toLowerCase().includes("bold") || item.fontName.toLowerCase().includes("black") || item.fontName.toLowerCase().includes("heavy"));

        let tokenText = str;
        if (isBold && /^\s*([A-Fa-f])[\.\)\:\/\-]\s*/.test(tokenText) && !tokenText.trim().startsWith('*')) {
          tokenText = '*' + tokenText.trim();
        }

        if (lastY === null) {
          pageText += tokenText;
        } else if (Math.abs(lastY - curY) > 6) {
          pageText += "\n" + tokenText;
        } else {
          if (!pageText.endsWith(" ") && !tokenText.startsWith(" ") && tokenText.length > 0) {
            pageText += " " + tokenText;
          } else {
            pageText += tokenText;
          }
        }
        lastY = curY;
      }
      fullText += pageText + "\n\n";

      // 2. Trích xuất hình ảnh (chụp màn hình code, sơ đồ) gắn theo từng câu hỏi
      try {
        const opList = await page.getOperatorList();
        let curQ = null;
        let pText = "";

        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i];

          if (fn === pdfjsLib.OPS.showText || fn === pdfjsLib.OPS.showSpacedText) {
            if (Array.isArray(args[0])) {
              for (const item of args[0]) {
                if (item && item.unicode) pText += item.unicode;
                else if (typeof item === "string") pText += item;
              }
              const m = pText.match(/(?:Câu|Bài)\s*(\d+)/gi);
              if (m) {
                const last = m[m.length - 1];
                const num = last.match(/\d+/);
                if (num) curQ = parseInt(num[0], 10);
              }
            }
          } else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
            const imgName = args[0];
            // Bỏ qua logo trang 1 trước Câu 1
            if (pageNum === 1 && i < 100) continue;
            if (curQ !== null) {
              await new Promise(resolve => {
                let resolved = false;
                const timer = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                }, 300);

                try {
                  page.objs.get(imgName, imgObj => {
                    if (!resolved) {
                      resolved = true;
                      clearTimeout(timer);
                      if (imgObj && imgObj.width >= 50 && imgObj.height >= 50) {
                        const dataUrl = convertPdfImageToDataUrl(imgObj);
                        if (dataUrl) {
                          const imgToken = `pdf_img_q${curQ}_${questionImageMap.get(curQ)?.length || 0}`;
                          pdfImageRegistry.set(imgToken, dataUrl);
                          if (!questionImageMap.has(curQ)) {
                            questionImageMap.set(curQ, [imgToken]);
                          } else {
                            questionImageMap.get(curQ).push(imgToken);
                          }
                        }
                      }
                      resolve();
                    }
                  });
                } catch (e) {
                  if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    resolve();
                  }
                }
              });
            }
          }
        }
      } catch (errImg) {
        console.warn(`Lỗi trích xuất ảnh trang ${pageNum}:`, errImg);
      }

      // Nhường luồng cho giao diện trình duyệt để tránh lag/treo
      await new Promise(r => setTimeout(r, 0));
    }

    // Chèn các thẻ token [HINHANH:pdf_img_...] vào đúng vị trí câu hỏi (siêu nhẹ, không làm nặng DOM)
    for (const [qNum, tokens] of questionImageMap.entries()) {
      const qRegex = new RegExp(`((?:Câu|Bài)\\s*${qNum}[:\\.\\s][^\\n]*\\??)`, "i");
      if (qRegex.test(fullText)) {
        const imgTags = tokens.map(u => `\n[HINHANH:${u}]\n`).join("");
        fullText = fullText.replace(qRegex, `$1${imgTags}`);
      }
    }

    let extractedText = fullText;

    // 1. Kiểm tra xem có bảng đáp án riêng ở cuối không
    const sepResult = autoDetectAndApplySeparateAnswers(extractedText);
    let sepApplied = false;
    if (sepResult.appliedCount > 0) {
      extractedText = sepResult.text;
      sepApplied = true;
    }

    // 2. Chạy bộ lọc AI làm sạch rác và chuẩn hóa câu hỏi
    extractedText = aiFilterAndCleanExam(extractedText);

    // 3. Đưa vào textarea và cập nhật giao diện
    const textarea = document.getElementById("smart-text-input");
    if (textarea) {
      textarea.value = extractedText;

      const tabBtn = document.querySelector('[data-tab="tab-smart-paste"]');
      if (tabBtn && typeof tabBtn.click === "function") tabBtn.click();

      const titleInput = document.getElementById("input-quiz-title");
      if (titleInput && (!titleInput.value || titleInput.value.trim() === "")) {
        const cleanName = fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        titleInput.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      }

      updateSmartParsePreview();

      const parsed = parseRawQuestions(extractedText);
      let toastMsg = `Đã đọc thành công tệp PDF! Nhận diện ${parsed.totalCount} câu hỏi.`;
      if (questionImageMap.size > 0) {
        toastMsg += ` (📸 Giữ nguyên ${questionImageMap.size} ảnh/code snippet minh họa!)`;
      }
      if (sepApplied) {
        toastMsg += ` (🎉 Tự động ghép ${sepResult.appliedCount} đáp án từ bảng đáp án riêng!)`;
      }
      showToast(toastMsg, "success");
    }
  } catch (err) {
    console.error("Lỗi đọc PDF:", err);
    showToast(`Không thể đọc tệp PDF: ${err.message}. Hãy đảm bảo tệp PDF chứa văn bản có thể bôi đen được!`, "danger");
  }
}

// File dropzone handler
function handleFileUpload(file) {
  if (!file) return;

  const fileName = file.name.toLowerCase();

  // Kiểm tra nếu là file Word (.docx hoặc .doc)
  if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
    parseDocxFile(file, file.name);
    return;
  }

  // Kiểm tra nếu là file PDF (.pdf)
  if (fileName.endsWith(".pdf")) {
    parsePdfFile(file, file.name);
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    const content = e.target.result;

    if (fileName.endsWith(".json")) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          // Multiple quizzes imported
          AppState.quizzes.unshift(...parsed);
          saveQuizzes();
          showToast(`Đã nhập thành công ${parsed.length} đề thi!`, "success");
          renderDashboard();
          switchView("view-dashboard");
          return;
        } else if (parsed.title && Array.isArray(parsed.questions)) {
          // Single quiz object
          AppState.quizzes.unshift(parsed);
          saveQuizzes();
          showToast(`Đã nhập đề: "${parsed.title}"!`, "success");
          renderDashboard();
          switchView("view-dashboard");
          return;
        }
      } catch (err) {
        showToast("Tệp JSON không đúng cấu trúc!", "danger");
      }
    } else {
      // .txt or .csv text parsing
      const textarea = document.getElementById("smart-text-input");
      if (textarea) {
        textarea.value = content;
        // switch tab to smart paste
        const tabBtn = document.querySelector('[data-tab="tab-smart-paste"]');
        if (tabBtn) tabBtn.click();
        updateSmartParsePreview();
        showToast(`Đã tải nội dung từ tệp "${file.name}"!`, "success");
      }
    }
  };

  reader.readAsText(file, "UTF-8");
}

// Save Quiz Handler
function saveCurrentQuiz(autoStart = false) {
  const title = (document.getElementById("input-quiz-title").value || "").trim();
  const category = (document.getElementById("input-quiz-category").value || "").trim() || "Chung";
  const timeLimit = parseInt(document.getElementById("input-quiz-time").value) || 15;
  const description = (document.getElementById("input-quiz-desc").value || "").trim();

  if (!title) {
    showToast("Vui lòng nhập Tên bộ đề thi!", "danger");
    document.getElementById("input-quiz-title").focus();
    return null;
  }

  // Check active tab to gather questions
  const activeTab = document.querySelector(".creator-tab.active").getAttribute("data-tab");
  let finalQuestions = [];

  if (activeTab === "tab-smart-paste" || activeTab === "tab-upload-file" || activeTab === "tab-ai-ocr") {
    const rawText = (document.getElementById("smart-text-input").value || "").trim();
    const parsed = parseRawQuestions(rawText);
    if (parsed.questions.length === 0) {
      showToast("Chưa có câu hỏi nào hợp lệ! Vui lòng kiểm tra lại văn bản.", "danger");
      return null;
    }
    finalQuestions = parsed.questions;
  } else if (activeTab === "tab-manual-builder") {
    finalQuestions = manualQuestionsList.filter(q => q.text.trim() && q.options.some(opt => opt.trim()));
    if (finalQuestions.length === 0) {
      showToast("Vui lòng nhập ít nhất một câu hỏi trong phần soạn thủ công!", "danger");
      return null;
    }
  }

  const newQuiz = {
    id: `quiz-${Date.now()}`,
    title: title,
    category: category,
    timeLimit: timeLimit,
    description: description || `Bộ đề ${category} gồm ${finalQuestions.length} câu hỏi.`,
    createdAt: new Date().toISOString(),
    isCustom: true,
    questions: finalQuestions
  };

  AppState.quizzes.unshift(newQuiz);
  saveQuizzes();
  showToast(`Đã lưu đề thi "${title}" (${finalQuestions.length} câu) thành công!`, "success");

  // Đặt lại sạch sẽ form tạo đề như lúc reload trang web
  resetCreatorForm();

  renderDashboard();

  if (autoStart) {
    openSetupModal(newQuiz.id, "PRACTICE");
  } else {
    switchView("view-dashboard");
  }

  return newQuiz;
}

// =============================================================================
// 9. QUIZ SETUP MODAL & RANDOMIZATION (XÁO TRỘN CÂU HỎI & ĐÁP ÁN)
// =============================================================================

let targetQuizForSetup = null;
let currentSetupMode = "PRACTICE"; // PRACTICE or EXAM

function openSetupModal(quizId, defaultMode = "PRACTICE") {
  const quiz = AppState.quizzes.find(q => q.id === quizId);
  if (!quiz) {
    showToast("Không tìm thấy đề thi được chọn!", "danger");
    return;
  }

  targetQuizForSetup = quiz;
  currentSetupMode = defaultMode;

  const modal = document.getElementById("modal-setup");
  const title = document.getElementById("setup-modal-title");
  const subtitle = document.getElementById("setup-modal-subtitle");
  const timeInput = document.getElementById("input-custom-duration");
  const limitSelect = document.getElementById("select-question-limit");

  if (title) title.textContent = `Cài đặt: ${quiz.title}`;
  if (subtitle) subtitle.textContent = `Đề thi có ${quiz.questions.length} câu hỏi • Mặc định ${quiz.timeLimit} phút`;
  if (timeInput) timeInput.value = quiz.timeLimit || 15;

  // Build question limit dropdown options
  if (limitSelect) {
    const total = quiz.questions.length;
    let optionsHtml = `<option value="ALL">Làm toàn bộ (${total} câu)</option>`;
    [5, 10, 15, 20, 30, 40, 50].forEach(num => {
      if (num < total) {
        optionsHtml += `<option value="${num}">Chọn ngẫu nhiên ${num} câu</option>`;
      }
    });
    limitSelect.innerHTML = optionsHtml;
  }

  // Update mode selection UI
  updateModeSelectionCards(defaultMode);

  // Sync Bàn phím Pro setting
  const shortcutsEl = document.getElementById("toggle-setup-shortcuts");
  if (shortcutsEl) shortcutsEl.checked = isShortcutsEnabled();

  modal.classList.add("open");
}

function closeSetupModal() {
  const modal = document.getElementById("modal-setup");
  if (modal) modal.classList.remove("open");
  targetQuizForSetup = null;
}

function updateModeSelectionCards(mode) {
  currentSetupMode = mode;
  const practiceCard = document.getElementById("mode-card-practice");
  const examCard = document.getElementById("mode-card-exam");
  const flashcardCard = document.getElementById("mode-card-flashcard");
  const survivalCard = document.getElementById("mode-card-survival");

  if (practiceCard) practiceCard.classList.toggle("selected", mode === "PRACTICE");
  if (examCard) examCard.classList.toggle("selected", mode === "EXAM");
  if (flashcardCard) flashcardCard.classList.toggle("selected", mode === "FLASHCARD");
  if (survivalCard) survivalCard.classList.toggle("selected", mode === "SURVIVAL");
}

// Fisher-Yates array shuffle algorithm
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Nhận diện độ khó của câu hỏi tự động hoặc theo tag
function getQuestionDifficulty(q) {
  if (q.difficulty) return q.difficulty;
  const text = (q.text || "") + " " + (q.explanation || "");
  if (/\[\s*(?:Khó|Hard|KHO|KHÓ)\s*\]/i.test(text) || /#kho\b/i.test(text)) return "HARD";
  if (/\[\s*(?:Dễ|Easy|DE|DỄ)\s*\]/i.test(text) || /#de\b/i.test(text)) return "EASY";
  if (/\[\s*(?:Vừa|Trung bình|Medium|TB)\s*\]/i.test(text) || /#vua\b/i.test(text)) return "MEDIUM";

  // Đánh giá dựa trên độ dài và độ phức tạp phương án
  if (text.length > 220 || (q.options && q.options.some(o => o && o.length > 75)) || /[\\\$]|\b(chọn phát biểu sai|không đúng)\b/i.test(text)) {
    return "HARD";
  }
  if (text.length < 80 && q.options && q.options.every(o => o && o.length < 32)) {
    return "EASY";
  }
  return "MEDIUM";
}

// Tách các hashtag chủ đề nếu có trong câu hỏi
function extractQuestionTags(text) {
  if (!text) return [];
  const matches = text.match(/#([a-zA-Z0-9_\u00C0-\u1EF9]+)/g);
  return matches ? matches.map(m => m.substring(1)) : [];
}

/**
 * Chuẩn bị câu hỏi với tùy chọn XÁO TRỘN CÂU HỎI & XÁO TRỘN ĐÁP ÁN & LỌC ĐỘ KHÓ:
 * Khi đảo đáp án, chúng ta bảo đảm ánh xạ chính xác vị trí đáp án đúng mới!
 */
function prepareSessionQuestions(rawQuestions, shuffleQuestions, shuffleOptions, limitCount, difficultyFilter = "ALL") {
  if (!Array.isArray(rawQuestions)) return [];

  let filtered = rawQuestions;
  if (difficultyFilter && difficultyFilter !== "ALL") {
    const matched = rawQuestions.filter(q => getQuestionDifficulty(q) === difficultyFilter);
    if (matched.length > 0) {
      filtered = matched;
    } else {
      showToast(`Không có câu hỏi theo độ khó đã chọn, hệ thống dùng toàn bộ câu hỏi.`, "info");
    }
  }

  let processed = filtered.map(q => {
    let options = Array.isArray(q.options) ? [...q.options] : [];
    let correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
    const diff = getQuestionDifficulty(q);

    if (shuffleOptions && options.length > 1) {
      // Tạo danh sách cặp { text, isCorrect }
      let pairs = options.map((opt, idx) => ({
        text: opt,
        isCorrect: idx === correctIndex
      }));

      // Đảo ngẫu nhiên các phương án
      pairs = shuffleArray(pairs);

      options = pairs.map(p => p.text);
      correctIndex = pairs.findIndex(p => p.isCorrect);
      if (correctIndex === -1) correctIndex = 0;
    }

    return {
      id: q.id || `q_${Math.random()}`,
      text: q.text || "",
      image: q.image || null,
      options: options,
      correctIndex: correctIndex,
      explanation: q.explanation || "",
      difficulty: diff,
      tags: extractQuestionTags(q.text)
    };
  });

  // Xáo trộn thứ tự các câu hỏi nếu được chọn
  if (shuffleQuestions) {
    processed = shuffleArray(processed);
  }

  // Giới hạn số câu nếu người dùng chọn
  if (limitCount && limitCount > 0 && limitCount < processed.length) {
    processed = processed.slice(0, limitCount);
  }

  return processed;
}

// Bắt đầu làm bài từ Modal Setup (Đã sửa triệt để lỗi targetQuizForSetup bị null)
function startQuizSession() {
  if (!targetQuizForSetup) {
    showToast("Không tìm thấy đề thi để bắt đầu!", "danger");
    return;
  }

  // LƯU Ý QUAN TRỌNG: Lưu tham chiếu đề thi và chế độ TRƯỚC KHI gọi closeSetupModal()
  const currentQuiz = targetQuizForSetup;
  const currentMode = currentSetupMode || "PRACTICE";

  const shuffleQ = document.getElementById("toggle-shuffle-questions") ? document.getElementById("toggle-shuffle-questions").checked : true;
  const shuffleOpts = document.getElementById("toggle-shuffle-options") ? document.getElementById("toggle-shuffle-options").checked : true;
  const limitVal = document.getElementById("select-question-limit") ? document.getElementById("select-question-limit").value : "ALL";
  const customTime = parseInt(document.getElementById("input-custom-duration")?.value) || currentQuiz.timeLimit || 15;
  const diffFilter = document.getElementById("select-difficulty-filter") ? document.getElementById("select-difficulty-filter").value : "ALL";

  const shortcutsEl = document.getElementById("toggle-setup-shortcuts");
  if (shortcutsEl) {
    setShortcutsEnabled(shortcutsEl.checked);
  }

  const limitCount = limitVal === "ALL" ? 0 : parseInt(limitVal);

  const preparedQuestions = prepareSessionQuestions(
    currentQuiz.questions,
    shuffleQ,
    shuffleOpts,
    limitCount,
    diffFilter
  );

  if (!preparedQuestions || preparedQuestions.length === 0) {
    showToast("Đề thi này không có câu hỏi nào để bắt đầu!", "danger");
    return;
  }

  // Đóng modal cài đặt an toàn
  closeSetupModal();

  // Khởi động phiên làm bài
  initRunnerSession({
    quizId: currentQuiz.id,
    quizTitle: currentQuiz.title,
    category: currentQuiz.category,
    mode: currentMode,
    questions: preparedQuestions,
    durationMinutes: customTime
  });
}

// =============================================================================
// 10. QUIZ RUNNER ENGINE (ÔN TẬP & THI THỬ)
// =============================================================================

function initRunnerSession(config) {
  // Clear any previous timer
  if (AppState.session.timerInterval) {
    clearInterval(AppState.session.timerInterval);
  }
  if (AppState.session.survivalTimerInterval) {
    clearInterval(AppState.session.survivalTimerInterval);
  }

  const isFlashcard = config.mode === "FLASHCARD";
  const isSurvival = config.mode === "SURVIVAL";

  AppState.session = {
    mode: config.mode,
    quizId: config.quizId,
    quizTitle: config.quizTitle,
    category: config.category,
    questions: config.questions,
    userAnswers: {},
    flags: new Set(),
    currentIndex: 0,
    timeRemaining: config.durationMinutes * 60,
    timeSpent: 0,
    timerInterval: null,
    isFlashcard: isFlashcard,
    isSubmitted: false,
    // Survival Mode Attributes
    survivalLives: 3,
    survivalScore: 0,
    survivalCombo: 1,
    survivalMaxCombo: 1,
    survivalSurvived: 0,
    survivalQuestionTimer: 15,
    survivalTimerInterval: null
  };

  // Setup UI elements
  const modeBadge = document.getElementById("runner-mode-badge");
  const catBadge = document.getElementById("runner-category-badge");
  const titleEl = document.getElementById("runner-quiz-title");
  const finishBtnText = document.getElementById("btn-finish-quiz-text");
  const flashcardToggleBtn = document.getElementById("btn-toggle-flashcard-mode");
  const standardView = document.getElementById("standard-question-view");
  const flashcardView = document.getElementById("flashcard-view");
  const hudContainer = document.getElementById("survival-hud-container");
  const timerContainer = document.getElementById("quiz-timer-container");

  if (hudContainer) {
    hudContainer.style.display = isSurvival ? "flex" : "none";
  }

  if (modeBadge) {
    if (config.mode === "SURVIVAL") {
      modeBadge.textContent = "⚡ CHẾ ĐỘ SINH TỒN";
      modeBadge.className = "badge btn-survival";
    } else if (config.mode === "FLASHCARD") {
      modeBadge.textContent = "THẺ FLASHCARD 3D";
      modeBadge.className = "badge badge-primary";
    } else if (config.mode === "PRACTICE") {
      modeBadge.textContent = "CHẾ ĐỘ ÔN TẬP";
      modeBadge.className = "badge badge-primary";
    } else {
      modeBadge.textContent = "CHẾ ĐỘ THI THỬ";
      modeBadge.className = "badge badge-warning";
    }
  }

  if (catBadge) catBadge.textContent = config.category || "Chung";
  if (titleEl) titleEl.textContent = config.quizTitle;
  if (finishBtnText) {
    if (isSurvival) finishBtnText.textContent = "Dừng Sinh Tồn";
    else finishBtnText.textContent = (config.mode === "PRACTICE" || config.mode === "FLASHCARD") ? "Kết Thúc Ôn Tập" : "Nộp Bài Thi";
  }

  if (flashcardToggleBtn) {
    flashcardToggleBtn.style.display = (config.mode === "PRACTICE" || config.mode === "FLASHCARD") ? "inline-flex" : "none";
    if (isFlashcard) {
      flashcardToggleBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
        Chuyển về Trắc nghiệm
      `;
    } else {
      flashcardToggleBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        Chế độ Flashcard
      `;
    }
  }

  if (standardView && flashcardView) {
    if (isFlashcard) {
      standardView.style.display = "none";
      flashcardView.style.display = "block";
    } else {
      standardView.style.display = "block";
      flashcardView.style.display = "none";
    }
  }

  // Dynamic legend updating for Practice vs Exam vs Survival
  const isPracticeMode = config.mode === "PRACTICE" || config.mode === "FLASHCARD" || isSurvival;
  const legendDotStatus = document.getElementById("legend-dot-status");
  const legendTextStatus = document.getElementById("legend-text-status");
  const legendItemWrong = document.getElementById("legend-item-wrong");

  if (legendDotStatus && legendTextStatus) {
    if (isPracticeMode) {
      legendDotStatus.className = "legend-dot dot-correct";
      legendTextStatus.textContent = "Đúng / Thuộc";
      if (legendItemWrong) legendItemWrong.style.display = "flex";
    } else {
      legendDotStatus.className = "legend-dot dot-answered";
      legendTextStatus.textContent = "Đã làm";
      if (legendItemWrong) legendItemWrong.style.display = "none";
    }
  }

  if (isSurvival) {
    updateSurvivalHUD();
  }

  // Switch to Runner View
  switchView("view-runner");

  // Render question palette sidebar
  renderPalette();

  // Load first question
  loadQuestion(0);

  // Start global timer
  startTimer();
}

function startTimer() {
  const timerDisplay = document.getElementById("quiz-timer-display");
  const timerBox = document.getElementById("quiz-timer-container");

  function updateDisplay() {
    let displaySec = 0;
    if (AppState.session.mode === "EXAM") {
      displaySec = Math.max(0, AppState.session.timeRemaining);
      // Warning if < 3 minutes
      if (displaySec <= 180 && displaySec > 0) {
        timerBox.classList.add("timer-warning");
      } else {
        timerBox.classList.remove("timer-warning");
      }
    } else {
      displaySec = AppState.session.timeSpent;
    }

    const mins = Math.floor(displaySec / 60);
    const secs = displaySec % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  updateDisplay();

  AppState.session.timerInterval = setInterval(() => {
    AppState.session.timeSpent++;

    if (AppState.session.mode === "EXAM") {
      AppState.session.timeRemaining--;
      updateDisplay();

      if (AppState.session.timeRemaining <= 0) {
        clearInterval(AppState.session.timerInterval);
        showToast("Hết giờ làm bài! Hệ thống tự động nộp bài thi.", "danger");
        submitQuiz(true);
      }
    } else {
      updateDisplay();
    }
  }, 1000);
}

function loadQuestion(index) {
  cancelAutoAdvance();
  const questions = AppState.session.questions;
  if (index < 0 || index >= questions.length) return;

  AppState.session.currentIndex = index;
  const q = questions[index];
  const isPractice = AppState.session.mode === "PRACTICE";
  const isSurvival = AppState.session.mode === "SURVIVAL";
  const hasAnswered = AppState.session.userAnswers[index] !== undefined;
  const userAnswer = AppState.session.userAnswers[index];

  // Update counters
  const curIdxEl = document.getElementById("current-question-index");
  const totalCountEl = document.getElementById("total-questions-count");
  if (curIdxEl) curIdxEl.textContent = index + 1;
  if (totalCountEl) totalCountEl.textContent = questions.length;
  const mCurIdx = document.getElementById("mobile-nav-current-q");
  const mTotal = document.getElementById("mobile-nav-total-q");
  if (mCurIdx) mCurIdx.textContent = index + 1;
  if (mTotal) mTotal.textContent = questions.length;

  // Difficulty badge
  const diffBadgeEl = document.getElementById("question-difficulty-badge");
  if (diffBadgeEl) {
    const diff = q.difficulty || getQuestionDifficulty(q);
    if (diff === "EASY") {
      diffBadgeEl.innerHTML = `<span class="badge-diff-easy">🟢 Dễ</span>`;
    } else if (diff === "HARD") {
      diffBadgeEl.innerHTML = `<span class="badge-diff-hard">🔴 Khó</span>`;
    } else {
      diffBadgeEl.innerHTML = `<span class="badge-diff-medium">🟡 Vừa</span>`;
    }
  }

  // Flag button state
  const flagBtn = document.getElementById("btn-flag-question");
  const flagText = document.getElementById("flag-btn-text");
  const isFlagged = AppState.session.flags.has(index);
  if (flagBtn) {
    flagBtn.classList.toggle("flagged", isFlagged);
    flagText.textContent = isFlagged ? "Đã cắm cờ" : "Đặt cờ";
  }

  // Sticky Note for current question
  const noteBtn = document.getElementById("btn-toggle-note");
  const noteInput = document.getElementById("sticky-note-input");
  const currentNote = getQuestionNote(AppState.session.quizId, q.id, index);
  if (noteInput) noteInput.value = currentNote;
  if (noteBtn) noteBtn.classList.toggle("has-note", !!currentNote);

  // Navigation Prev/Next button states
  const prevBtn = document.getElementById("btn-prev-question");
  const nextBtn = document.getElementById("btn-next-question");
  if (prevBtn) prevBtn.disabled = index === 0;
  if (nextBtn) {
    if (index === questions.length - 1) {
      nextBtn.innerHTML = `Hoàn thành <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
      nextBtn.innerHTML = `Câu tiếp theo <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    }
  }

  // Render question text
  const textEl = document.getElementById("question-text-content");
  if (textEl) textEl.textContent = q.text;

  // Render question image if present
  const imgBox = document.getElementById("question-image-box");
  const imgEl = document.getElementById("question-img-el");
  if (imgBox && imgEl) {
    if (q.image) {
      imgEl.src = q.image;
      imgBox.style.display = "inline-block";
      imgEl.onclick = () => openImageZoom(q.image);
    } else {
      imgBox.style.display = "none";
      imgEl.src = "";
    }
  }

  // Render options
  const optionsContainer = document.getElementById("options-container");
  if (optionsContainer) {
    const showFeedback = (isPractice || isSurvival) && hasAnswered;
    optionsContainer.innerHTML = q.options.map((opt, optIdx) => {
      const letter = String.fromCharCode(65 + optIdx);
      const isSelected = userAnswer === optIdx;

      let extraClasses = "";
      if (isSelected) extraClasses += " selected";

      if (showFeedback) {
        extraClasses += " locked";
        if (optIdx === q.correctIndex) {
          extraClasses += " correct-choice";
        } else if (isSelected && optIdx !== q.correctIndex) {
          extraClasses += " wrong-choice";
        }
      }

      return `
        <button class="option-btn ${extraClasses}" onclick="selectOption(${index}, ${optIdx})">
          <div class="option-letter">${letter}</div>
          <div style="flex: 1;">${escapeHtml(opt)}</div>
          ${showFeedback && optIdx === q.correctIndex ? `<span style="color: var(--success); font-weight: 700;">✔</span>` : ''}
          ${showFeedback && isSelected && optIdx !== q.correctIndex ? `<span style="color: var(--danger); font-weight: 700;">✖</span>` : ''}
        </button>
      `;
    }).join("");
  }

  // Explanation box (Practice mode)
  const explContainer = document.getElementById("explanation-container");
  const explText = document.getElementById("explanation-text-content");
  if (explContainer) {
    if (isPractice && hasAnswered && q.explanation) {
      explContainer.style.display = "block";
      explText.textContent = q.explanation;
    } else {
      explContainer.style.display = "none";
    }
  }

  // Ensure current mode view is active
  const standardView = document.getElementById("standard-question-view");
  const flashcardView = document.getElementById("flashcard-view");
  if (standardView && flashcardView) {
    if (AppState.session.isFlashcard) {
      standardView.style.display = "none";
      flashcardView.style.display = "block";
    } else {
      standardView.style.display = "block";
      flashcardView.style.display = "none";
    }
  }

  // Update Flashcard content
  updateFlashcardContent(q);

  // Update palette highlight
  updatePaletteCellStatus();

  // Survival question countdown
  if (isSurvival && !hasAnswered) {
    startSurvivalQuestionTimer();
  }

  // Render Math / Chemistry formulas if KaTeX is present
  renderMathInElementSafe(document.querySelector('.question-card-main'));
}

function selectOption(qIndex, optionIndex) {
  const isPractice = AppState.session.mode === "PRACTICE";
  const isSurvival = AppState.session.mode === "SURVIVAL";
  const hasAnswered = AppState.session.userAnswers[qIndex] !== undefined;

  // In practice or survival mode, once answered, lock option clicks
  if ((isPractice || isSurvival) && hasAnswered) return;

  AppState.session.userAnswers[qIndex] = optionIndex;

  const q = AppState.session.questions[qIndex];
  const isCorrect = optionIndex === q.correctIndex;

  if (isSurvival) {
    handleSurvivalAnswer(qIndex, isCorrect);
    return;
  }

  if (isPractice) {
    if (isCorrect) {
      playSound("correct");
    } else {
      playSound("wrong");
    }
  } else {
    playSound("click");
  }

  // Re-render current question view
  loadQuestion(qIndex);

  // Trigger auto-advance if enabled
  triggerAutoAdvance(qIndex);
}

// =============================================================================
// AUTO-ADVANCE QUESTION ENGINE (v3.3.2)
// =============================================================================

function initAutoAdvanceSetting() {
  const saved = localStorage.getItem(STORAGE_KEYS.AUTO_ADVANCE);
  AppState.autoAdvance = saved !== null ? saved : "1.5";
  updateAutoAdvanceUI(AppState.autoAdvance);
}

function setAutoAdvanceSetting(val, showNotification = true) {
  AppState.autoAdvance = String(val);
  try {
    localStorage.setItem(STORAGE_KEYS.AUTO_ADVANCE, AppState.autoAdvance);
  } catch (e) {}

  updateAutoAdvanceUI(AppState.autoAdvance);
  cancelAutoAdvance();

  // Close dropdown menu if open
  const menu = document.getElementById("auto-advance-menu");
  if (menu) menu.classList.remove("open");

  if (showNotification) {
    let desc = "Tắt (Chuyển câu thủ công)";
    if (val === "0") desc = "Chuyển ngay tức thì (0s)";
    else if (val !== "off") desc = `Sau ${val} giây`;
    showToast(`⚡ Đã đặt tự chuyển câu: ${desc}`, "info");
  }
}

function updateAutoAdvanceUI(val) {
  const labelEl = document.getElementById("auto-advance-display-text");
  const btnEl = document.getElementById("btn-toggle-auto-advance");
  const setupSelect = document.getElementById("select-setup-auto-advance");

  if (labelEl && btnEl) {
    if (val === "off") {
      labelEl.textContent = "Tự chuyển: Tắt";
      btnEl.classList.add("is-off");
    } else if (val === "0") {
      labelEl.textContent = "Tự chuyển: 0s (Ngay)";
      btnEl.classList.remove("is-off");
    } else {
      labelEl.textContent = `Tự chuyển: ${val}s`;
      btnEl.classList.remove("is-off");
    }
  }

  // Update active state in runner dropdown
  document.querySelectorAll(".auto-advance-opt").forEach(opt => {
    if (opt.getAttribute("data-speed") === val) {
      opt.classList.add("active");
    } else {
      opt.classList.remove("active");
    }
  });

  // Sync setup modal select
  if (setupSelect && setupSelect.value !== val) {
    setupSelect.value = val;
  }
}

function triggerAutoAdvance(qIndex) {
  cancelAutoAdvance();

  const val = AppState.autoAdvance;
  if (!val || val === "off") return;
  if (!AppState.session || !AppState.session.questions) return;
  if (AppState.session.mode === "FLASHCARD") return;

  const nextIndex = qIndex + 1;
  const questions = AppState.session.questions;
  if (nextIndex >= questions.length) {
    // Reached the last question
    return;
  }

  if (val === "0") {
    // Instant advance
    loadQuestion(nextIndex);
    return;
  }

  const delaySec = parseFloat(val) || 1.5;
  const indicator = document.getElementById("auto-advance-indicator");
  const textEl = document.getElementById("auto-advance-toast-text");
  const progressLine = document.getElementById("auto-advance-progress-line");

  if (indicator && textEl) {
    textEl.textContent = `⚡ Tự động chuyển câu sau ${delaySec}s...`;
    indicator.style.display = "flex";
  }

  if (progressLine) {
    progressLine.style.animation = "none";
    void progressLine.offsetWidth; // Force reflow to restart animation
    progressLine.style.animation = `advanceProgressLine ${delaySec}s linear forwards`;
  }

  AppState.session.autoAdvanceTimer = setTimeout(() => {
    cancelAutoAdvance();
    loadQuestion(nextIndex);
  }, delaySec * 1000);
}

function cancelAutoAdvance() {
  if (AppState.session && AppState.session.autoAdvanceTimer) {
    clearTimeout(AppState.session.autoAdvanceTimer);
    AppState.session.autoAdvanceTimer = null;
  }
  const indicator = document.getElementById("auto-advance-indicator");
  if (indicator) indicator.style.display = "none";
  const progressLine = document.getElementById("auto-advance-progress-line");
  if (progressLine) {
    progressLine.style.animation = "none";
  }
}

function toggleFlagCurrentQuestion() {
  const idx = AppState.session.currentIndex;
  if (AppState.session.flags.has(idx)) {
    AppState.session.flags.delete(idx);
    showToast(`Đã bỏ cắm cờ câu ${idx + 1}`);
  } else {
    AppState.session.flags.add(idx);
    showToast(`Đã cắm cờ câu ${idx + 1} để xem lại sau!`);
  }
  loadQuestion(idx);
}

// Palette Sidebar
function renderPalette() {
  const container = document.getElementById("palette-grid-container");
  const progressBadge = document.getElementById("palette-progress-badge");
  if (!container) return;

  const total = AppState.session.questions.length;
  if (progressBadge) progressBadge.textContent = `0 / ${total}`;

  container.innerHTML = AppState.session.questions.map((_, idx) => {
    return `<div class="palette-cell" id="palette-cell-${idx}" onclick="loadQuestion(${idx})" title="Câu hỏi số ${idx + 1}" role="button" aria-label="Câu ${idx + 1}">${idx + 1}</div>`;
  }).join("");

  updatePaletteCellStatus();
}

function updatePaletteCellStatus() {
  const total = AppState.session.questions.length;
  let answeredCount = 0;
  const isPractice = AppState.session.mode === "PRACTICE" || AppState.session.mode === "SURVIVAL";

  for (let i = 0; i < total; i++) {
    const cell = document.getElementById(`palette-cell-${i}`);
    if (!cell) continue;

    cell.className = "palette-cell";

    if (i === AppState.session.currentIndex) {
      cell.classList.add("current");
    }

    const hasAnswered = AppState.session.userAnswers[i] !== undefined;
    if (hasAnswered) {
      answeredCount++;
      if (isPractice) {
        const isCorrect = AppState.session.userAnswers[i] === AppState.session.questions[i].correctIndex;
        cell.classList.add(isCorrect ? "correct" : "wrong");
      } else {
        cell.classList.add("answered");
      }
    }

    if (AppState.session.flags.has(i)) {
      cell.classList.add("flagged");
    }

    // Check sticky note indicator
    const q = AppState.session.questions[i];
    const hasNote = !!getQuestionNote(AppState.session.quizId, q?.id, i);
    if (hasNote) {
      cell.classList.add("has-note");
    }
  }

  const progressBadge = document.getElementById("palette-progress-badge");
  if (progressBadge) {
    progressBadge.textContent = `${answeredCount} / ${total}`;
  }
}

// =============================================================================
// SURVIVAL MODE ENGINE (15s/CÂU, 3 MẠNG, COMBO ĐIỂM)
// =============================================================================

function startSurvivalQuestionTimer() {
  if (AppState.session.mode !== "SURVIVAL") return;
  clearInterval(AppState.session.survivalTimerInterval);

  AppState.session.survivalQuestionTimer = 15;
  updateSurvivalHUD();

  AppState.session.survivalTimerInterval = setInterval(() => {
    AppState.session.survivalQuestionTimer--;
    updateSurvivalHUD();

    if (AppState.session.survivalQuestionTimer <= 0) {
      clearInterval(AppState.session.survivalTimerInterval);
      handleSurvivalTimeout();
    }
  }, 1000);
}

function handleSurvivalTimeout() {
  playSound("wrong");
  const card = document.querySelector(".question-card-main");
  if (card) {
    card.classList.add("shake-screen");
    setTimeout(() => card.classList.remove("shake-screen"), 400);
  }

  // Mark answer as timed out (wrong)
  AppState.session.userAnswers[AppState.session.currentIndex] = -1;
  AppState.session.survivalLives--;
  AppState.session.survivalCombo = 1;
  updateSurvivalHUD();
  updatePaletteCellStatus();

  if (AppState.session.survivalLives <= 0) {
    endSurvivalGame(false);
  } else {
    showToast(`⏱️ Hết 15 giây! Mất 1 mạng (còn ${AppState.session.survivalLives} mạng)`, "danger");
    setTimeout(() => {
      if (AppState.session.currentIndex < AppState.session.questions.length - 1) {
        loadQuestion(AppState.session.currentIndex + 1);
      } else {
        endSurvivalGame(true);
      }
    }, 800);
  }
}

function handleSurvivalAnswer(qIndex, isCorrect) {
  loadQuestion(qIndex);
  clearInterval(AppState.session.survivalTimerInterval);

  if (isCorrect) {
    playSound("correct");
    const points = 100 * AppState.session.survivalCombo;
    AppState.session.survivalScore += points;
    AppState.session.survivalCombo++;
    if (AppState.session.survivalCombo > AppState.session.survivalMaxCombo) {
      AppState.session.survivalMaxCombo = AppState.session.survivalCombo;
    }
    AppState.session.survivalSurvived++;

    // Time bonus +5s
    AppState.session.survivalQuestionTimer = Math.min(25, AppState.session.survivalQuestionTimer + 5);
    updateSurvivalHUD();
    showToast(`🔥 +${points} điểm! Combo x${AppState.session.survivalCombo - 1} (+5s thưởng)`, "success");

    setTimeout(() => {
      if (AppState.session.currentIndex < AppState.session.questions.length - 1) {
        loadQuestion(AppState.session.currentIndex + 1);
      } else {
        endSurvivalGame(true);
      }
    }, 600);
  } else {
    playSound("wrong");
    const card = document.querySelector(".question-card-main");
    if (card) {
      card.classList.add("shake-screen");
      setTimeout(() => card.classList.remove("shake-screen"), 400);
    }

    AppState.session.survivalLives--;
    AppState.session.survivalCombo = 1;
    updateSurvivalHUD();

    if (AppState.session.survivalLives <= 0) {
      setTimeout(() => endSurvivalGame(false), 700);
    } else {
      showToast(`💔 Mất 1 mạng! Còn ${AppState.session.survivalLives} mạng`, "danger");
      setTimeout(() => {
        if (AppState.session.currentIndex < AppState.session.questions.length - 1) {
          loadQuestion(AppState.session.currentIndex + 1);
        } else {
          endSurvivalGame(true);
        }
      }, 800);
    }
  }
}

function updateSurvivalHUD() {
  const container = document.getElementById("survival-hud-container");
  if (!container || AppState.session.mode !== "SURVIVAL") return;

  const lives = AppState.session.survivalLives;
  for (let i = 1; i <= 3; i++) {
    const heart = document.getElementById(`heart-${i}`);
    if (heart) {
      heart.textContent = i <= lives ? "❤️" : "🖤";
      heart.classList.toggle("lost", i > lives);
    }
  }

  const comboEl = document.getElementById("survival-combo-text");
  if (comboEl) comboEl.textContent = `Combo x${AppState.session.survivalCombo}`;

  const scoreEl = document.getElementById("survival-score-val");
  if (scoreEl) scoreEl.textContent = AppState.session.survivalScore;

  const timeNum = document.getElementById("survival-time-num");
  const timeBar = document.getElementById("survival-timer-bar-el");
  const t = Math.max(0, AppState.session.survivalQuestionTimer);
  if (timeNum) timeNum.textContent = `${t}s`;
  if (timeBar) {
    const pct = Math.min(100, Math.max(0, (t / 15) * 100));
    timeBar.style.width = `${pct}%`;
    timeBar.classList.toggle("danger", t <= 5);
  }
}

function endSurvivalGame(completedAll = false) {
  clearInterval(AppState.session.survivalTimerInterval);
  if (AppState.session.timerInterval) clearInterval(AppState.session.timerInterval);

  const finalScore = AppState.session.survivalScore || 0;
  const maxCombo = AppState.session.survivalMaxCombo || 1;
  const survived = AppState.session.survivalSurvived || 0;

  let highScores = {};
  try {
    highScores = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVIVAL_HIGHSCORES) || "{}");
  } catch (e) { highScores = {}; }

  const quizKey = AppState.session.quizId || "default";
  const oldHigh = highScores[quizKey] || 0;
  const isNewRecord = finalScore > oldHigh;
  if (isNewRecord) {
    highScores[quizKey] = finalScore;
    localStorage.setItem(STORAGE_KEYS.SURVIVAL_HIGHSCORES, JSON.stringify(highScores));
    if (typeof fireNeonConfetti === "function") fireNeonConfetti();
  }

  const modal = document.getElementById("modal-survival-gameover");
  const scoreVal = document.getElementById("survival-final-score");
  const comboVal = document.getElementById("survival-max-combo");
  const survivedVal = document.getElementById("survival-survived-count");
  const highVal = document.getElementById("survival-high-score");

  if (scoreVal) scoreVal.textContent = finalScore;
  if (comboVal) comboVal.textContent = `x${maxCombo}`;
  if (survivedVal) survivedVal.textContent = `${survived} câu`;
  if (highVal) highVal.textContent = isNewRecord ? `${finalScore} 🏆 (Kỷ lục mới!)` : `${oldHigh}`;

  if (modal) modal.classList.add("open");
}

// =============================================================================
// STICKY NOTES ENGINE (GHI CHÚ CÁ NHÂN TRÊN CÂU HỎI)
// =============================================================================

function getQuestionNoteKey(quizId, qId, qIndex) {
  return `note_${quizId || 'quiz'}_${qId || qIndex}`;
}

function getQuestionNote(quizId, qId, qIndex) {
  try {
    const notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTION_NOTES) || "{}");
    return notes[getQuestionNoteKey(quizId, qId, qIndex)] || "";
  } catch (e) {
    return "";
  }
}

function saveQuestionNote(quizId, qId, qIndex, text) {
  try {
    const notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTION_NOTES) || "{}");
    const key = getQuestionNoteKey(quizId, qId, qIndex);
    if (text && text.trim()) {
      notes[key] = text.trim();
    } else {
      delete notes[key];
    }
    localStorage.setItem(STORAGE_KEYS.QUESTION_NOTES, JSON.stringify(notes));

    // Update note button status
    const btn = document.getElementById("btn-toggle-note");
    if (btn) btn.classList.toggle("has-note", !!(text && text.trim()));

    // Update palette dot
    const cell = document.getElementById(`palette-cell-${qIndex}`);
    if (cell) cell.classList.toggle("has-note", !!(text && text.trim()));
  } catch (e) {
    console.error("Lỗi lưu ghi chú:", e);
  }
}

function toggleStickyNoteDrawer() {
  const drawer = document.getElementById("sticky-note-drawer");
  if (!drawer) return;
  const isHidden = drawer.style.display === "none";
  drawer.style.display = isHidden ? "block" : "none";
  if (isHidden) {
    const input = document.getElementById("sticky-note-input");
    if (input) input.focus();
  }
}

function appendQuickTagToNote(tag) {
  const input = document.getElementById("sticky-note-input");
  if (!input) return;
  const curVal = input.value.trim();
  input.value = curVal ? `${curVal}\n${tag} ` : `${tag} `;
  input.focus();
  const qIndex = AppState.session.currentIndex;
  const q = AppState.session.questions[qIndex];
  saveQuestionNote(AppState.session.quizId, q?.id, qIndex, input.value);
}

// Flashcard Mode Toggle
function toggleFlashcardMode() {
  AppState.session.isFlashcard = !AppState.session.isFlashcard;
  const standardView = document.getElementById("standard-question-view");
  const flashcardView = document.getElementById("flashcard-view");
  const toggleBtn = document.getElementById("btn-toggle-flashcard-mode");

  if (AppState.session.isFlashcard) {
    standardView.style.display = "none";
    flashcardView.style.display = "block";
    toggleBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      Chuyển về Trắc nghiệm
    `;
  } else {
    standardView.style.display = "block";
    flashcardView.style.display = "none";
    toggleBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
      Chế độ Thẻ ghi nhớ (Flashcard)
    `;
  }
}

function updateFlashcardContent(q) {
  const cardEl = document.getElementById("flashcard-element");
  const frontText = document.getElementById("flashcard-front-text");
  const frontImgBox = document.getElementById("flashcard-front-img-box");
  const frontImg = document.getElementById("flashcard-front-img");
  const backAnswer = document.getElementById("flashcard-back-answer");
  const backExpl = document.getElementById("flashcard-back-explanation");

  if (cardEl) cardEl.classList.remove("flipped");
  if (frontText) frontText.textContent = q.text;

  if (frontImgBox && frontImg) {
    if (q.image) {
      frontImg.src = q.image;
      frontImgBox.style.display = "block";
    } else {
      frontImgBox.style.display = "none";
      frontImg.src = "";
    }
  }

  const correctLetter = String.fromCharCode(65 + q.correctIndex);
  const correctText = (q.options && q.options[q.correctIndex]) ? q.options[q.correctIndex] : "";

  if (backAnswer) backAnswer.textContent = `${correctLetter}. ${correctText}`;
  if (backExpl) backExpl.textContent = q.explanation || "Không có giải thích chi tiết cho câu hỏi này.";

  renderMathInElementSafe(document.getElementById("flashcard-view"));
}

function flipFlashcard() {
  const cardEl = document.getElementById("flashcard-element");
  if (cardEl) {
    cardEl.classList.toggle("flipped");
    playSound("flip");
  }
}

function markFlashcardMastered() {
  const curIdx = AppState.session.currentIndex;
  const q = AppState.session.questions[curIdx];
  if (!q) return;

  AppState.session.userAnswers[curIdx] = q.correctIndex;
  playSound("correct");
  updatePaletteCellStatus();
  showToast(`✅ Đã thuộc câu ${curIdx + 1}!`, "success");

  if (curIdx < AppState.session.questions.length - 1) {
    setTimeout(() => loadQuestion(curIdx + 1), 350);
  } else {
    showToast("🎉 Bạn đã xem hết tất cả câu hỏi flashcard!", "info");
  }
}

function markFlashcardNeedReview() {
  const curIdx = AppState.session.currentIndex;
  const q = AppState.session.questions[curIdx];
  if (!q) return;

  AppState.session.userAnswers[curIdx] = -1;
  AppState.session.flags.add(curIdx);
  playSound("wrong");
  updatePaletteCellStatus();
  showToast(`📌 Đã lưu câu ${curIdx + 1} vào sổ tay cần ôn lại!`, "warning");

  addMistakesToVault([q], AppState.session.quizTitle || "Flashcard");

  if (curIdx < AppState.session.questions.length - 1) {
    setTimeout(() => loadQuestion(curIdx + 1), 350);
  }
}

// Finish / Submit confirmation
function handleFinishQuizRequest() {
  const total = AppState.session.questions.length;
  const answered = Object.keys(AppState.session.userAnswers).length;
  const unAnswered = total - answered;

  const modal = document.getElementById("modal-confirm-submit");
  const warningText = document.getElementById("submit-warning-text");

  if (AppState.session.mode === "EXAM") {
    if (unAnswered > 0) {
      warningText.innerHTML = `
        <div style="color: var(--danger); font-weight: 700; margin-bottom: 0.5rem;">Cảnh báo: Bạn còn ${unAnswered} câu chưa làm!</div>
        Bạn đã hoàn thành <strong>${answered}/${total}</strong> câu hỏi. Bạn có chắc chắn muốn nộp bài thi ngay không?
      `;
    } else {
      warningText.innerHTML = `
        Bạn đã hoàn thành toàn bộ <strong>${total}/${total}</strong> câu hỏi! Bạn có muốn nộp bài để xem kết quả đánh giá không?
      `;
    }
  } else {
    warningText.innerHTML = `Bạn có muốn kết thúc phiên ôn tập và xem bảng tổng kết đánh giá không?`;
  }

  modal.classList.add("open");
}

function submitQuiz(force = false) {
  if (AppState.session.timerInterval) {
    clearInterval(AppState.session.timerInterval);
  }

  const modal = document.getElementById("modal-confirm-submit");
  if (modal) modal.classList.remove("open");

  AppState.session.isSubmitted = true;
  playSound("complete");

  renderResultsScreen();
  switchView("view-result");
}

// =============================================================================
// 11. RESULTS & REVIEW ENGINE
// =============================================================================

function renderResultsScreen() {
  const questions = AppState.session.questions;
  const answers = AppState.session.userAnswers;
  const total = questions.length;

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  questions.forEach((q, idx) => {
    const userChoice = answers[idx];
    if (userChoice === undefined) {
      skippedCount++;
    } else if (userChoice === q.correctIndex) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });

  const score10 = ((correctCount / total) * 10).toFixed(1);
  const percent = Math.round((correctCount / total) * 100);

  // Update elements
  document.getElementById("result-score-10").textContent = score10;
  document.getElementById("result-score-percent").textContent = percent;
  document.getElementById("result-stat-correct").textContent = correctCount;
  document.getElementById("result-stat-wrong").textContent = wrongCount;
  document.getElementById("result-stat-skipped").textContent = skippedCount;

  // Format time spent
  const timeSec = AppState.session.timeSpent;
  const mins = Math.floor(timeSec / 60);
  const secs = timeSec % 60;
  document.getElementById("result-stat-time").textContent = 
    `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // Verdict evaluation
  const titleEl = document.getElementById("result-verdict-title");
  const descEl = document.getElementById("result-verdict-desc");

  if (percent >= 90) {
    titleEl.textContent = "Xuất sắc! Bạn nắm bài rất tốt 🎉";
    descEl.textContent = "Kiến thức của bạn rất vững chắc, phản xạ trả lời câu hỏi cực kỳ chính xác.";
  } else if (percent >= 75) {
    titleEl.textContent = "Rất tốt! Bạn đã đạt điểm cao 👏";
    descEl.textContent = "Kết quả rất ấn tượng, chỉ cần chú ý một vài lỗi nhỏ để đạt điểm tuyệt đối.";
  } else if (percent >= 50) {
    titleEl.textContent = "Đạt yêu cầu! Cần luyện thêm 👍";
    descEl.textContent = "Bạn đã nắm được phần lớn kiến thức cơ bản, hãy ôn lại các câu sai để cải thiện.";
  } else {
    titleEl.textContent = "Cần cố gắng nhiều hơn! 💪";
    descEl.textContent = "Đừng nản lòng, hãy xem lại phần giải thích chi tiết và bấm nút 'Chỉ làm lại các câu SAI' để luyện tập.";
  }

  // Neon Confetti celebration for good score
  if (percent >= 75) {
    setTimeout(fireNeonConfetti, 300);
  }

  // Save attempt to Learning Analytics History
  saveQuizHistory({
    id: `hist_${Date.now()}`,
    quizId: AppState.session.quizId,
    quizTitle: AppState.session.quizTitle || "Bài kiểm tra",
    category: AppState.session.category || "Chung",
    mode: AppState.session.mode,
    score10: parseFloat(score10),
    percent: percent,
    correctCount: correctCount,
    wrongCount: wrongCount,
    skippedCount: skippedCount,
    total: total,
    timeSpent: AppState.session.timeSpent,
    timestamp: new Date().toISOString()
  });

  // Automatically save wrong questions to Mistake Vault (Sổ tay câu sai)
  if (wrongCount > 0) {
    const wrongQuestions = questions
      .map((q, idx) => ({ q, idx, userPick: answers[idx] }))
      .filter(item => item.userPick !== item.q.correctIndex)
      .map(item => item.q);
    addMistakesToVault(wrongQuestions, AppState.session.quizTitle || "Bài kiểm tra");
  }

  // Toggle retry wrongs button visibility
  const retryWrongsBtn = document.getElementById("btn-retry-wrongs");
  if (retryWrongsBtn) {
    retryWrongsBtn.style.display = wrongCount > 0 ? "inline-flex" : "none";
  }

  // Toggle AI Tutor buttons
  const aiTutorBtn = document.getElementById("btn-ai-tutor-wrongs");
  if (aiTutorBtn) {
    aiTutorBtn.style.display = wrongCount > 0 ? "inline-flex" : "none";
    aiTutorBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      ✨ AI Chữa & Giải Thích ${wrongCount} Câu Sai
    `;
  }
  const aiTutorSubBtn = document.getElementById("btn-ai-tutor-wrongs-sub");
  if (aiTutorSubBtn) {
    aiTutorSubBtn.style.display = wrongCount > 0 ? "inline-flex" : "none";
    aiTutorSubBtn.textContent = `🤖 AI Chữa ${wrongCount} Câu Sai`;
  }

  // Render question-by-question review
  renderReviewList("ALL");
}

function renderReviewList(filter = "ALL") {
  const container = document.getElementById("review-list-container");
  if (!container) return;

  const questions = AppState.session.questions;
  const answers = AppState.session.userAnswers;

  const items = questions.map((q, idx) => {
    const userChoice = answers[idx];
    const isAnswered = userChoice !== undefined;
    const isCorrect = userChoice === q.correctIndex;

    return {
      index: idx,
      question: q,
      userChoice,
      isAnswered,
      isCorrect
    };
  }).filter(item => {
    if (filter === "CORRECT") return item.isCorrect;
    if (filter === "WRONG") return !item.isCorrect;
    return true;
  });

  if (items.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
        <p style="color: var(--text-muted);">Không có câu hỏi nào theo bộ lọc đã chọn.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const q = item.question;
    const statusClass = item.isCorrect ? "review-correct" : "review-wrong";
    const statusBadge = item.isCorrect 
      ? `<span class="badge badge-success">Chính xác</span>`
      : (item.isAnswered ? `<span class="badge badge-danger">Làm sai</span>` : `<span class="badge badge-muted">Chưa làm</span>`);

    const diff = getQuestionDifficulty(q);
    const diffBadge = diff === "Dễ" 
      ? `<span class="badge badge-diff-easy">🟢 Dễ</span>` 
      : (diff === "Khó" ? `<span class="badge badge-diff-hard">🔴 Khó</span>` : `<span class="badge badge-diff-medium">🟡 Vừa</span>`);

    const noteKey = getQuestionNoteKey(AppState.session ? AppState.session.quizId : "", q, item.index);
    const personalNote = getQuestionNote(noteKey);

    return `
      <div class="review-item ${statusClass}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong style="color: var(--primary);">Câu hỏi ${item.index + 1}</strong>
            ${diffBadge}
          </div>
          ${statusBadge}
        </div>

        <h4 style="font-size: 1.05rem; font-weight: 600; line-height: 1.5; margin-bottom: 1rem;">
          ${escapeHtml(q.text)}
        </h4>

        ${q.image ? `<div class="question-image-container"><img src="${q.image}" class="question-img" onclick="openImageZoom(this.src)" title="Bấm để phóng to" alt="Hình ảnh câu hỏi" /></div>` : ''}

        <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
          ${q.options.map((opt, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            const isUserPick = item.userChoice === optIdx;
            const isAnswerKey = optIdx === q.correctIndex;

            let optStyle = "background: var(--bg-app); border: 1px solid var(--border-subtle);";
            if (isAnswerKey) {
              optStyle = "background: var(--success-light); border: 1.5px solid var(--success); color: var(--success); font-weight: 600;";
            } else if (isUserPick && !isAnswerKey) {
              optStyle = "background: var(--danger-light); border: 1.5px solid var(--danger); color: var(--danger); font-weight: 600;";
            }

            return `
              <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 1rem; border-radius: var(--radius-md); ${optStyle}">
                <strong style="width: 24px;">${letter}.</strong>
                <span style="flex: 1;">${escapeHtml(opt)}</span>
                ${isAnswerKey ? `<span>✔ Đáp án đúng</span>` : ''}
                ${isUserPick && !isAnswerKey ? `<span>✖ Lựa chọn của bạn</span>` : ''}
              </div>
            `;
          }).join("")}
        </div>

        ${q.explanation ? `
          <div style="background: var(--bg-muted); padding: 0.85rem 1.25rem; border-radius: var(--radius-md); font-size: 0.875rem; border-left: 3px solid var(--primary);">
            <strong style="color: var(--primary);">💡 Giải thích:</strong> ${escapeHtml(q.explanation)}
          </div>
        ` : ''}

        ${personalNote ? `
          <div class="review-sticky-note-box" style="margin-top: 0.75rem;">
            <div style="font-weight: 600; color: #d97706; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
              📝 Ghi chú cá nhân của bạn:
            </div>
            <div style="font-style: italic; color: var(--text-main); white-space: pre-wrap;">${escapeHtml(personalNote)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

// Retry only incorrect questions
function retryWrongQuestions() {
  const questions = AppState.session.questions;
  const answers = AppState.session.userAnswers;

  const wrongQuestions = questions.filter((q, idx) => answers[idx] !== q.correctIndex);
  if (wrongQuestions.length === 0) {
    showToast("Bạn đã làm đúng tất cả câu hỏi! Không có câu sai để ôn lại.", "success");
    return;
  }

  initRunnerSession({
    quizId: AppState.session.quizId,
    quizTitle: `${AppState.session.quizTitle} (Ôn Lại Câu Sai)`,
    category: AppState.session.category,
    mode: "PRACTICE", // Practice mode is ideal for learning from mistakes
    questions: wrongQuestions,
    durationMinutes: Math.max(5, Math.ceil(wrongQuestions.length * 1.5))
  });
}

// Retry whole quiz with same setup
function retryAllQuestions() {
  const origQuiz = AppState.quizzes.find(q => q.id === AppState.session.quizId);
  if (origQuiz) {
    openSetupModal(origQuiz.id, AppState.session.mode);
  } else {
    // If ad-hoc, just re-run session questions
    initRunnerSession({
      quizId: AppState.session.quizId,
      quizTitle: AppState.session.quizTitle,
      category: AppState.session.category,
      mode: AppState.session.mode,
      questions: AppState.session.questions,
      durationMinutes: 15
    });
  }
}

// =============================================================================
// 12. EXPORT & IMPORT DATA
// =============================================================================

function exportAllQuizzes() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState.quizzes, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `NovaQuiz_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Đã sao lưu tất cả đề thi về máy!", "success");
}

function exportSingleQuiz(quizId) {
  const quiz = AppState.quizzes.find(q => q.id === quizId);
  if (!quiz) return;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quiz, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${quiz.title.replace(/[^\w\s-]/gi, '_')}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast(`Đã xuất đề "${quiz.title}"!`, "success");
}

function openImageZoom(src) {
  const overlay = document.getElementById("image-zoom-overlay");
  const img = document.getElementById("image-zoom-img");
  if (overlay && img) {
    img.src = src;
    overlay.classList.add("open");
  }
}

function closeImageZoom() {
  const overlay = document.getElementById("image-zoom-overlay");
  if (overlay) overlay.classList.remove("open");
}

// --- WORD (.DOCX) EXPORT ENGINE ---

function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportQuizToDocx(quiz) {
  if (typeof JSZip === "undefined") {
    showToast("Thư viện JSZip chưa sẵn sàng!", "danger");
    return;
  }
  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    showToast("Đề thi không có câu hỏi để xuất Word!", "warning");
    return;
  }

  try {
    showToast("Đang tạo tệp Word (.docx)...", "info");
    const zip = new JSZip();

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

    let bodyXml = '';

    // Title
    bodyXml += `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="1E293B"/></w:rPr><w:t>${escapeXml(quiz.title || "ĐỀ THI TRẮC NGHIỆM")}</w:t></w:r>
    </w:p>`;

    // Subtitle
    bodyXml += `
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="280"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="8" w:color="94A3B8"/></w:pBdr></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>Chủ đề: ${escapeXml(quiz.category || "Tổng hợp")}  •  Thời gian: ${quiz.timeLimit || 15} phút  •  Số lượng: ${quiz.questions.length} câu</w:t></w:r>
    </w:p>`;

    // Questions
    quiz.questions.forEach((q, idx) => {
      bodyXml += `
      <w:p>
        <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="0F172A"/></w:rPr><w:t>Câu ${idx + 1}: ${escapeXml(q.text || "")}</w:t></w:r>
      </w:p>`;

      if (Array.isArray(q.options)) {
        q.options.forEach((opt, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          bodyXml += `
          <w:p>
            <w:pPr><w:ind w:left="400"/><w:spacing w:after="80"/></w:pPr>
            <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>${letter}. </w:t></w:r>
            <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(opt || "")}</w:t></w:r>
          </w:p>`;
        });
      }
    });

    // Answer Key Section
    bodyXml += `
    <w:p>
      <w:pPr><w:spacing w:before="400" w:after="200"/><w:pBdr><w:top w:val="double" w:sz="12" w:space="12" w:color="3B82F6"/></w:pBdr></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="2563EB"/></w:rPr><w:t>BẢNG ĐÁP ÁN &amp; HƯỚNG DẪN GIẢI CHI TIẾT</w:t></w:r>
    </w:p>`;

    bodyXml += `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0F172A"/></w:rPr><w:t>Câu</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:tcW w:w="1400" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0F172A"/></w:rPr><w:t>Đáp án</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/><w:tcW w:w="6000" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="0F172A"/></w:rPr><w:t>Giải thích chi tiết</w:t></w:r></w:p></w:tc>
      </w:tr>`;

    quiz.questions.forEach((q, idx) => {
      const correctLetter = String.fromCharCode(65 + (q.correctIndex || 0));
      const expl = q.explanation || "Đáp án chuẩn xác";
      bodyXml += `
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1200" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${idx + 1}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1400" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="16A34A"/></w:rPr><w:t>${correctLetter}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:tcW w:w="6000" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${escapeXml(expl)}</w:t></w:r></w:p></w:tc>
      </w:tr>`;
    });

    bodyXml += `</w:tbl>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const filename = `${(quiz.title || "De_Thi").replace(/[^\w\s-]/gi, '_')}.docx`;
    downloadBlob(blob, filename);
    showToast(`📄 Đã xuất tệp Word (.docx) thành công!`, "success");
  } catch (err) {
    console.error("Lỗi xuất Word:", err);
    showToast("Không thể tạo tệp Word: " + err.message, "danger");
  }
}

function exportQuizDocxById(quizId) {
  const quiz = AppState.quizzes.find(q => q.id === quizId);
  if (!quiz) {
    showToast("Không tìm thấy đề thi!", "danger");
    return;
  }
  exportQuizToDocx(quiz);
}

function exportCurrentResultDocx() {
  if (!AppState.session || !AppState.session.questions || AppState.session.questions.length === 0) {
    showToast("Không có kết quả bài thi hiện tại để xuất!", "warning");
    return;
  }
  const currentQuiz = {
    id: AppState.session.quizId || "KQ",
    title: AppState.session.quizTitle || "Bảng Điểm & Đề Thi",
    category: AppState.session.category || "Tổng hợp",
    timeLimit: Math.ceil(AppState.session.timeSpent / 60) || 15,
    questions: AppState.session.questions
  };
  exportQuizToDocx(currentQuiz);
}

// --- MULTI-CODE EXAM GENERATOR & MASTER MATRIX ENGINE ---

function openMultiCodeModal(quizId) {
  const quiz = AppState.quizzes.find(q => q.id === quizId);
  if (!quiz) {
    showToast("Không tìm thấy đề thi!", "danger");
    return;
  }
  AppState.activeMultiCodeQuiz = quiz;
  const titleEl = document.getElementById("multi-code-modal-title");
  if (titleEl) {
    titleEl.textContent = `Trộn Đề Thi: ${quiz.title}`;
  }
  updateMultiCodePreviewBadges();
  const modal = document.getElementById("modal-multi-code");
  if (modal) modal.classList.add("open");
}

function closeMultiCodeModal() {
  const modal = document.getElementById("modal-multi-code");
  if (modal) modal.classList.remove("open");
}

function updateMultiCodePreviewBadges() {
  const countSelect = document.getElementById("select-multicode-count");
  const startInput = document.getElementById("input-multicode-start");
  const badgeContainer = document.getElementById("multicode-badge-list");
  if (!badgeContainer) return;

  const count = parseInt(countSelect?.value || "4", 10);
  const startCode = parseInt(startInput?.value || "101", 10);

  let html = "";
  for (let i = 0; i < count; i++) {
    const code = startCode + i;
    html += `<span class="multicode-variant-tag">Mã ${code}</span>`;
  }
  badgeContainer.innerHTML = html;
}

function generateMultiCodeVariants(quiz, count, startCode, shuffleQ, shuffleOpts) {
  const variants = [];
  const baseQuestions = quiz.questions || [];

  for (let i = 0; i < count; i++) {
    const code = startCode + i;
    let variantQuestions = baseQuestions.map((q, origIdx) => {
      let options = Array.isArray(q.options) ? [...q.options] : [];
      let correctIndex = q.correctIndex !== undefined ? q.correctIndex : 0;

      if (shuffleOpts && options.length > 1) {
        const paired = options.map((opt, oIdx) => ({ opt, isCorrect: oIdx === correctIndex }));
        const shuffledPairs = shuffleArray(paired);
        options = shuffledPairs.map(p => p.opt);
        correctIndex = shuffledPairs.findIndex(p => p.isCorrect);
      }

      return {
        ...q,
        id: `q_${code}_${origIdx + 1}_${Date.now()}`,
        originalIndex: origIdx,
        text: q.text,
        options,
        correctIndex,
        explanation: q.explanation || ""
      };
    });

    if (shuffleQ && variantQuestions.length > 1) {
      variantQuestions = shuffleArray(variantQuestions);
    }

    variants.push({
      code,
      title: `${quiz.title} - Mã đề ${code}`,
      questions: variantQuestions
    });
  }

  return variants;
}

function saveMultiCodeToLibrary() {
  const quiz = AppState.activeMultiCodeQuiz;
  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    showToast("Không có câu hỏi để tạo mã đề!", "warning");
    return;
  }

  const count = parseInt(document.getElementById("select-multicode-count")?.value || "4", 10);
  const startCode = parseInt(document.getElementById("input-multicode-start")?.value || "101", 10);
  const shuffleQ = document.getElementById("multicode-opt-shuffle-q")?.checked ?? true;
  const shuffleOpts = document.getElementById("multicode-opt-shuffle-opts")?.checked ?? true;

  const variants = generateMultiCodeVariants(quiz, count, startCode, shuffleQ, shuffleOpts);

  variants.forEach((v) => {
    const newQuiz = {
      id: `quiz_var_${Date.now()}_${v.code}_${Math.random().toString(36).substr(2, 4)}`,
      title: `${quiz.title} (Mã ${v.code})`,
      category: quiz.category || "Chung",
      timeLimit: quiz.timeLimit || 15,
      questions: v.questions,
      createdAt: new Date().toISOString()
    };
    AppState.quizzes.unshift(newQuiz);
  });

  saveQuizzes();
  renderDashboard();
  closeMultiCodeModal();
  showToast(`🎉 Đã tạo và lưu thành công ${count} mã đề thi vào Thư viện!`, "success");
}

async function exportMultiCodeDocx() {
  if (typeof JSZip === "undefined") {
    showToast("Thư viện JSZip chưa sẵn sàng!", "danger");
    return;
  }
  const quiz = AppState.activeMultiCodeQuiz;
  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    showToast("Không có câu hỏi để tạo mã đề!", "warning");
    return;
  }

  const count = parseInt(document.getElementById("select-multicode-count")?.value || "4", 10);
  const startCode = parseInt(document.getElementById("input-multicode-start")?.value || "101", 10);
  const shuffleQ = document.getElementById("multicode-opt-shuffle-q")?.checked ?? true;
  const shuffleOpts = document.getElementById("multicode-opt-shuffle-opts")?.checked ?? true;

  try {
    showToast(`Đang tạo tệp Word gồm ${count} mã đề & ma trận đáp án...`, "info");
    const variants = generateMultiCodeVariants(quiz, count, startCode, shuffleQ, shuffleOpts);

    const zip = new JSZip();

    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

    let bodyXml = '';

    variants.forEach((v, vIdx) => {
      // If not the first variant, add page break
      if (vIdx > 0) {
        bodyXml += `
        <w:p>
          <w:r><w:br w:type="page"/></w:r>
        </w:p>`;
      }

      // Exam Header
      bodyXml += `
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:after="100"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1E293B"/></w:rPr><w:t>${escapeXml(v.title.toUpperCase())}</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>
        <w:r><w:rPr><w:i/><w:sz w:val="21"/><w:color w:val="475569"/></w:rPr><w:t>Môn: ${escapeXml(quiz.category || "Tổng hợp")}  •  Thời gian: ${quiz.timeLimit || 15} phút  •  Số câu hỏi: ${v.questions.length} câu</w:t></w:r>
      </w:p>
      <w:p>
        <w:pPr><w:spacing w:after="240"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="8" w:color="94A3B8"/></w:pBdr></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>Họ và tên thí sinh: ............................................................................ SBD: ......................  </w:t></w:r>
        <w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="2563EB"/></w:rPr><w:t>[ MÃ ĐỀ: ${v.code} ]</w:t></w:r>
      </w:p>`;

      // Questions for this variant
      v.questions.forEach((q, qIdx) => {
        bodyXml += `
        <w:p>
          <w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr>
          <w:r><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="0F172A"/></w:rPr><w:t>Câu ${qIdx + 1}: </w:t></w:r>
          <w:r><w:rPr><w:sz w:val="23"/><w:color w:val="0F172A"/></w:rPr><w:t>${escapeXml(q.text || "")}</w:t></w:r>
        </w:p>`;

        if (Array.isArray(q.options)) {
          q.options.forEach((opt, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            bodyXml += `
            <w:p>
              <w:pPr><w:ind w:left="400"/><w:spacing w:after="60"/></w:pPr>
              <w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>${letter}. </w:t></w:r>
              <w:r><w:rPr><w:sz w:val="22"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(opt || "")}</w:t></w:r>
            </w:p>`;
          });
        }
      });
    });

    // Master Answer Key Matrix Section (on a fresh page)
    bodyXml += `
    <w:p>
      <w:r><w:br w:type="page"/></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="200" w:after="160"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="2563EB"/></w:rPr><w:t>BẢNG TỔNG HỢP MA TRẬN ĐÁP ÁN CÁC MÃ ĐỀ</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:after="280"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>Dùng đối chiếu nhanh khi chấm thi trắc nghiệm (${variants.map(v => "Mã " + v.code).join(" - ")})</w:t></w:r>
    </w:p>`;

    // Table
    const totalQ = variants[0].questions.length;
    const colCount = variants.length + 1; // 1 for "Câu" + N codes
    const colPct = Math.floor(5000 / colCount);

    bodyXml += `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="3B82F6"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="3B82F6"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="3B82F6"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="3B82F6"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="2563EB"/><w:tcW w:w="${colPct}" w:type="pct"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Câu</w:t></w:r></w:p></w:tc>`;

    variants.forEach(v => {
      bodyXml += `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="2563EB"/><w:tcW w:w="${colPct}" w:type="pct"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Mã ${v.code}</w:t></w:r></w:p></w:tc>`;
    });

    bodyXml += `</w:tr>`;

    for (let qIdx = 0; qIdx < totalQ; qIdx++) {
      const bg = qIdx % 2 === 1 ? ' fill="F8FAFC"' : '';
      bodyXml += `<w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto"${bg}/><w:tcW w:w="${colPct}" w:type="pct"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="1E293B"/></w:rPr><w:t>${qIdx + 1}</w:t></w:r></w:p></w:tc>`;

      variants.forEach(v => {
        const q = v.questions[qIdx];
        const correctLetter = q ? String.fromCharCode(65 + (q.correctIndex || 0)) : "-";
        bodyXml += `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto"${bg}/><w:tcW w:w="${colPct}" w:type="pct"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="16A34A"/></w:rPr><w:t>${correctLetter}</w:t></w:r></w:p></w:tc>`;
      });

      bodyXml += `</w:tr>`;
    }

    bodyXml += `</w:tbl>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    zip.file('word/document.xml', documentXml);

    const blob = await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const safeTitle = (quiz.title || "Bo_Ma_De").replace(/[^\w\s-]/gi, '_');
    const filename = `${safeTitle}_Cac_Ma_De_${startCode}_den_${startCode + count - 1}.docx`;
    downloadBlob(blob, filename);
    showToast(`📄 Đã xuất bộ ${count} mã đề kèm ma trận đáp án Word thành công!`, "success");
    closeMultiCodeModal();
  } catch (err) {
    console.error("Lỗi xuất Word nhiều mã đề:", err);
    showToast("Không thể tạo tệp Word: " + err.message, "danger");
  }
}

// --- PWA INSTALLATION HELPER ---

function initPwaInstall() {
  const btnInstall = document.getElementById("btn-install-pwa");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    AppState.deferredPrompt = e;
    if (btnInstall) {
      btnInstall.style.display = "inline-flex";
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener("click", async () => {
      if (AppState.deferredPrompt) {
        AppState.deferredPrompt.prompt();
        const choice = await AppState.deferredPrompt.userChoice;
        if (choice && choice.outcome === "accepted") {
          showToast("🎉 Đang cài đặt ứng dụng NovaQuiz...", "success");
        }
        AppState.deferredPrompt = null;
        btnInstall.style.display = "none";
      } else {
        showToast("Để cài đặt trên Chrome/Edge: bấm vào biểu tượng Cài đặt trên thanh địa chỉ trình duyệt!", "info");
      }
    });
  }

  window.addEventListener("appinstalled", () => {
    showToast("✨ NovaQuiz đã được cài đặt thành công!", "success");
    if (btnInstall) btnInstall.style.display = "none";
    AppState.deferredPrompt = null;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js?v=4.0.0")
        .then(reg => console.log("Service Worker đăng ký thành công:", reg.scope))
        .catch(err => console.log("Lỗi đăng ký Service Worker:", err));
    });
  }
}

// --- LEARNING ANALYTICS & PROGRESS ENGINE ---

function getQuizHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveQuizHistory(record) {
  try {
    const history = getQuizHistory();
    history.unshift(record);
    if (history.length > 100) history.pop();
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch (e) {
    console.error("Lỗi lưu lịch sử", e);
  }
}

function clearQuizHistory() {
  if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử thi và thống kê không?")) {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    renderAnalyticsModal();
    showToast("Đã xóa sạch lịch sử thi!", "info");
  }
}

function drawAnalyticsChart(history) {
  const canvas = document.getElementById("analytics-chart-canvas");
  const emptyNotice = document.getElementById("analytics-chart-empty");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!history || history.length === 0) {
    if (emptyNotice) emptyNotice.style.display = "block";
    return;
  }
  if (emptyNotice) emptyNotice.style.display = "none";

  const data = [...history].slice(0, 12).reverse();
  if (data.length === 1) {
    data.push({ ...data[0] });
  }

  const padLeft = 45;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 35;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const lineColor = "#3b82f6";

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = "11px Inter, sans-serif";
  ctx.fillStyle = textColor;

  const ySteps = [0, 2.5, 5, 7.5, 10];
  ySteps.forEach(val => {
    const y = padTop + chartH - (val / 10) * chartH;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    ctx.fillText(`${val}`, padLeft - 8, y);
  });

  const points = data.map((item, idx) => {
    const score = Math.max(0, Math.min(10, item.score10 !== undefined ? item.score10 : (item.percent / 10)));
    const x = padLeft + (idx / (data.length - 1)) * chartW;
    const y = padTop + chartH - (score / 10) * chartH;
    return { x, y, score, percent: item.percent, title: item.quizTitle };
  });

  const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  grad.addColorStop(0, isDark ? "rgba(59, 130, 246, 0.35)" : "rgba(59, 130, 246, 0.2)");
  grad.addColorStop(1, "rgba(59, 130, 246, 0.0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, padTop + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padTop + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  points.forEach((p, idx) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? "#1e293b" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    ctx.fillStyle = isDark ? "#f1f5f9" : "#0f172a";
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${p.score}`, p.x, p.y - 8);

    ctx.fillStyle = textColor;
    ctx.font = "10px Inter, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`#${idx + 1}`, p.x, padTop + chartH + 8);
  });
}

function renderAnalyticsModal() {
  const history = getQuizHistory();

  const totalTestsEl = document.getElementById("kpi-total-tests");
  const avgScoreEl = document.getElementById("kpi-avg-score");
  const bestScoreEl = document.getElementById("kpi-best-score");
  const totalTimeEl = document.getElementById("kpi-total-time");
  const historyListEl = document.getElementById("analytics-history-list");

  const totalCount = history.length;
  if (totalCount === 0) {
    if (totalTestsEl) totalTestsEl.textContent = "0";
    if (avgScoreEl) avgScoreEl.textContent = "0%";
    if (bestScoreEl) bestScoreEl.textContent = "0%";
    if (totalTimeEl) totalTimeEl.textContent = "0 phút";
    if (historyListEl) {
      historyListEl.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.9rem;">
          Chưa có lượt làm bài nào được lưu. Hãy thử làm một bài thi hoặc ôn tập để theo dõi tiến độ!
        </div>
      `;
    }
    drawAnalyticsChart([]);
    return;
  }

  const sumPercent = history.reduce((acc, h) => acc + (h.percent || 0), 0);
  const avgPercent = Math.round(sumPercent / totalCount);
  const bestPercent = Math.max(...history.map(h => h.percent || 0));
  const totalSeconds = history.reduce((acc, h) => acc + (h.timeSpent || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  if (totalTestsEl) totalTestsEl.textContent = `${totalCount}`;
  if (avgScoreEl) avgScoreEl.textContent = `${avgPercent}%`;
  if (bestScoreEl) bestScoreEl.textContent = `${bestPercent}%`;
  if (totalTimeEl) totalTimeEl.textContent = `${totalMinutes} phút`;

  drawAnalyticsChart(history);

  if (historyListEl) {
    historyListEl.innerHTML = history.slice(0, 30).map(item => {
      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString("vi-VN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }) : "Vừa xong";
      const isPass = (item.percent || 0) >= 50;
      const badgeClass = item.mode === "EXAM" ? "badge-warning" : "badge-primary";
      const modeLabel = item.mode === "EXAM" ? "Thi thử" : (item.mode === "FLASHCARD" ? "Flashcard" : "Ôn tập");

      return `
        <div class="analytics-history-row" style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-subtle); gap: 0.75rem;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
              <span class="badge ${badgeClass}" style="font-size: 0.7rem; padding: 0.15rem 0.45rem;">${modeLabel}</span>
              <strong style="font-size: 0.925rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.quizTitle)}</strong>
            </div>
            <div style="font-size: 0.775rem; color: var(--text-muted);">
              ${dateStr} • Đúng: ${item.correctCount || 0}/${item.total || 0} câu • Thời gian: ${Math.floor((item.timeSpent || 0) / 60)}p${(item.timeSpent || 0) % 60}s
            </div>
          </div>
          <div style="text-align: right; min-width: 75px;">
            <div style="font-weight: 800; font-size: 1.1rem; color: ${isPass ? 'var(--success)' : 'var(--danger)'};">
              ${item.score10 !== undefined ? item.score10 : ((item.percent / 10).toFixed(1))}/10
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
              ${item.percent}%
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
}

function openAnalyticsModal() {
  renderAnalyticsModal();
  const modal = document.getElementById("modal-analytics");
  if (modal) modal.classList.add("open");
}

function closeAnalyticsModal() {
  const modal = document.getElementById("modal-analytics");
  if (modal) modal.classList.remove("open");
}

function openShortcutsModal() {
  const modal = document.getElementById("modal-shortcuts");
  const toggle = document.getElementById("toggle-shortcuts-enabled");
  if (toggle) toggle.checked = isShortcutsEnabled();
  if (modal) modal.classList.add("open");
}

function closeShortcutsModal() {
  const modal = document.getElementById("modal-shortcuts");
  if (modal) modal.classList.remove("open");
}

// =============================================================================
// 12B. LIQUID GLASS 3.0 INTERACTIVE ENGINE (Spotlight & Liquid Ripple)
// =============================================================================

function initLiquidGlassInteractions() {
  // 1. Dynamic Cursor Spotlight Lighting:
  // Tracks mouse position across glass cards and panels to cast specular light reflections
  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest(
      ".quiz-card, .question-card-main, .hero-banner, .mode-card, .creator-card, .upload-dropzone, .palette-sidebar, .result-card-header"
    );
    if (card) {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty("--mouse-x", `${x.toFixed(2)}%`);
      card.style.setProperty("--mouse-y", `${y.toFixed(2)}%`);
    }
  });

  // 2. Liquid Click Ripple & Radiant Flash:
  // Dynamically injects an expanding iridescent light wave upon clicking buttons and options
  document.addEventListener("click", (e) => {
    const target = e.target.closest(
      ".btn, .option-btn, .filter-chip, .palette-cell, .mode-card, .creator-tab, .btn-delete-card, .btn-flag"
    );
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "liquid-ripple";

    const size = Math.max(rect.width, rect.height) * 1.8;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    // Ensure parent has relative/absolute positioning
    const currentPos = window.getComputedStyle(target).position;
    if (currentPos === "static") {
      target.style.position = "relative";
    }

    target.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
}

// =============================================================================
// 13. GLOBAL EVENT LISTENERS & SETUP
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Theme, Liquid Glass Interactions & Load Quizzes
  initTheme();
  initLiquidGlassInteractions();
  loadQuizzes();
  renderDashboard();
  setupAiImageOcr();

  // 2. Navigation & Theme
  document.getElementById("btn-nav-home").addEventListener("click", () => switchView("view-dashboard"));
  document.getElementById("btn-theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("btn-open-create").addEventListener("click", () => openCreator());
  document.getElementById("btn-hero-create").addEventListener("click", () => openCreator());
  document.getElementById("btn-back-from-creator").addEventListener("click", () => switchView("view-dashboard"));
  document.getElementById("btn-cancel-creator").addEventListener("click", () => switchView("view-dashboard"));
  document.getElementById("btn-result-to-home").addEventListener("click", () => switchView("view-dashboard"));

  // 3. Search & Category Filters
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      AppState.searchQuery = e.target.value;
      renderDashboard();
    });
  }

  const categoryFilters = document.getElementById("category-filters");
  if (categoryFilters) {
    categoryFilters.addEventListener("click", (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      if (chip.id === "btn-open-mistake-vault" || chip.id === "btn-open-analytics") {
        return;
      }
      categoryFilters.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      AppState.activeFilter = chip.getAttribute("data-category") || "ALL";
      renderDashboard();
    });
  }

  // 4. Backup & Restore JSON & Xóa tất cả đề
  document.getElementById("btn-export-all").addEventListener("click", exportAllQuizzes);
  const importInput = document.getElementById("input-import-json");
  document.getElementById("btn-import-all").addEventListener("click", () => {
    importInput.value = "";
    importInput.click();
  });
  importInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  const btnDeleteAll = document.getElementById("btn-delete-all-quizzes");
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener("click", deleteAllQuizzes);
  }

  // 5. Creator Tabs
  document.querySelectorAll(".creator-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".creator-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-pane").forEach(p => p.style.display = "none");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.style.display = "block";
    });
  });

  // Smart Paste input listener
  const smartTextarea = document.getElementById("smart-text-input");
  if (smartTextarea) {
    smartTextarea.addEventListener("input", updateSmartParsePreview);
    smartTextarea.addEventListener("paste", () => setTimeout(updateSmartParsePreview, 50));
  }

  // Nút xóa trắng văn bản trong Creator
  const btnClearSmartText = document.getElementById("btn-clear-smart-text");
  if (btnClearSmartText) {
    btnClearSmartText.addEventListener("click", clearSmartTextInput);
  }

  // Insert sample text button
  const insertSampleBtn = document.getElementById("btn-insert-sample-text");
  if (insertSampleBtn) {
    insertSampleBtn.addEventListener("click", () => {
      smartTextarea.value = `Câu 1: World Wide Web (WWW) được phát minh bởi ai?
*A. Tim Berners-Lee
B. Bill Gates
C. Steve Jobs
D. Alan Turing
Giải thích: Tim Berners-Lee phát minh ra World Wide Web vào năm 1989 tại viện CERN.

Câu 2: Đơn vị cơ bản nhất để đo lượng thông tin trong máy tính là gì?
A. Byte
B. Bit
C. Kilobyte
D. Hertz
Đáp án: B
Giải thích: Bit (viết tắt của Binary Digit) là đơn vị nhỏ nhất đo lường thông tin nhị phân (0 hoặc 1).

Câu 3: Đâu là cổng kết nối phổ biến dùng để truyền cả âm thanh và hình ảnh độ nét cao?
A. VGA
B. DVI
C. HDMI
D. USB Type-A
Đáp án: C
Giải thích: HDMI (High-Definition Multimedia Interface) truyền tải cả video và âm thanh kỹ thuật số đồng thời.`;
      updateSmartParsePreview();
      showToast("Đã chèn 3 câu hỏi mẫu vào khung soạn thảo!", "success");
    });
  }

  // Toggle detail preview list
  const togglePreviewBtn = document.getElementById("btn-toggle-parsed-preview");
  if (togglePreviewBtn) {
    togglePreviewBtn.addEventListener("click", () => {
      const container = document.getElementById("parsed-preview-container");
      const isVisible = container.style.display !== "none";
      container.style.display = isVisible ? "none" : "block";
      togglePreviewBtn.textContent = isVisible 
        ? "Xem chi tiết các câu đã phân tích" 
        : "Ẩn danh sách câu phân tích";
      if (!isVisible) {
        const parsed = parseRawQuestions(smartTextarea.value);
        renderParsedQuestionsList(parsed.questions);
      }
    });
  }

  // File dropzone in creator
  const dropzone = document.getElementById("upload-dropzone");
  const fileUploader = document.getElementById("file-uploader");
  if (dropzone && fileUploader) {
    dropzone.addEventListener("click", () => fileUploader.click());
    fileUploader.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
      }
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });
  }

  // Load sample docx button (Hỗ trợ file có hình ảnh và câu hỏi không có A,B,C,D)
  const btnLoadSampleDocx = document.getElementById("btn-load-sample-docx");
  if (btnLoadSampleDocx) {
    btnLoadSampleDocx.addEventListener("click", async (e) => {
      e.stopPropagation(); // Stop opening file picker
      try {
        const targetFile = "de_thi_co_anh_va_khong_abcd.docx";
        const resp = await fetch(targetFile);
        if (!resp.ok) throw new Error("File not found");
        const blob = await resp.blob();
        parseDocxFile(blob, targetFile);
      } catch (err) {
        showToast("Không tìm thấy file mẫu trên máy chủ!", "danger");
      }
    });
  }

  // ✍️ Nút Sửa lỗi chính tả & OCR (Giữ nguyên đáp án) trên thanh công cụ
  const btnQuickFixSpelling = document.getElementById("btn-quick-fix-spelling");
  if (btnQuickFixSpelling) {
    btnQuickFixSpelling.addEventListener("click", () => {
      const textarea = document.getElementById("smart-text-input");
      if (!textarea || !textarea.value.trim()) {
        showToast("Vui lòng dán nội dung đề thi vào khung văn bản trước khi sửa chính tả!", "warning");
        return;
      }
      const before = textarea.value;
      const cleaned = fixSpellingAndFormattingKeepAnswers(before);
      textarea.value = cleaned;
      updateSmartParsePreview();
      showToast("✓ Đã sửa sạch toàn bộ lỗi chính tả & định dạng OCR mà không thay đổi bất kỳ đáp án nào!", "success");
    });
  }

  // Nút Sửa chính tả tất cả câu hỏi trong Tab Soạn Thảo Thủ Công (Tab 3)
  const btnFixSpellingManualAll = document.getElementById("btn-fix-spelling-manual-all");
  if (btnFixSpellingManualAll) {
    btnFixSpellingManualAll.addEventListener("click", fixSpellingManualQuestionsAll);
  }

  // Nút Soát & Sửa Câu Sai Bằng AI trên thanh công cụ
  const btnQuickAudit = document.getElementById("btn-quick-audit-wrong");
  const selectModel = document.getElementById("select-gemini-model");
  const modelBadge = document.getElementById("gemini-model-badge-info");
  const containerCustomModel = document.getElementById("container-custom-gemini-model");
  const inputCustomModel = document.getElementById("input-custom-gemini-model");

  if (selectModel) {
    selectModel.addEventListener("change", () => {
      const val = selectModel.value;
      if (val === "custom") {
        if (containerCustomModel) containerCustomModel.style.display = "block";
        if (inputCustomModel) {
          const customVal = inputCustomModel.value.trim() || getSavedGeminiCustomModel() || "gemini-3.8-flash";
          inputCustomModel.value = customVal;
          inputCustomModel.focus();
          activeGeminiModel = customVal;
          setSavedGeminiModel(customVal);
          if (modelBadge) modelBadge.textContent = `Đang chọn: ${customVal}`;
        }
      } else {
        if (containerCustomModel) containerCustomModel.style.display = "none";
        if (val && val !== "auto") {
          activeGeminiModel = val;
          setSavedGeminiModel(val);
          if (modelBadge) modelBadge.textContent = `Đang chọn: ${val}`;
          showToast(`Đã chuyển sang mô hình: ${val}`, "info");
        } else {
          activeGeminiModel = "gemini-3.8-flash";
          setSavedGeminiModel("gemini-3.8-flash");
          if (modelBadge) modelBadge.textContent = "Tự động chọn (Ưu tiên Gemini 3.8 Flash / 3.5 Flash-Lite)";
        }
      }
    });
  }

  if (inputCustomModel) {
    inputCustomModel.addEventListener("input", () => {
      const customVal = inputCustomModel.value.trim();
      if (customVal) {
        activeGeminiModel = customVal;
        setSavedGeminiModel(customVal);
        setSavedGeminiCustomModel(customVal);
        if (modelBadge) modelBadge.textContent = `Đang chọn: ${customVal}`;
      }
    });
  }

  if (btnQuickAudit) {
    btnQuickAudit.addEventListener("click", () => {
      const textarea = document.getElementById("smart-text-input");
      if (!textarea || !textarea.value.trim()) {
        showToast("Vui lòng dán đề thi vào khung văn bản trước khi soát câu sai!", "warning");
        return;
      }

      const savedKey = getSavedGeminiKey();
      if (inputGeminiKey) inputGeminiKey.value = savedKey;

      let savedModel = getSavedGeminiModel();
      if (selectModel) {
        if (Array.from(selectModel.options).some(o => o.value === savedModel)) {
          selectModel.value = savedModel;
          if (containerCustomModel) containerCustomModel.style.display = "none";
        } else if (savedModel === "auto") {
          selectModel.value = "auto";
          if (containerCustomModel) containerCustomModel.style.display = "none";
        } else {
          selectModel.value = "custom";
          if (containerCustomModel) containerCustomModel.style.display = "block";
          if (inputCustomModel) inputCustomModel.value = savedModel;
        }
        if (modelBadge) modelBadge.textContent = `Đang chọn: ${savedModel}`;
      }

      const auditRadio = document.querySelector('input[name="ai-task"][value="audit-correct"]');
      if (auditRadio) auditRadio.checked = true;

      if (modalGemini) modalGemini.classList.add("open");
    });
  }

  // AI Gemini Modal & Handler
  const btnOpenGemini = document.getElementById("btn-open-gemini-modal");
  const modalGemini = document.getElementById("modal-ai-gemini");
  const inputGeminiKey = document.getElementById("input-gemini-api-key");
  if (btnOpenGemini && modalGemini) {
    btnOpenGemini.addEventListener("click", () => {
      const savedKey = getSavedGeminiKey();
      if (inputGeminiKey) inputGeminiKey.value = savedKey;

      let savedModel = getSavedGeminiModel();
      if (selectModel) {
        if (Array.from(selectModel.options).some(o => o.value === savedModel)) {
          selectModel.value = savedModel;
          if (containerCustomModel) containerCustomModel.style.display = "none";
        } else if (savedModel === "auto") {
          selectModel.value = "auto";
          if (containerCustomModel) containerCustomModel.style.display = "none";
        } else {
          selectModel.value = "custom";
          if (containerCustomModel) containerCustomModel.style.display = "block";
          if (inputCustomModel) inputCustomModel.value = savedModel;
        }
        if (modelBadge) modelBadge.textContent = `Đang chọn: ${savedModel}`;
      }

      modalGemini.classList.add("open");
    });
  }

  const btnCloseGemini = document.getElementById("btn-close-gemini-modal");
  const btnCancelGemini = document.getElementById("btn-cancel-gemini");
  if (btnCloseGemini) btnCloseGemini.addEventListener("click", () => modalGemini.classList.remove("open"));
  if (btnCancelGemini) btnCancelGemini.addEventListener("click", () => modalGemini.classList.remove("open"));

  // Nút kiểm tra API Key
  const btnTestKey = document.getElementById("btn-test-gemini-key");
  if (btnTestKey) {
    btnTestKey.addEventListener("click", () => {
      testGeminiApiKey(inputGeminiKey ? inputGeminiKey.value : "");
    });
  }

  const btnUseOfflineAiModal = document.getElementById("btn-use-offline-ai-modal");
  if (btnUseOfflineAiModal) {
    btnUseOfflineAiModal.addEventListener("click", () => {
      const textarea = document.getElementById("smart-text-input");
      if (!textarea || !textarea.value.trim()) {
        showToast("Chưa có nội dung đề thi trong khung văn bản!", "warning");
        return;
      }
      const beforeText = textarea.value;
      const selectedTask = document.querySelector('input[name="ai-task"]:checked')?.value || "fix-spelling-only";

      if (selectedTask === "fix-spelling-only") {
        const cleaned = fixSpellingAndFormattingKeepAnswers(beforeText);
        textarea.value = cleaned;
        updateSmartParsePreview();
        modalGemini.classList.remove("open");
        showToast("✓ Đã sửa sạch toàn bộ lỗi chính tả & định dạng OCR mà không thay đổi bất kỳ đáp án nào!", "success");
      } else {
        const auditResult = offlineAuditAndFixExam(textarea.value);
        textarea.value = auditResult.cleanedText;
        updateSmartParsePreview();
        modalGemini.classList.remove("open");
        processAndShowAiAuditDiff(beforeText, auditResult.cleanedText);
      }
    });
  }

  const btnExecuteGemini = document.getElementById("btn-execute-gemini");
  if (btnExecuteGemini) {
    btnExecuteGemini.addEventListener("click", async () => {
      const textarea = document.getElementById("smart-text-input");
      if (!textarea || !textarea.value.trim()) {
        showToast("Chưa có nội dung đề thi trong khung văn bản!", "danger");
        return;
      }

      const beforeText = textarea.value;
      const key = inputGeminiKey ? inputGeminiKey.value.trim() : "";
      const selectedTask = document.querySelector('input[name="ai-task"]:checked')?.value || "fix-spelling-only";

      if (!key) {
        if (selectedTask === "fix-spelling-only") {
          showToast("Chưa có Gemini Key! Hệ thống chuyển sang Sửa chính tả & OCR Offline siêu tốc...", "info");
          const cleaned = fixSpellingAndFormattingKeepAnswers(textarea.value);
          textarea.value = cleaned;
          updateSmartParsePreview();
          modalGemini.classList.remove("open");
          showToast("✓ Đã sửa sạch toàn bộ lỗi chính tả & định dạng OCR mà không thay đổi bất kỳ đáp án nào!", "success");
          return;
        } else {
          showToast("Bạn chưa nhập Gemini Key! Hệ thống kích hoạt bộ lọc & rà soát AI Offline...", "warning");
          const auditResult = offlineAuditAndFixExam(textarea.value);
          textarea.value = auditResult.cleanedText;
          updateSmartParsePreview();
          modalGemini.classList.remove("open");
          processAndShowAiAuditDiff(beforeText, auditResult.cleanedText);
          return;
        }
      }
      setSavedGeminiKey(key);

      let modelChoice = selectModel ? selectModel.value : "gemini-3.8-flash";
      if (modelChoice === "custom") {
        modelChoice = (inputCustomModel ? inputCustomModel.value.trim() : "") || "gemini-3.8-flash";
      } else if (modelChoice === "auto") {
        modelChoice = "gemini-3.8-flash";
      }

      if (modelChoice.includes("1.5") || modelChoice.includes("2.0") || modelChoice.includes("2.5") || modelChoice.includes("1.0") || modelChoice.includes("interactions") || modelChoice.includes("tts") || modelChoice.includes("8b")) {
        modelChoice = "gemini-3.8-flash";
      }

      activeGeminiModel = modelChoice;
      setSavedGeminiModel(modelChoice);
      if (modelBadge) modelBadge.textContent = `Đang chọn: ${modelChoice}`;

      const loadingEl = document.getElementById("ai-loading-indicator");
      if (loadingEl) loadingEl.style.display = "block";
      btnExecuteGemini.disabled = true;

      try {
        const enhancedText = await callGeminiAiEnhancer(textarea.value, key, selectedTask);
        textarea.value = enhancedText;
        updateSmartParsePreview();
        modalGemini.classList.remove("open");
        if (selectedTask === "audit-correct" || selectedTask === "full-solve") {
          processAndShowAiAuditDiff(beforeText, enhancedText);
        } else if (selectedTask === "fix-spelling-only") {
          showToast("✓ AI Gemini đã sửa sạch lỗi chính tả & làm đẹp đề thi mà vẫn giữ nguyên 100% đáp án!", "success");
        } else {
          showToast("AI Gemini đã hoàn tất xử lý đề thi!", "success");
        }
      } catch (err) {
        console.error("Gemini Error:", err);
        showToast(`Lỗi AI Gemini: ${err.message}`, "danger");
      } finally {
        if (loadingEl) loadingEl.style.display = "none";
        btnExecuteGemini.disabled = false;
      }
    });
  }

  // AI Tutor For Wrong Questions Listeners
  const btnAiTutor = document.getElementById("btn-ai-tutor-wrongs");
  const btnAiTutorSub = document.getElementById("btn-ai-tutor-wrongs-sub");
  if (btnAiTutor) btnAiTutor.addEventListener("click", openAiTutorForWrongQuestions);
  if (btnAiTutorSub) btnAiTutorSub.addEventListener("click", openAiTutorForWrongQuestions);

  const modalAiTutor = document.getElementById("modal-ai-tutor");
  const btnCloseAiTutor = document.getElementById("btn-close-ai-tutor");
  const btnCloseAiTutorFooter = document.getElementById("btn-close-ai-tutor-footer");
  if (btnCloseAiTutor && modalAiTutor) btnCloseAiTutor.addEventListener("click", () => modalAiTutor.classList.remove("open"));
  if (btnCloseAiTutorFooter && modalAiTutor) btnCloseAiTutorFooter.addEventListener("click", () => modalAiTutor.classList.remove("open"));

  // Separate Answers Modal Listeners
  const modalSeparateAnswers = document.getElementById("modal-separate-answers");
  const btnOpenSeparateAnswers = document.getElementById("btn-open-separate-answers");
  const btnOpenSeparateAnswersTab2 = document.getElementById("btn-open-separate-answers-tab2");
  const btnCloseSeparateAnswers = document.getElementById("btn-close-separate-answers");
  const btnCancelSeparateAnswers = document.getElementById("btn-cancel-separate-answers");
  const textareaSeparateAnswers = document.getElementById("textarea-separate-answers");
  const statusSeparateAnswers = document.getElementById("separate-answers-status");
  const badgeSeparateAnswers = document.getElementById("separate-answers-preview-badge");
  const btnClearSeparateAnswers = document.getElementById("btn-clear-separate-answers");
  const btnUploadSeparateAnswersFile = document.getElementById("btn-upload-separate-answers-file");
  const inputSeparateAnswersFile = document.getElementById("input-separate-answers-file");
  const btnApplySeparateAnswers = document.getElementById("btn-apply-separate-answers");

  function updateSeparateAnswersBadge() {
    if (!textareaSeparateAnswers || !badgeSeparateAnswers || !statusSeparateAnswers) return;
    const text = textareaSeparateAnswers.value.trim();
    if (!text) {
      statusSeparateAnswers.textContent = "Chưa nhập đáp án";
      statusSeparateAnswers.style.color = "var(--text-muted)";
      badgeSeparateAnswers.style.display = "none";
      return;
    }
    const answerMap = parseAnswerKeyText(text);
    if (answerMap.size > 0) {
      statusSeparateAnswers.textContent = `Đã tìm thấy ${answerMap.size} đáp án`;
      statusSeparateAnswers.style.color = "var(--success)";
      
      const sampleEntries = Array.from(answerMap.entries()).slice(0, 12).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join(", ");
      const moreText = answerMap.size > 12 ? ` ... và còn ${answerMap.size - 12} câu khác` : "";
      badgeSeparateAnswers.innerHTML = `✓ <strong>Đã nhận diện ${answerMap.size} đáp án:</strong> ${sampleEntries}${moreText}`;
      badgeSeparateAnswers.style.display = "block";
    } else {
      statusSeparateAnswers.textContent = "Chưa nhận diện được đáp án (thử định dạng 1.A 2.B hoặc 1A 2B...)";
      statusSeparateAnswers.style.color = "var(--danger)";
      badgeSeparateAnswers.style.display = "none";
    }
  }

  function openSeparateAnswersModal() {
    if (!modalSeparateAnswers) return;
    modalSeparateAnswers.classList.add("open");
    updateSeparateAnswersBadge();
    if (textareaSeparateAnswers) textareaSeparateAnswers.focus();
  }

  if (btnOpenSeparateAnswers) btnOpenSeparateAnswers.addEventListener("click", openSeparateAnswersModal);
  if (btnOpenSeparateAnswersTab2) btnOpenSeparateAnswersTab2.addEventListener("click", openSeparateAnswersModal);
  if (btnCloseSeparateAnswers && modalSeparateAnswers) btnCloseSeparateAnswers.addEventListener("click", () => modalSeparateAnswers.classList.remove("open"));
  if (btnCancelSeparateAnswers && modalSeparateAnswers) btnCancelSeparateAnswers.addEventListener("click", () => modalSeparateAnswers.classList.remove("open"));

  if (modalSeparateAnswers) {
    modalSeparateAnswers.addEventListener("click", (e) => {
      if (e.target === modalSeparateAnswers) modalSeparateAnswers.classList.remove("open");
    });
  }

  if (textareaSeparateAnswers) {
    textareaSeparateAnswers.addEventListener("input", updateSeparateAnswersBadge);
  }

  if (btnClearSeparateAnswers && textareaSeparateAnswers) {
    btnClearSeparateAnswers.addEventListener("click", () => {
      textareaSeparateAnswers.value = "";
      updateSeparateAnswersBadge();
    });
  }

  // Upload separate answer key file (.txt, .docx, .pdf, .csv)
  if (btnUploadSeparateAnswersFile && inputSeparateAnswersFile) {
    btnUploadSeparateAnswersFile.addEventListener("click", () => {
      inputSeparateAnswersFile.click();
    });

    inputSeparateAnswersFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const fileName = file.name.toLowerCase();
      try {
        let extractedText = "";
        if (fileName.endsWith(".pdf")) {
          showToast(`Đang đọc bảng đáp án từ PDF "${file.name}"...`, "info");
          if (typeof pdfjsLib === "undefined") throw new Error("Chưa tải thư viện PDF.js");
          pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.js";
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let p = 1; p <= pdfDoc.numPages; p++) {
            const page = await pdfDoc.getPage(p);
            const content = await page.getTextContent();
            extractedText += content.items.map(it => it.str).join(" ") + "\n";
          }
        } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
          showToast(`Đang đọc bảng đáp án từ Word "${file.name}"...`, "info");
          if (typeof JSZip === "undefined") throw new Error("Chưa tải thư viện JSZip");
          const arrayBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const docXml = zip.file("word/document.xml");
          if (docXml) {
            const xmlStr = await docXml.async("text");
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
            const pEls = xmlDoc.getElementsByTagName("w:p");
            for (let i = 0; i < pEls.length; i++) {
              extractedText += pEls[i].textContent + "\n";
            }
          }
        } else {
          // File văn bản txt/csv
          extractedText = await file.text();
        }

        if (extractedText.trim()) {
          textareaSeparateAnswers.value = extractedText;
          updateSeparateAnswersBadge();
          showToast(`Đã đọc xong tệp đáp án "${file.name}"!`, "success");
        } else {
          showToast("Không tìm thấy văn bản trong tệp!", "warning");
        }
      } catch (err) {
        console.error("Lỗi đọc tệp đáp án:", err);
        showToast(`Không thể đọc tệp: ${err.message}`, "danger");
      }
      inputSeparateAnswersFile.value = "";
    });
  }

  // Nút ghép đáp án vào đề thi
  if (btnApplySeparateAnswers) {
    btnApplySeparateAnswers.addEventListener("click", () => {
      const answerKeyText = textareaSeparateAnswers ? textareaSeparateAnswers.value.trim() : "";
      if (!answerKeyText) {
        showToast("Vui lòng dán hoặc tải lên bảng đáp án trước!", "warning");
        return;
      }

      const answerMap = parseAnswerKeyText(answerKeyText);
      if (answerMap.size === 0) {
        showToast("Không tìm thấy đáp án hợp lệ nào! Hãy kiểm tra định dạng (ví dụ: 1.A 2.B 3.C... hoặc 1A 2B...)", "danger");
        return;
      }

      const mainTextarea = document.getElementById("smart-text-input");
      if (!mainTextarea || !mainTextarea.value.trim()) {
        showToast("Chưa có câu hỏi trong đề thi! Vui lòng dán đề hoặc tải file đề thi trước.", "warning");
        return;
      }

      // Làm sạch sơ bộ đề thi nếu cần
      let currentExamText = mainTextarea.value;
      currentExamText = smartPreprocessExamText(currentExamText);

      const rawLines = currentExamText.split('\n');
      const blocks = splitIntoQuestionBlocks(rawLines);

      const { updatedBlocks, appliedCount } = applyAnswerKeyToBlocks(blocks, answerMap);

      if (appliedCount > 0) {
        mainTextarea.value = updatedBlocks.join('\n\n');
        updateSmartParsePreview();
        modalSeparateAnswers.classList.remove("open");
        showToast(`🎉 Đã ghép thành công ${appliedCount}/${answerMap.size} đáp án vào các câu hỏi trong đề thi!`, "success");
      } else {
        showToast(`Đã quét được ${answerMap.size} đáp án nhưng không khớp được với câu hỏi nào trong đề. Vui lòng kiểm tra lại số thứ tự câu hỏi (ví dụ: Câu 1, Câu 2...)`, "warning");
      }
    });
  }

  // Image zoom lightbox handler
  const zoomOverlay = document.getElementById("image-zoom-overlay");
  if (zoomOverlay) {
    zoomOverlay.addEventListener("click", () => zoomOverlay.classList.remove("open"));
  }

  // Manual builder Add button
  document.getElementById("btn-add-manual-q").addEventListener("click", addManualQuestion);

  // Save Quiz button
  document.getElementById("btn-save-quiz").addEventListener("click", () => saveCurrentQuiz(false));

  // Save & Start Quiz immediately button
  const btnSaveAndStart = document.getElementById("btn-save-and-start-quiz");
  if (btnSaveAndStart) {
    btnSaveAndStart.addEventListener("click", () => saveCurrentQuiz(true));
  }

  // 6. Setup Modal Listeners
  document.getElementById("btn-close-setup-modal").addEventListener("click", closeSetupModal);
  document.getElementById("btn-cancel-setup").addEventListener("click", closeSetupModal);
  document.getElementById("mode-card-practice").addEventListener("click", () => updateModeSelectionCards("PRACTICE"));
  document.getElementById("mode-card-exam").addEventListener("click", () => updateModeSelectionCards("EXAM"));
  const modeCardFlashcard = document.getElementById("mode-card-flashcard");
  if (modeCardFlashcard) {
    modeCardFlashcard.addEventListener("click", () => updateModeSelectionCards("FLASHCARD"));
  }
  const modeCardSurvival = document.getElementById("mode-card-survival");
  if (modeCardSurvival) {
    modeCardSurvival.addEventListener("click", () => updateModeSelectionCards("SURVIVAL"));
  }
  document.getElementById("btn-start-quiz-now").addEventListener("click", startQuizSession);

  // Click outside setup modal to close
  const setupModal = document.getElementById("modal-setup");
  if (setupModal) {
    setupModal.addEventListener("click", (e) => {
      if (e.target === setupModal) closeSetupModal();
    });
  }

  // 7. Runner Controls
  document.getElementById("btn-prev-question").addEventListener("click", () => {
    loadQuestion(AppState.session.currentIndex - 1);
  });
  document.getElementById("btn-next-question").addEventListener("click", () => {
    if (AppState.session.currentIndex === AppState.session.questions.length - 1) {
      handleFinishQuizRequest();
    } else {
      loadQuestion(AppState.session.currentIndex + 1);
    }
  });

  const mobilePaletteBtn = document.getElementById("btn-mobile-palette");
  if (mobilePaletteBtn) {
    mobilePaletteBtn.addEventListener("click", () => {
      const paletteEl = document.querySelector(".palette-sidebar");
      if (paletteEl) {
        paletteEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  document.getElementById("btn-flag-question").addEventListener("click", toggleFlagCurrentQuestion);
  document.getElementById("btn-toggle-flashcard-mode").addEventListener("click", toggleFlashcardMode);

  // Flashcard flip on click
  const flashcardEl = document.getElementById("flashcard-element");
  if (flashcardEl) {
    flashcardEl.addEventListener("click", flipFlashcard);
  }

  // Flashcard Action Buttons
  const btnFlashcardFlip = document.getElementById("btn-flashcard-flip-btn");
  if (btnFlashcardFlip) btnFlashcardFlip.addEventListener("click", flipFlashcard);

  const btnFlashcardMastered = document.getElementById("btn-flashcard-mastered");
  if (btnFlashcardMastered) btnFlashcardMastered.addEventListener("click", markFlashcardMastered);

  const btnFlashcardNeedReview = document.getElementById("btn-flashcard-need-review");
  if (btnFlashcardNeedReview) btnFlashcardNeedReview.addEventListener("click", markFlashcardNeedReview);

  // Sound toggles
  const btnSoundToggle = document.getElementById("btn-sound-toggle");
  if (btnSoundToggle) btnSoundToggle.addEventListener("click", toggleSoundSetting);

  const btnRunnerSoundToggle = document.getElementById("btn-runner-sound-toggle");
  if (btnRunnerSoundToggle) btnRunnerSoundToggle.addEventListener("click", toggleSoundSetting);


  // Analytics Modal buttons
  const btnOpenAnalytics = document.getElementById("btn-open-analytics");
  if (btnOpenAnalytics) btnOpenAnalytics.addEventListener("click", openAnalyticsModal);

  const btnCloseAnalytics = document.getElementById("btn-close-analytics");
  if (btnCloseAnalytics) btnCloseAnalytics.addEventListener("click", closeAnalyticsModal);

  const btnCloseAnalyticsFooter = document.getElementById("btn-close-analytics-footer");
  if (btnCloseAnalyticsFooter) btnCloseAnalyticsFooter.addEventListener("click", closeAnalyticsModal);

  const btnClearHistory = document.getElementById("btn-clear-test-history");
  if (btnClearHistory) btnClearHistory.addEventListener("click", clearQuizHistory);

  // Shortcuts Modal buttons
  const btnOpenShortcuts = document.getElementById("btn-open-shortcuts");
  if (btnOpenShortcuts) btnOpenShortcuts.addEventListener("click", openShortcutsModal);

  const btnOpenShortcutsRunner = document.getElementById("btn-open-shortcuts-runner");
  if (btnOpenShortcutsRunner) btnOpenShortcutsRunner.addEventListener("click", openShortcutsModal);

  const btnCloseShortcuts = document.getElementById("btn-close-shortcuts");
  if (btnCloseShortcuts) btnCloseShortcuts.addEventListener("click", closeShortcutsModal);

  const btnCloseShortcutsFooter = document.getElementById("btn-close-shortcuts-footer");
  if (btnCloseShortcutsFooter) btnCloseShortcutsFooter.addEventListener("click", closeShortcutsModal);

  const toggleShortcutsModal = document.getElementById("toggle-shortcuts-enabled");
  if (toggleShortcutsModal) {
    toggleShortcutsModal.checked = isShortcutsEnabled();
    toggleShortcutsModal.addEventListener("change", (e) => {
      setShortcutsEnabled(e.target.checked);
      showToast(e.target.checked ? "⚡ Đã bật Bàn phím Pro" : "⚪ Đã tắt Bàn phím Pro", "info");
    });
  }

  const toggleSetupShortcuts = document.getElementById("toggle-setup-shortcuts");
  if (toggleSetupShortcuts) {
    toggleSetupShortcuts.addEventListener("change", (e) => {
      setShortcutsEnabled(e.target.checked);
    });
  }

  // Result Exports (Word .docx)
  const btnExportDocxRes = document.getElementById("btn-export-docx-result");
  if (btnExportDocxRes) btnExportDocxRes.addEventListener("click", exportCurrentResultDocx);

  // Crystal Liquid Glass v3.2 - Dynamic Mouse Spotlight on Cards
  const quizListContainer = document.getElementById("quiz-list-container");
  if (quizListContainer) {
    quizListContainer.addEventListener("mousemove", (e) => {
      const card = e.target.closest(".quiz-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    });
  }

  // Update initial sound icons
  updateSoundUI();

  document.getElementById("btn-finish-quiz").addEventListener("click", handleFinishQuizRequest);
  document.getElementById("btn-cancel-submit").addEventListener("click", () => {
    document.getElementById("modal-confirm-submit").classList.remove("open");
  });
  document.getElementById("btn-confirm-submit").addEventListener("click", () => submitQuiz(false));

  // Modal xác nhận xóa đề thi
  const btnCloseDeleteModal = document.getElementById("btn-close-delete-modal");
  if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener("click", closeDeleteQuizModal);

  const btnCancelDelete = document.getElementById("btn-cancel-delete");
  if (btnCancelDelete) btnCancelDelete.addEventListener("click", closeDeleteQuizModal);

  const btnConfirmDelete = document.getElementById("btn-confirm-delete-action");
  if (btnConfirmDelete) btnConfirmDelete.addEventListener("click", confirmDeleteQuizAction);

  const modalDelete = document.getElementById("modal-confirm-delete");
  if (modalDelete) {
    modalDelete.addEventListener("click", (e) => {
      if (e.target === modalDelete) closeDeleteQuizModal();
    });
  }

  document.getElementById("btn-quit-quiz").addEventListener("click", () => {
    if (confirm("Bạn có chắc muốn thoát phiên làm bài này? Tiến độ chưa lưu sẽ bị mất.")) {
      if (AppState.session.timerInterval) clearInterval(AppState.session.timerInterval);
      switchView("view-dashboard");
    }
  });

  // 8. Results screen actions
  document.getElementById("btn-retry-all").addEventListener("click", retryAllQuestions);
  document.getElementById("btn-retry-wrongs").addEventListener("click", retryWrongQuestions);

  const reviewFilters = document.getElementById("review-filters");
  if (reviewFilters) {
    reviewFilters.addEventListener("click", (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      reviewFilters.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      const filter = chip.getAttribute("data-review-filter") || "ALL";
      renderReviewList(filter);
    });
  }

  // 9. Keyboard Shortcuts for power users
  window.addEventListener("keydown", (e) => {
    // Ignore when typing in inputs/textareas/contenteditables
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;

    // Global: Escape closes modals
    if (e.key === "Escape") {
      const openModals = document.querySelectorAll(".modal-backdrop.open");
      openModals.forEach(m => m.classList.remove("open"));
      const zoom = document.getElementById("image-zoom-overlay");
      if (zoom) zoom.classList.remove("open");
      return;
    }

    // Global: ? or Shift+/ opens shortcuts modal
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      openShortcutsModal();
      return;
    }

    // Global: S or s toggles sound (when shortcuts enabled)
    if (e.key === "s" || e.key === "S") {
      if (isShortcutsEnabled()) {
        toggleSoundSetting();
      }
      return;
    }

    // Check if "Bàn phím Pro" shortcuts are enabled
    if (!isShortcutsEnabled()) return;

    // Only active in runner view for the rest
    const runnerView = document.getElementById("view-runner");
    if (!runnerView || !runnerView.classList.contains("active")) return;

    const curIdx = AppState.session.currentIndex;
    const curQ = AppState.session.questions[curIdx];
    if (!curQ) return;

    const key = e.key.toUpperCase();

    // Arrow navigation or J/K vim style
    if (e.key === "ArrowLeft" || key === "J") {
      if (curIdx > 0) loadQuestion(curIdx - 1);
    } else if (e.key === "ArrowRight" || key === "K") {
      if (curIdx < AppState.session.questions.length - 1) {
        loadQuestion(curIdx + 1);
      } else {
        handleFinishQuizRequest();
      }
    }

    // Spacebar to flip flashcard
    if (e.key === " " && AppState.session.isFlashcard) {
      e.preventDefault();
      flipFlashcard();
      return;
    }

    // Flashcard action keys: 1 (Need Review) / 2 (Mastered)
    if (AppState.session.isFlashcard) {
      if (key === "1") {
        markFlashcardNeedReview();
        return;
      }
      if (key === "2") {
        markFlashcardMastered();
        return;
      }
    }

    // Flag toggle: F
    if (key === "F") {
      toggleFlagCurrentQuestion();
      return;
    }

    // Zen Mode toggle: Z
    if (key === "Z") {
      toggleZenMode();
      return;
    }

    // Multiple choice option keys A, B, C, D or 1, 2, 3, 4
    if (!AppState.session.isFlashcard) {
      let optionIdx = -1;
      if (key === "A" || key === "1") optionIdx = 0;
      else if (key === "B" || key === "2") optionIdx = 1;
      else if (key === "C" || key === "3") optionIdx = 2;
      else if (key === "D" || key === "4") optionIdx = 3;
      else if (key === "E" || key === "5") optionIdx = 4;

      if (optionIdx >= 0 && optionIdx < curQ.options.length) {
        selectOption(curIdx, optionIdx);
      }
    }
  });
});

// =============================================================================
// AI TUTOR & WRONG QUESTIONS REVIEW ENGINE
// =============================================================================

async function openAiTutorForWrongQuestions() {
  const modal = document.getElementById("modal-ai-tutor");
  const modalBody = document.getElementById("ai-tutor-modal-body");
  const modelBadge = document.getElementById("ai-tutor-model-badge");
  if (!modal || !modalBody) return;

  const questions = AppState.session.questions;
  const answers = AppState.session.userAnswers;
  const wrongItems = questions
    .map((q, idx) => ({ q, idx, userPick: answers[idx] }))
    .filter(item => item.userPick !== item.q.correctIndex);

  if (wrongItems.length === 0) {
    showToast("Chúc mừng! Bạn đã làm đúng tất cả các câu hỏi trong đề!", "success");
    return;
  }

  modal.classList.add("open");
  const savedKey = getSavedGeminiKey();
  const modelName = getSavedGeminiModel();
  if (modelBadge) modelBadge.textContent = savedKey ? `${modelName}` : "AI Gia Sư (Sư phạm)";

  modalBody.innerHTML = `
    <div style="text-align: center; padding: 2.5rem 1rem;">
      <div style="font-size: 2.2rem; margin-bottom: 0.75rem; animation: pulse 1s infinite;">🤖 ✨</div>
      <div style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">Gia Sư AI đang phân tích chi tiết ${wrongItems.length} câu bạn làm sai...</div>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem;">Đang tìm nguyên nhân bạn chọn nhầm, phân tích bẫy nhận thức và mẹo ghi nhớ.</div>
    </div>
  `;

  if (savedKey) {
    try {
      const questionsPrompt = wrongItems.map((item, i) => {
        const q = item.q;
        const userChoiceLetter = item.userPick !== undefined ? String.fromCharCode(65 + item.userPick) : "Chưa chọn";
        const userChoiceText = item.userPick !== undefined ? q.options[item.userPick] : "Bỏ qua";
        const correctLetter = String.fromCharCode(65 + q.correctIndex);
        const correctText = q.options[q.correctIndex];
        return `[CÂU ${i + 1}] (Gốc Câu ${item.idx + 1}): ${q.text}
Các phương án:
${q.options.map((opt, oIdx) => `${String.fromCharCode(65 + oIdx)}. ${opt}`).join("\n")}
-> Học sinh đã chọn: ${userChoiceLetter}. ${userChoiceText} (SAI)
-> Đáp án đúng chuẩn: ${correctLetter}. ${correctText} (ĐÚNG)
${q.explanation ? `Giải thích có sẵn: ${q.explanation}` : ''}`;
      }).join("\n\n---\n\n");

      const tutorPrompt = `Bạn là gia sư sư phạm trắc nghiệm giỏi, tâm huyết và ân cần.
Học sinh vừa làm sai các câu hỏi sau trong bài thi. Hãy phân tích từng câu một cách ngắn gọn, súc tích và dễ nhớ:
1. Vì sao lựa chọn của học sinh bị sai / bẫy nhận thức phổ biến.
2. Vì sao đáp án đúng lại chính xác.
3. "Mẹo nhớ nhanh" (1 câu bí kíp) để lần sau không bao giờ làm sai câu tương tự.

DỮ LIỆU CÂU SAI:
${questionsPrompt}`;

      const aiResponse = await callGeminiAiEnhancer(tutorPrompt, savedKey, "tutor-custom");
      renderAiTutorAnalysis(wrongItems, aiResponse);
      return;
    } catch (err) {
      console.warn("AI Tutor call failed, falling back to local analysis:", err);
    }
  }

  renderAiTutorLocalAnalysis(wrongItems);
}

function renderAiTutorAnalysis(wrongItems, aiText) {
  const modalBody = document.getElementById("ai-tutor-modal-body");
  if (!modalBody) return;

  const sections = aiText.split(/\[CÂU\s*\d+\]|(?=Câu\s*\d+\s*\(Gốc)/i).filter(s => s.trim().length > 0);

  modalBody.innerHTML = wrongItems.map((item, i) => {
    const q = item.q;
    const userLetter = item.userPick !== undefined ? String.fromCharCode(65 + item.userPick) : "Chưa chọn";
    const userPickText = item.userPick !== undefined ? q.options[item.userPick] : "Bỏ qua";
    const correctLetter = String.fromCharCode(65 + q.correctIndex);
    const correctPickText = q.options[q.correctIndex];
    const explanationText = sections[i] ? sections[i].trim() : (q.explanation || "Hãy xem lại lý thuyết nền tảng của câu hỏi này.");

    return `
      <div class="review-item review-wrong" style="border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-lg); padding: 1.25rem; background: var(--bg-surface); box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <strong style="color: var(--danger); font-size: 1rem;">Câu hỏi ${item.idx + 1}</strong>
          <span class="badge badge-danger">Làm sai</span>
        </div>
        <h4 style="font-size: 1rem; font-weight: 600; line-height: 1.5; margin-bottom: 0.85rem;">
          ${escapeHtml(q.text)}
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.6rem; margin-bottom: 0.85rem;">
          <div style="background: var(--danger-light); border: 1px solid var(--danger); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--danger);">
            <strong>Lựa chọn của bạn:</strong> ${userLetter}. ${escapeHtml(userPickText)} ✖
          </div>
          <div style="background: var(--success-light); border: 1px solid var(--success); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--success);">
            <strong>Đáp án chuẩn:</strong> ${correctLetter}. ${escapeHtml(correctPickText)} ✔
          </div>
        </div>
        <div style="background: linear-gradient(135deg, rgba(236, 72, 153, 0.08), rgba(139, 92, 246, 0.08)); border-left: 3px solid #ec4899; padding: 0.85rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; line-height: 1.5;">
          <div style="font-weight: 700; color: #ec4899; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
            ✨ Phân Tích Chuyên Sâu Của AI Gemini:
          </div>
          <div style="white-space: pre-line; color: var(--text-main);">${escapeHtml(explanationText)}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderAiTutorLocalAnalysis(wrongItems) {
  const modalBody = document.getElementById("ai-tutor-modal-body");
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="background: var(--primary-light); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
      <span>💡 Đang hiển thị lời giải và kiến thức trọng tâm cho các câu làm sai. Để có phân tích tâm lý bẫy sai của AI, hãy nhập Gemini Key!</span>
      <button class="btn btn-ai btn-sm" onclick="document.getElementById('modal-ai-tutor').classList.remove('open'); document.getElementById('modal-ai-gemini').classList.add('open');">Nhập Key</button>
    </div>
  ` + wrongItems.map(item => {
    const q = item.q;
    const userLetter = item.userPick !== undefined ? String.fromCharCode(65 + item.userPick) : "Chưa chọn";
    const userPickText = item.userPick !== undefined ? q.options[item.userPick] : "Bỏ qua";
    const correctLetter = String.fromCharCode(65 + q.correctIndex);
    const correctPickText = q.options[q.correctIndex];

    return `
      <div class="review-item review-wrong" style="border: 1px solid rgba(239, 68, 68, 0.4); border-radius: var(--radius-lg); padding: 1.25rem; background: var(--bg-surface); box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <strong style="color: var(--danger); font-size: 1rem;">Câu hỏi ${item.idx + 1}</strong>
          <span class="badge badge-danger">Làm sai</span>
        </div>
        <h4 style="font-size: 1rem; font-weight: 600; line-height: 1.5; margin-bottom: 0.85rem;">
          ${escapeHtml(q.text)}
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.6rem; margin-bottom: 0.85rem;">
          <div style="background: var(--danger-light); border: 1px solid var(--danger); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--danger);">
            <strong>Lựa chọn của bạn:</strong> ${userLetter}. ${escapeHtml(userPickText)} ✖
          </div>
          <div style="background: var(--success-light); border: 1px solid var(--success); padding: 0.5rem 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--success);">
            <strong>Đáp án đúng:</strong> ${correctLetter}. ${escapeHtml(correctPickText)} ✔
          </div>
        </div>
        ${q.explanation ? `
          <div style="background: var(--bg-muted); border-left: 3px solid var(--primary); padding: 0.85rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; line-height: 1.5;">
            <strong style="color: var(--primary);">💡 Giải thích chi tiết:</strong> ${escapeHtml(q.explanation)}
          </div>
        ` : `
          <div style="background: var(--bg-muted); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted);">
            <em>Chưa có sẵn lời giải thích cho câu hỏi này. Hãy bấm "Nhập Key" để AI Gemini phân tích chi tiết.</em>
          </div>
        `}
      </div>
    `;
  }).join("");
}

// Expose core functions to window for HTML inline onclick handlers
window.openSetupModal = openSetupModal;
window.closeSetupModal = closeSetupModal;
window.startQuizSession = startQuizSession;
window.openCreator = openCreator;
window.exportSingleQuiz = exportSingleQuiz;
window.deleteQuiz = deleteQuiz;
window.openDeleteQuizModal = openDeleteQuizModal;
window.closeDeleteQuizModal = closeDeleteQuizModal;
window.confirmDeleteQuizAction = confirmDeleteQuizAction;
window.addManualQuestion = addManualQuestion;
window.removeManualQuestion = removeManualQuestion;
window.updateManualQuestionText = updateManualQuestionText;
window.updateManualOptionText = updateManualOptionText;
window.setManualCorrect = setManualCorrect;
window.updateManualExplanation = updateManualExplanation;
window.selectOption = selectOption;
window.loadQuestion = loadQuestion;
window.openImageZoom = openImageZoom;
window.closeImageZoom = closeImageZoom;
window.saveCurrentQuiz = saveCurrentQuiz;
window.deleteAllQuizzes = deleteAllQuizzes;
window.clearSmartTextInput = clearSmartTextInput;
window.testGeminiApiKey = testGeminiApiKey;
window.openAiTutorForWrongQuestions = openAiTutorForWrongQuestions;

// =============================================================================
// VERSION 3.1 ENHANCEMENTS: MISTAKE VAULT, NEON CONFETTI, ZEN MODE & A4 PRINT
// =============================================================================

// --- 1. SỔ TAY CÂU HỎI SAI (MISTAKE VAULT) ---
function getMistakeVault() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MISTAKE_VAULT);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveMistakeVault(list) {
  try {
    localStorage.setItem(STORAGE_KEYS.MISTAKE_VAULT, JSON.stringify(list));
    updateMistakeVaultBadge();
  } catch (e) {
    console.error("Lỗi khi lưu Sổ tay câu sai:", e);
  }
}

function updateMistakeVaultBadge() {
  const list = getMistakeVault();
  const countEl = document.getElementById("mistake-vault-count");
  const modalCountEl = document.getElementById("mistake-vault-modal-count");
  if (countEl) countEl.textContent = list.length;
  if (modalCountEl) modalCountEl.textContent = list.length;
}

function addMistakesToVault(wrongQuestions, sourceTitle = "") {
  if (!Array.isArray(wrongQuestions) || wrongQuestions.length === 0) return;
  const current = getMistakeVault();

  wrongQuestions.forEach(q => {
    const existingIdx = current.findIndex(item => item.text.trim() === q.text.trim());
    if (existingIdx !== -1) {
      current[existingIdx].wrongCount = (current[existingIdx].wrongCount || 1) + 1;
      current[existingIdx].lastWrongTime = Date.now();
      if (q.explanation && !current[existingIdx].explanation) {
        current[existingIdx].explanation = q.explanation;
      }
    } else {
      current.push({
        id: "mv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
        text: q.text,
        options: [...q.options],
        correctIndex: q.correctIndex,
        explanation: q.explanation || "",
        image: q.image || null,
        sourceQuizTitle: sourceTitle,
        wrongCount: 1,
        lastWrongTime: Date.now()
      });
    }
  });

  saveMistakeVault(current);
}

function removeMistakeFromVault(itemId) {
  const current = getMistakeVault();
  const filtered = current.filter(item => item.id !== itemId);
  saveMistakeVault(filtered);
  renderMistakeVaultModal();
  showToast("Đã xóa câu hỏi khỏi sổ tay câu sai (Đã ghi nhớ)!", "info");
}

function clearMistakeVault() {
  const current = getMistakeVault();
  if (current.length === 0) return;
  if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ câu hỏi trong Sổ tay câu sai không?")) return;
  saveMistakeVault([]);
  renderMistakeVaultModal();
  showToast("Đã xóa sạch sổ tay câu sai!", "info");
}

function renderMistakeVaultModal() {
  const list = getMistakeVault();
  const emptyEl = document.getElementById("mistake-vault-empty");
  const contentEl = document.getElementById("mistake-vault-content");
  const listContainer = document.getElementById("mistake-vault-list");
  const modalCountEl = document.getElementById("mistake-vault-modal-count");
  const countEl = document.getElementById("mistake-vault-count");

  if (countEl) countEl.textContent = list.length;
  if (modalCountEl) modalCountEl.textContent = list.length;

  if (list.length === 0) {
    if (emptyEl) emptyEl.style.display = "block";
    if (contentEl) contentEl.style.display = "none";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  if (contentEl) contentEl.style.display = "block";

  if (listContainer) {
    listContainer.innerHTML = list.map((item, idx) => `
      <div class="mistake-item-card">
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.35rem; color: var(--text-main);">
            Câu ${idx + 1}: ${escapeHtml(item.text)}
          </div>
          <div style="font-size: 0.825rem; color: var(--success); font-weight: 600; margin-bottom: 0.25rem;">
            ✓ Đáp án đúng: ${String.fromCharCode(65 + item.correctIndex)}. ${escapeHtml(item.options[item.correctIndex] || "")}
          </div>
          ${item.explanation ? `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; margin-top: 0.2rem;">💡 ${escapeHtml(item.explanation)}</div>` : ''}
          <div style="font-size: 0.725rem; color: var(--text-muted); margin-top: 0.4rem; display: flex; gap: 0.85rem; flex-wrap: wrap;">
            <span>Đã làm sai: <strong style="color: var(--danger);">${item.wrongCount || 1}</strong> lần</span>
            ${item.sourceQuizTitle ? `<span>Nguồn: <em>${escapeHtml(item.sourceQuizTitle)}</em></span>` : ''}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="removeMistakeFromVault('${item.id}')" title="Xóa câu này khỏi sổ tay (Đã thành thạo)" style="color: var(--danger); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm);">
          ✕
        </button>
      </div>
    `).join("");
  }
}

function startPracticeMistakeVault() {
  const list = getMistakeVault();
  if (list.length === 0) {
    showToast("Sổ tay câu sai hiện đang trống!", "warning");
    return;
  }

  const modal = document.getElementById("modal-mistake-vault");
  if (modal) modal.classList.remove("open");

  // Tạo một bộ đề luyện tập đặc biệt từ các câu sai
  const mistakeQuiz = {
    id: "mistake_vault_quiz_" + Date.now(),
    title: "Sổ Tay Luyện Tập Các Câu Sai",
    category: "Luyện câu sai",
    timeLimit: Math.max(5, Math.ceil(list.length * 1.5)),
    questions: list.map(item => ({
      text: item.text,
      options: [...item.options],
      correctIndex: item.correctIndex,
      explanation: item.explanation || "",
      image: item.image || null
    }))
  };

  startQuizSession(mistakeQuiz, "PRACTICE", {
    shuffleQuestions: true,
    shuffleOptions: false,
    showInstantFeedback: true,
    timeLimit: mistakeQuiz.timeLimit
  });

  showToast(`Đã mở phiên ôn luyện ${list.length} câu trong Sổ tay câu sai!`, "success");
}

// --- 2. HIỆU ỨNG PHÁO HOA DẠ QUANG (NEON CONFETTI CELEBRATION) ---
let confettiAnimFrame = null;
function fireNeonConfetti() {
  const canvas = document.getElementById("celebration-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = "block";

  const neonColors = ["#10b981", "#06b6d4", "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#3b82f6"];
  const particles = [];
  const count = 130;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.4,
      w: Math.random() * 8 + 4,
      h: Math.random() * 12 + 6,
      vx: (Math.random() - 0.5) * 4.5,
      vy: Math.random() * 3.5 + 2.5,
      rot: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 8,
      color: neonColors[Math.floor(Math.random() * neonColors.length)],
      opacity: 1
    });
  }

  const startTime = Date.now();
  const duration = 3800; // 3.8s

  if (confettiAnimFrame) cancelAnimationFrame(confettiAnimFrame);

  function animate() {
    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      canvas.style.display = "none";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = elapsed > duration - 1000 ? (duration - elapsed) / 1000 : 1;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vRot;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = p.opacity * Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      if (p.y > canvas.height) {
        p.y = -15;
        p.x = Math.random() * canvas.width;
      }
    });

    confettiAnimFrame = requestAnimationFrame(animate);
  }

  confettiAnimFrame = requestAnimationFrame(animate);
}

// --- 3. CHẾ ĐỘ TẬP TRUNG CAO ĐỘ (ZEN / FOCUS MODE) ---
function toggleZenMode() {
  document.body.classList.toggle("zen-mode");
  const isZen = document.body.classList.contains("zen-mode");
  const zenText = document.getElementById("zen-mode-text");
  if (zenText) zenText.textContent = isZen ? "Thoát tập trung" : "Tập trung";

  if (isZen) {
    showToast("🧘 Đã bật Chế độ Tập Trung (Ẩn điều hướng để tập trung tối đa)", "info");
  } else {
    showToast("Đã trở về giao diện tiêu chuẩn", "info");
  }
}

// --- 4. CÔNG THỨC TOÁN HỌC AN TOÀN (KATEX SAFE RENDERER) ---
function renderMathInElementSafe(el) {
  if (typeof renderMathInElement === "function" && el) {
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn("KaTeX note:", e.message);
    }
  }
}

// --- 5. BẢN IN ĐỀ THI & XUẤT PDF CHUẨN A4 ---
function printQuizById(quizId) {
  const quiz = AppState.quizzes.find(q => String(q.id) === String(quizId));
  if (!quiz) {
    showToast("Không tìm thấy bộ đề thi để in!", "warning");
    return;
  }
  printQuizPaper(quiz, true);
}

function printQuizPaper(quiz, includeAnswers = true) {
  const printArea = document.getElementById("print-paper-area");
  if (!printArea) return;

  const questions = quiz.questions || [];
  const title = quiz.title || "Đề thi trắc nghiệm";
  const cat = quiz.category || "Tổng hợp";
  const time = quiz.timeLimit || 15;

  let questionsHtml = questions.map((q, idx) => {
    const letters = ["A", "B", "C", "D", "E", "F"];
    return `
      <div class="print-question-block">
        <div class="print-question-title">Câu ${idx + 1}: ${escapeHtml(q.text)}</div>
        <div class="print-options-grid">
          ${q.options.map((opt, oIdx) => `
            <div><strong>${letters[oIdx] || oIdx + 1}.</strong> ${escapeHtml(opt)}</div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  let answerKeyHtml = "";
  if (includeAnswers && questions.length > 0) {
    const tableRows = [];
    const cols = 5;
    for (let i = 0; i < questions.length; i += cols) {
      const chunk = questions.slice(i, i + cols);
      const rowHeaders = chunk.map((_, cIdx) => `<th>Câu ${i + cIdx + 1}</th>`).join("");
      const rowData = chunk.map(q => `<td><strong>${String.fromCharCode(65 + q.correctIndex)}</strong></td>`).join("");
      tableRows.push(`<tr>${rowHeaders}</tr><tr>${rowData}</tr>`);
    }

    answerKeyHtml = `
      <div class="print-page-break">
        <h3 style="text-align: center; text-transform: uppercase; margin-bottom: 0.4rem; font-size: 13pt;">BẢNG ĐÁP ÁN & HƯỚNG DẪN GIẢI CHI TIẾT</h3>
        <p style="text-align: center; font-size: 10pt; margin-bottom: 1rem; color: #555;">(Dành cho giáo viên / người chấm thi)</p>
        <table class="print-answer-key-table">
          ${tableRows.join("")}
        </table>
        <div style="margin-top: 1.5rem;">
          <h4 style="font-size: 11pt; margin-bottom: 0.5rem; text-decoration: underline;">Giải thích chi tiết:</h4>
          ${questions.filter(q => q.explanation).map((q, idx) => `
            <div style="font-size: 10pt; margin-bottom: 0.5rem;">
              <strong>Câu ${idx + 1}:</strong> ${escapeHtml(q.explanation)}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  printArea.innerHTML = `
    <div class="print-test-header">
      <div>
        <div style="font-weight: bold; font-size: 11pt; text-transform: uppercase;">KỲ THI TRẮC NGHIỆM ĐÁNH GIÁ NĂNG LỰC</div>
        <div style="font-size: 9.5pt;">Môn thi: <strong>${escapeHtml(cat)}</strong></div>
        <div style="font-size: 9.5pt;">Thời gian làm bài: <strong>${time} phút</strong></div>
      </div>
      <div style="text-align: right; font-size: 9.5pt; line-height: 1.6;">
        <div>Họ và tên: ..............................................................</div>
        <div>Số báo danh: ....................... Lớp: ...........................</div>
        <div>Mã đề thi: <strong>${escapeHtml(quiz.id || "101")}</strong></div>
      </div>
    </div>
    
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <h2 style="font-size: 14pt; margin: 0.35rem 0; text-transform: uppercase;">${escapeHtml(title)}</h2>
      <div style="font-size: 9.5pt; font-style: italic;">(Đề thi gồm ${questions.length} câu hỏi trắc nghiệm)</div>
    </div>

    <div class="print-questions-list">
      ${questionsHtml}
    </div>

    ${answerKeyHtml}
  `;

  renderMathInElementSafe(printArea);
  window.print();
}

function printCurrentResult() {
  if (!AppState.session || !AppState.session.questions || AppState.session.questions.length === 0) {
    showToast("Không có kết quả bài thi hiện tại để in!", "warning");
    return;
  }
  const currentQuiz = {
    id: AppState.session.quizId || "KQ",
    title: AppState.session.quizTitle || "Bảng Điểm & Đề Thi",
    category: AppState.session.category || "Tổng hợp",
    timeLimit: Math.ceil(AppState.session.timeSpent / 60) || 15,
    questions: AppState.session.questions
  };
  printQuizPaper(currentQuiz, true);
}

// --- 6. DYNAMIC 3D CURSOR SPOTLIGHT TRACKING ---
document.addEventListener("mousemove", (e) => {
  const card = e.target.closest(".quiz-card, .question-card-main, .option-btn, .creator-card, .result-card-header, .mode-card");
  if (card) {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty("--mouse-x", `${x.toFixed(1)}%`);
    card.style.setProperty("--mouse-y", `${y.toFixed(1)}%`);
  }
});

// --- 7. ĐĂNG KÝ CÁC EVENT LISTENERS CỦA BẢN V3.1 ---
document.addEventListener("DOMContentLoaded", () => {
  // Cập nhật huy hiệu Sổ tay câu sai khi khởi động
  updateMistakeVaultBadge();

  // Nút mở Sổ tay câu sai trên thanh Toolbar
  const btnOpenVault = document.getElementById("btn-open-mistake-vault");
  const modalVault = document.getElementById("modal-mistake-vault");
  if (btnOpenVault && modalVault) {
    btnOpenVault.addEventListener("click", () => {
      renderMistakeVaultModal();
      modalVault.classList.add("open");
    });
  }

  const btnCloseVault = document.getElementById("btn-close-mistake-vault");
  const btnCancelVault = document.getElementById("btn-cancel-mistake-vault");
  if (btnCloseVault && modalVault) btnCloseVault.addEventListener("click", () => modalVault.classList.remove("open"));
  if (btnCancelVault && modalVault) btnCancelVault.addEventListener("click", () => modalVault.classList.remove("open"));

  const btnClearVault = document.getElementById("btn-clear-mistake-vault");
  if (btnClearVault) btnClearVault.addEventListener("click", clearMistakeVault);

  const btnPracticeVault = document.getElementById("btn-practice-mistake-vault");
  if (btnPracticeVault) btnPracticeVault.addEventListener("click", startPracticeMistakeVault);

  // Nút Chế độ Tập Trung (Zen Mode) trong phòng thi
  const btnZenMode = document.getElementById("btn-toggle-zen-mode");
  if (btnZenMode) btnZenMode.addEventListener("click", toggleZenMode);

  // Nút In đề / PDF ở màn hình kết quả
  const btnPrintRes = document.getElementById("btn-print-result");
  if (btnPrintRes) btnPrintRes.addEventListener("click", printCurrentResult);

  // Đăng ký bộ lắng nghe cho Mục riêng các câu hỏi AI vừa sửa
  setupAiAuditDiffListeners();

  // --- 8. ĐĂNG KÝ EVENT LISTENERS V3.3 ---
  // Sticky Notes
  const btnToggleNote = document.getElementById("btn-toggle-note");
  if (btnToggleNote) btnToggleNote.addEventListener("click", toggleStickyNoteDrawer);

  const btnCloseNote = document.getElementById("btn-close-note");
  if (btnCloseNote) {
    btnCloseNote.addEventListener("click", () => {
      const drawer = document.getElementById("sticky-note-drawer");
      if (drawer) drawer.classList.remove("open");
    });
  }

  const stickyNoteInput = document.getElementById("sticky-note-input");
  if (stickyNoteInput) {
    stickyNoteInput.addEventListener("input", (e) => {
      if (!AppState.session || !AppState.session.questions) return;
      const q = AppState.session.questions[AppState.session.currentIndex];
      const key = getQuestionNoteKey(AppState.session.quizId, q, AppState.session.currentIndex);
      saveQuestionNote(key, e.target.value);
      updatePaletteCellStatus(AppState.session.currentIndex);
    });
  }

  document.querySelectorAll(".sticky-tag-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const tag = chip.getAttribute("data-tag");
      if (tag) appendQuickTagToNote(tag);
    });
  });

  // Multi-code generator modal
  const btnCloseMultiCode = document.getElementById("btn-close-multi-code");
  if (btnCloseMultiCode) btnCloseMultiCode.addEventListener("click", closeMultiCodeModal);

  const btnCancelMultiCode = document.getElementById("btn-cancel-multicode");
  if (btnCancelMultiCode) btnCancelMultiCode.addEventListener("click", closeMultiCodeModal);

  const selectMultiCount = document.getElementById("select-multicode-count");
  if (selectMultiCount) selectMultiCount.addEventListener("change", updateMultiCodePreviewBadges);

  const inputMultiStart = document.getElementById("input-multicode-start");
  if (inputMultiStart) inputMultiStart.addEventListener("input", updateMultiCodePreviewBadges);

  const btnSaveMultiLib = document.getElementById("btn-save-multicode-to-library");
  if (btnSaveMultiLib) btnSaveMultiLib.addEventListener("click", saveMultiCodeToLibrary);

  const btnExportMultiDocx = document.getElementById("btn-export-multicode-docx");
  if (btnExportMultiDocx) btnExportMultiDocx.addEventListener("click", exportMultiCodeDocx);

  // Survival Game Over modal
  const btnSurvivalRetry = document.getElementById("btn-survival-retry");
  if (btnSurvivalRetry) {
    btnSurvivalRetry.addEventListener("click", () => {
      const modal = document.getElementById("modal-survival-gameover");
      if (modal) modal.classList.remove("open");
      if (AppState.session && AppState.session.quizId) {
        const quiz = AppState.quizzes.find(q => q.id === AppState.session.quizId);
        if (quiz) {
          AppState.activeQuizForSetup = quiz;
          startQuizSession({ currentMode: "SURVIVAL" });
        }
      }
    });
  }

  const btnSurvivalQuit = document.getElementById("btn-survival-quit");
  if (btnSurvivalQuit) {
    btnSurvivalQuit.addEventListener("click", () => {
      const modal = document.getElementById("modal-survival-gameover");
      if (modal) modal.classList.remove("open");
      if (AppState.session && AppState.session.survivalTimer) {
        clearInterval(AppState.session.survivalTimer);
      }
      switchView("view-dashboard");
    });
  }

  // --- Auto-Advance Controls (v3.3.2) ---
  initAutoAdvanceSetting();

  const btnToggleAutoAdvance = document.getElementById("btn-toggle-auto-advance");
  const autoAdvanceMenu = document.getElementById("auto-advance-menu");
  if (btnToggleAutoAdvance && autoAdvanceMenu) {
    btnToggleAutoAdvance.addEventListener("click", (e) => {
      e.stopPropagation();
      autoAdvanceMenu.classList.toggle("open");
    });
  }

  document.querySelectorAll(".auto-advance-opt").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const speed = opt.getAttribute("data-speed");
      if (speed) setAutoAdvanceSetting(speed);
    });
  });

  const setupAutoAdvanceSelect = document.getElementById("select-setup-auto-advance");
  if (setupAutoAdvanceSelect) {
    setupAutoAdvanceSelect.addEventListener("change", (e) => {
      setAutoAdvanceSetting(e.target.value);
    });
  }

  const btnCancelAutoAdvance = document.getElementById("btn-cancel-auto-advance");
  if (btnCancelAutoAdvance) {
    btnCancelAutoAdvance.addEventListener("click", () => {
      cancelAutoAdvance();
      showToast("Đã dừng tự chuyển câu!");
    });
  }

  window.addEventListener("click", (e) => {
    const wrapper = document.getElementById("auto-advance-wrapper");
    const menu = document.getElementById("auto-advance-menu");
    if (menu && menu.classList.contains("open") && wrapper && !wrapper.contains(e.target)) {
      menu.classList.remove("open");
    }
  });

  // --- V4.0.0 FEATURES: AI EXAM GENERATOR, TINDER FLASHCARD, ZEN MODE 2.0 ---
  initFlashcardTinderSwipe();

  // AI Exam Generator Modal Setup
  const btnOpenAiGen = document.getElementById("btn-open-ai-generator");
  if (btnOpenAiGen) btnOpenAiGen.addEventListener("click", openAiGeneratorModal);

  const btnCloseAiGen = document.getElementById("btn-close-ai-generator");
  if (btnCloseAiGen) btnCloseAiGen.addEventListener("click", closeAiGeneratorModal);

  const btnCancelAiGen = document.getElementById("btn-cancel-ai-generator");
  if (btnCancelAiGen) btnCancelAiGen.addEventListener("click", closeAiGeneratorModal);

  const btnSubmitAiGen = document.getElementById("btn-submit-ai-generator");
  if (btnSubmitAiGen) btnSubmitAiGen.addEventListener("click", handleGenerateExamWithAi);

  const btnSubmitAiOffline = document.getElementById("btn-submit-ai-offline");
  if (btnSubmitAiOffline) btnSubmitAiOffline.addEventListener("click", handleGenerateExamOffline);

  document.querySelectorAll(".ai-gen-suggestion").forEach(btn => {
    btn.addEventListener("click", () => {
      const topicInput = document.getElementById("ai-gen-topic");
      const topic = btn.getAttribute("data-topic");
      if (topicInput && topic) {
        topicInput.value = topic;
        topicInput.focus();
      }
    });
  });

  const genModelSelect = document.getElementById("ai-gen-model-select");
  const genCustomBox = document.getElementById("ai-gen-custom-model-box");
  const genCustomInput = document.getElementById("ai-gen-custom-model-input");
  if (genModelSelect) {
    genModelSelect.addEventListener("change", () => {
      const val = genModelSelect.value;
      if (val === "custom") {
        if (genCustomBox) genCustomBox.style.display = "block";
        if (genCustomInput) {
          genCustomInput.focus();
          const customVal = genCustomInput.value.trim() || getSavedGeminiCustomModel() || "gemini-3.8-flash";
          genCustomInput.value = customVal;
          activeGeminiModel = customVal;
          setSavedGeminiModel(customVal);
        }
      } else {
        if (genCustomBox) genCustomBox.style.display = "none";
        activeGeminiModel = val;
        setSavedGeminiModel(val);
        const selectMainModel = document.getElementById("select-gemini-model");
        if (selectMainModel && Array.from(selectMainModel.options).some(o => o.value === val)) {
          selectMainModel.value = val;
        }
      }
    });
  }
  if (genCustomInput) {
    genCustomInput.addEventListener("input", () => {
      const customVal = genCustomInput.value.trim();
      if (customVal) {
        activeGeminiModel = customVal;
        setSavedGeminiModel(customVal);
        setSavedGeminiCustomModel(customVal);
      }
    });
  }

  const modalAiGen = document.getElementById("modal-ai-generator");
  if (modalAiGen) {
    modalAiGen.addEventListener("click", (e) => {
      if (e.target === modalAiGen) closeAiGeneratorModal();
    });
  }

  // Zen Ambient Audio Dropdown Setup
  const btnZenAmbient = document.getElementById("btn-zen-ambient");
  const zenPopover = document.getElementById("zen-ambient-popover");
  const btnCloseZenPopover = document.getElementById("btn-close-zen-popover");
  if (btnZenAmbient && zenPopover) {
    btnZenAmbient.addEventListener("click", (e) => {
      e.stopPropagation();
      zenPopover.style.display = zenPopover.style.display === "none" ? "block" : "none";
    });
  }
  if (btnCloseZenPopover && zenPopover) {
    btnCloseZenPopover.addEventListener("click", () => {
      zenPopover.style.display = "none";
    });
  }
  document.querySelectorAll(".zen-opt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const soundType = btn.getAttribute("data-sound");
      setZenAmbientSound(soundType);
    });
  });
  const zenVolSlider = document.getElementById("zen-volume-slider");
  if (zenVolSlider) {
    zenVolSlider.addEventListener("input", (e) => {
      setZenAmbientVolume(e.target.value);
    });
  }
  window.addEventListener("click", (e) => {
    if (zenPopover && zenPopover.style.display !== "none" && !e.target.closest(".zen-ambient-wrapper")) {
      zenPopover.style.display = "none";
    }
  });

  // --- 9. EVENT LISTENERS: CHIA SẺ ĐỀ THI QUA LINK TRỰC TIẾP (FEATURE #4) ---
  const btnCloseShare = document.getElementById("btn-close-share-quiz");
  const btnCloseShareFooter = document.getElementById("btn-close-share-quiz-footer");
  const modalShare = document.getElementById("modal-share-quiz");
  if (btnCloseShare) btnCloseShare.addEventListener("click", closeShareQuizModal);
  if (btnCloseShareFooter) btnCloseShareFooter.addEventListener("click", closeShareQuizModal);
  if (modalShare) {
    modalShare.addEventListener("click", (e) => {
      if (e.target === modalShare) closeShareQuizModal();
    });
  }

  const btnCopyShareUrl = document.getElementById("btn-copy-share-quiz-url");
  if (btnCopyShareUrl) btnCopyShareUrl.addEventListener("click", copyShareUrlToClipboard);

  const btnNativeShare = document.getElementById("btn-native-share-quiz");
  if (btnNativeShare) btnNativeShare.addEventListener("click", triggerNativeShare);

  const btnShareModalExportJson = document.getElementById("btn-share-modal-export-json");
  if (btnShareModalExportJson) {
    btnShareModalExportJson.addEventListener("click", () => {
      if (currentShareQuiz) exportSingleQuiz(currentShareQuiz.id);
    });
  }

  const btnSetupShare = document.getElementById("btn-setup-share-quiz");
  if (btnSetupShare) {
    btnSetupShare.addEventListener("click", () => {
      if (targetQuizForSetup) {
        openShareQuizModal(targetQuizForSetup.id);
      }
    });
  }

  // Received Shared Quiz Modal listeners
  const btnCloseReceived = document.getElementById("btn-close-received-quiz");
  const modalReceived = document.getElementById("modal-received-quiz");
  if (btnCloseReceived) {
    btnCloseReceived.addEventListener("click", () => {
      if (modalReceived) modalReceived.classList.remove("open");
      history.replaceState(null, "", window.location.pathname + window.location.search);
    });
  }
  if (modalReceived) {
    modalReceived.addEventListener("click", (e) => {
      if (e.target === modalReceived) {
        modalReceived.classList.remove("open");
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    });
  }

  const btnReceivedSaveOnly = document.getElementById("btn-received-save-only");
  if (btnReceivedSaveOnly) btnReceivedSaveOnly.addEventListener("click", saveReceivedQuizToLibrary);

  const btnReceivedStartPractice = document.getElementById("btn-received-start-practice");
  if (btnReceivedStartPractice) btnReceivedStartPractice.addEventListener("click", () => startReceivedQuiz("PRACTICE"));

  const btnReceivedStartExam = document.getElementById("btn-received-start-exam");
  if (btnReceivedStartExam) btnReceivedStartExam.addEventListener("click", () => startReceivedQuiz("EXAM"));

  // Check URL hash for shared quiz on startup
  checkSharedQuizFromUrl();

  window.addEventListener("hashchange", () => {
    if (window.location.hash.startsWith("#share=")) {
      checkSharedQuizFromUrl();
    }
  });

  // Khởi động PWA Service Worker & Install prompt
  initPwaInstall();
});

// =============================================================================
// AI EXAM GENERATOR FROM PROMPT / TOPIC (TẠO ĐỀ THEO CHỦ ĐỀ)
// =============================================================================
function openAiGeneratorModal() {
  const modal = document.getElementById("modal-ai-generator");
  if (!modal) return;
  modal.classList.add("open");
  
  const savedKey = getSavedGeminiKey();
  const keyContainer = document.getElementById("ai-gen-key-container");
  const keyInput = document.getElementById("ai-gen-key-input");
  if (!savedKey) {
    if (keyContainer) keyContainer.style.display = "block";
  } else {
    if (keyContainer) keyContainer.style.display = "none";
    if (keyInput) keyInput.value = savedKey;
  }

  // Đồng bộ mô hình đang chọn với dropdown trong Modal AI Sinh Đề
  const genModelSelect = document.getElementById("ai-gen-model-select");
  const genCustomBox = document.getElementById("ai-gen-custom-model-box");
  const genCustomInput = document.getElementById("ai-gen-custom-model-input");
  if (genModelSelect) {
    const curModel = getSavedGeminiModel();
    if (Array.from(genModelSelect.options).some(o => o.value === curModel)) {
      genModelSelect.value = curModel;
      if (genCustomBox) genCustomBox.style.display = "none";
    } else {
      genModelSelect.value = "custom";
      if (genCustomBox) genCustomBox.style.display = "block";
      if (genCustomInput) genCustomInput.value = curModel;
    }
  }

  const progressBox = document.getElementById("ai-gen-progress-box");
  if (progressBox) progressBox.style.display = "none";

  const btnSubmit = document.getElementById("btn-submit-ai-generator");
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      🚀 Bắt đầu Tạo Đề Bằng AI Gemini
    `;
  }

  const topicInput = document.getElementById("ai-gen-topic");
  if (topicInput) setTimeout(() => topicInput.focus(), 150);
}

function closeAiGeneratorModal() {
  const modal = document.getElementById("modal-ai-generator");
  if (modal) modal.classList.remove("open");
}

// Hàm hậu xử lý và đưa bộ đề đã tạo vào giao diện Creator
function applyGeneratedQuizToCreator(topic, rawOutput, count, isAi = true) {
  if (!rawOutput || !rawOutput.trim()) {
    throw new Error("Dữ liệu đề thi tạo ra rỗng hoặc không hợp lệ!");
  }

  // 1. Làm sạch các thẻ markdown code fences như ```markdown ... ```
  let cleanedText = rawOutput
    .replace(/^```[a-zA-Z]*\r?\n?/gm, "")
    .replace(/```\s*$/gm, "")
    .trim();

  // Loại bỏ các đoạn văn chào đầu của AI nếu có trước Câu 1
  const firstQIdx = cleanedText.search(/^(Câu\s*\d+|1[\.\:\)])/im);
  if (firstQIdx > 0) {
    cleanedText = cleanedText.slice(firstQIdx).trim();
  }

  // 2. Chuyển sang View Creator và kích hoạt Tab Dán Thông Minh
  switchView("view-creator");

  const tabPasteBtn = document.querySelector('.creator-tab[data-tab="tab-smart-paste"]');
  if (tabPasteBtn) {
    tabPasteBtn.click();
  } else {
    document.querySelectorAll(".creator-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.style.display = "none");
    const panel = document.getElementById("tab-smart-paste");
    if (panel) panel.style.display = "block";
  }

  // 3. Đưa văn bản đề thi vào khung soạn thảo
  const textarea = document.getElementById("smart-text-input");
  if (textarea) {
    textarea.value = cleanedText;
  }

  // 4. Tự động thiết lập Tiêu đề đề thi
  const titleInput = document.getElementById("input-quiz-title");
  if (titleInput && (!titleInput.value.trim() || titleInput.value.startsWith("Đề thi"))) {
    let neatTitle = topic.length > 50 ? topic.substring(0, 50) + "..." : topic;
    titleInput.value = isAi ? `Đề thi AI: ${neatTitle}` : `Đề ôn tập: ${neatTitle}`;
  }

  // 5. Tự động nhận diện môn học / danh mục
  const catInput = document.getElementById("input-quiz-category");
  if (catInput && (!catInput.value.trim() || catInput.value === "Chung")) {
    const lowerT = topic.toLowerCase();
    if (lowerT.includes("sử") || lowerT.includes("lịch sử")) catInput.value = "Lịch sử";
    else if (lowerT.includes("địa") || lowerT.includes("địa lý")) catInput.value = "Địa lý";
    else if (lowerT.includes("anh") || lowerT.includes("english")) catInput.value = "Tiếng Anh";
    else if (lowerT.includes("toán") || lowerT.includes("math")) catInput.value = "Toán học";
    else if (lowerT.includes("tin") || lowerT.includes("it") || lowerT.includes("code") || lowerT.includes("lập trình") || lowerT.includes("office") || lowerT.includes("excel")) catInput.value = "Tin học";
    else if (lowerT.includes("sinh")) catInput.value = "Sinh học";
    else if (lowerT.includes("hóa")) catInput.value = "Hóa học";
    else if (lowerT.includes("lý") || lowerT.includes("vật lý")) catInput.value = "Vật lý";
    else if (lowerT.includes("luật") || lowerT.includes("pháp luật") || lowerT.includes("hiến pháp") || lowerT.includes("gdcd") || lowerT.includes("công dân")) catInput.value = "Pháp luật";
    else catInput.value = "Tổng hợp";
  }

  // 6. Cập nhật thời gian làm bài khuyến nghị (1.5 phút/câu)
  const timeInput = document.getElementById("input-quiz-time");
  if (timeInput) {
    const recTime = Math.max(5, Math.round(count * 1.5));
    timeInput.value = recTime;
  }

  // 7. Cập nhật thống kê và tự động mở danh sách câu hỏi phân tích để người dùng thấy ngay
  updateSmartParsePreview();

  const previewContainer = document.getElementById("parsed-preview-container");
  const togglePreviewBtn = document.getElementById("btn-toggle-parsed-preview");
  if (previewContainer) {
    previewContainer.style.display = "block";
    if (togglePreviewBtn) togglePreviewBtn.textContent = "Ẩn danh sách câu phân tích";
    const parsed = parseRawQuestions(cleanedText);
    renderParsedQuestionsList(parsed.questions);
  }

  // 8. Đóng modal tạo đề và bắn pháo hoa chúc mừng
  closeAiGeneratorModal();
  triggerCelebrationConfetti();

  const prefix = isAi ? "🎉 AI Gemini" : "⚡ Hệ thống";
  showToast(`${prefix} đã tạo thành công bộ đề thi với ${count} câu hỏi về "${topic}"!`, "success");
}

// BỘ TRÌNH SINH ĐỀ THÔNG MINH OFFLINE (KHÔNG CẦN GEMINI KEY)
function generateOfflineQuestions(topic, count = 10, level = "Cân bằng mọi mức độ", hasExpl = true) {
  const normTopic = (topic || "").toLowerCase();

  const BANK_HISTORY = [
    {
      q: "Chiến dịch Điện Biên Phủ toàn thắng vào ngày, tháng, năm nào?",
      opts: ["07/05/1954", "30/04/1975", "19/08/1945", "02/09/1945"],
      c: 0,
      expl: "Chiến dịch Điện Biên Phủ kết thúc thắng lợi vào chiều ngày 7/5/1954 khi tướng De Castries và toàn bộ bộ chỉ huy Pháp đầu hàng."
    },
    {
      q: "Chiến dịch Hồ Chí Minh lịch sử giải phóng hoàn toàn miền Nam, thống nhất đất nước diễn ra vào năm nào?",
      opts: ["Năm 1972", "Năm 1975", "Năm 1973", "Năm 1979"],
      c: 1,
      expl: "Vào lúc 11h30 ngày 30/4/1975, lá cờ chiến thắng tung bay trên nóc Dinh Độc Lập, đánh dấu thắng lợi hoàn toàn của Chiến dịch Hồ Chí Minh."
    },
    {
      q: "Chủ tịch Hồ Chí Minh đọc bản Tuyên ngôn Độc lập khai sinh ra nước Việt Nam Dân chủ Cộng hòa tại đâu?",
      opts: ["Quảng trường Ba Đình (Hà Nội)", "Bến Nhà Rồng (TP. Hồ Chí Minh)", "Cây đa Tân Trào (Tuyên Quang)", "Chiến khu Việt Bắc"],
      c: 0,
      expl: "Ngày 2/9/1945, tại Quảng trường Ba Đình (Hà Nội), Chủ tịch Hồ Chí Minh đã đọc bản Tuyên ngôn Độc lập."
    },
    {
      q: "Hiệp định Genève về chấm dứt chiến tranh, lập lại hòa bình ở Đông Dương được ký kết vào năm nào?",
      opts: ["1950", "1953", "1954", "1973"],
      c: 2,
      expl: "Hiệp định Genève được ký kết vào ngày 21/7/1954, lấy vĩ tuyến 17 làm giới tuyến quân sự tạm thời."
    },
    {
      q: "Phong trào Đồng Khởi (1959 - 1960) nổ ra tiêu biểu đầu tiên tại địa phương nào?",
      opts: ["Định Thủy, Bình Khánh, Phước Hiệp (Bến Tre)", "Củ Chi (Gia Định)", "Ấp Bắc (Mỹ Tho)", "Trảng Bàng (Tây Ninh)"],
      c: 0,
      expl: "Phong trào Đồng Khởi bùng nổ tiêu biểu nhất tại huyện Mỏ Cày, tỉnh Bến Tre vào ngày 17/1/1960."
    },
    {
      q: "Chiến thắng nào của quân và dân miền Bắc được ví như trận 'Điện Biên Phủ trên không'?",
      opts: ["Trận 12 ngày đêm cuối năm 1972 tại Hà Nội - Hải Phòng", "Chiến dịch Khe Sanh 1968", "Chiến dịch Đường 9 - Nam Lào 1971", "Tổng tiến công Tết Mậu Thân 1968"],
      c: 0,
      expl: "Trận chiến đấu 12 ngày đêm đánh bại pháo đài bay B-52 của Mỹ cuối tháng 12/1972 được ngợi ca là chiến thắng Điện Biên Phủ trên không."
    },
    {
      q: "Mặt trận Dân tộc Giải phóng miền Nam Việt Nam được thành lập vào thời gian nào?",
      opts: ["20/12/1960", "01/01/1959", "19/05/1965", "03/02/1960"],
      c: 0,
      expl: "Mặt trận Dân tộc Giải phóng miền Nam Việt Nam được thành lập vào ngày 20/12/1960 tại Tây Ninh."
    },
    {
      q: "Đại hội đại biểu toàn quốc lần thứ mấy của Đảng đã đề ra đường lối Đổi mới đất nước?",
      opts: ["Đại hội IV (1976)", "Đại hội V (1982)", "Đại hội VI (1986)", "Đại hội VII (1991)"],
      c: 2,
      expl: "Đại hội đại biểu toàn quốc lần thứ VI (tháng 12/1986) của Đảng Cộng sản Việt Nam đã chính thức khởi xướng công cuộc Đổi mới toàn diện đất nước."
    },
    {
      q: "Hiệp định Paris về chấm dứt chiến tranh, lập lại hòa bình ở Việt Nam được ký vào thời gian nào?",
      opts: ["27/01/1973", "20/07/1954", "30/04/1975", "19/12/1946"],
      c: 0,
      expl: "Hiệp định Paris ký ngày 27/1/1973 buộc quân đội Mỹ và đồng minh phải rút khỏi miền Nam Việt Nam."
    },
    {
      q: "Chiến thắng mở màn cho cuộc Tổng tiến công và nổi dậy mùa Xuân 1975 là trận đánh tại đâu?",
      opts: ["Thị xã Buôn Ma Thuột (Tây Nguyên)", "Huế - Đà Nẵng", "Xuân Lộc", "Phước Long"],
      c: 0,
      expl: "Trận đánh then chốt Buôn Ma Thuột ngày 10/3/1975 đã mở màn thắng lợi cho chiến dịch Tây Nguyên và bước ngoặt Tổng tiến công Xuân 1975."
    }
  ];

  const BANK_IT = [
    {
      q: "Trong hệ điều hành Windows, tổ hợp phím nào dùng để mở nhanh cửa sổ Task Manager?",
      opts: ["Ctrl + Shift + Esc", "Ctrl + Alt + F4", "Alt + Tab", "Windows + R"],
      c: 0,
      expl: "Tổ hợp Ctrl + Shift + Esc mở thẳng trình quản lý tác vụ Task Manager nhanh nhất mà không cần qua menu trung gian."
    },
    {
      q: "Trong Microsoft Excel, hàm nào được dùng để tính trung bình cộng của một dãy số?",
      opts: ["AVERAGE", "SUM", "COUNT", "MEDIAN"],
      c: 0,
      expl: "Cú pháp =AVERAGE(range) trả về giá trị trung bình cộng số học của các ô trong vùng được chọn."
    },
    {
      q: "Giao thức mạng nào có nhiệm vụ gán địa chỉ IP tự động cho các thiết bị khi kết nối vào mạng?",
      opts: ["DHCP", "DNS", "HTTP", "FTP"],
      c: 0,
      expl: "DHCP (Dynamic Host Configuration Protocol) tự động cấp phát địa chỉ IP và cấu hình mạng cho các thiết bị client."
    },
    {
      q: "Thiết bị phần cứng nào được ví như 'bộ não' trung tâm xử lý dữ liệu của máy tính?",
      opts: ["CPU (Central Processing Unit)", "RAM (Random Access Memory)", "Ổ cứng SSD/HDD", "Nguồn PSU"],
      c: 0,
      expl: "CPU chịu trách nhiệm tiếp nhận, phân tích lệnh và thực thi các phép tính toán chính của máy tính."
    },
    {
      q: "Tổ hợp phím tắt tiêu chuẩn nào trong các trình soạn thảo để phục hồi lại thao tác vừa Undo?",
      opts: ["Ctrl + Y (hoặc Ctrl + Shift + Z)", "Ctrl + Z", "Ctrl + R", "Ctrl + Shift + V"],
      c: 0,
      expl: "Ctrl + Y (Redo) dùng để làm lại hành động vừa bị hủy (Undo bằng Ctrl + Z)."
    },
    {
      q: "Trong Microsoft Word, tổ hợp phím nào dùng để căn lề đều hai bên (Justify)?",
      opts: ["Ctrl + J", "Ctrl + E", "Ctrl + L", "Ctrl + R"],
      c: 0,
      expl: "Ctrl + J là phím tắt căn đều hai biên đoạn văn bản (Justify alignment)."
    },
    {
      q: "Trong Excel, ký tự nào bắt buộc phải đặt trước tên cột hoặc dòng để tạo địa chỉ tuyệt đối (cố định ô)?",
      opts: ["Dấu đô la ($)", "Dấu thăng (#)", "Dấu và (&)", "Dấu phần trăm (%)"],
      c: 0,
      expl: "Ký hiệu $ trước chữ cái cột hoặc số dòng (ví dụ $A$1) dùng để cố định ô khi sao chép công thức."
    },
    {
      q: "Chuẩn giao thức bảo mật mã hóa đường truyền web giữa trình duyệt và máy chủ là gì?",
      opts: ["HTTPS (Port 443)", "HTTP (Port 80)", "Telnet (Port 23)", "SMTP (Port 25)"],
      c: 0,
      expl: "HTTPS sử dụng chứng chỉ SSL/TLS để mã hóa dữ liệu truyền tải giữa người dùng và website."
    },
    {
      q: "Loại bộ nhớ nào sau đây sẽ bị mất toàn bộ dữ liệu khi ngắt nguồn điện máy tính?",
      opts: ["RAM", "ROM", "Ổ đĩa quang CD/DVD", "Ổ cứng SSD"],
      c: 0,
      expl: "RAM là bộ nhớ truy xuất ngẫu nhiên khả biến (volatile memory), dữ liệu sẽ biến mất khi tắt máy hoặc mất điện."
    },
    {
      q: "Trong cơ sở dữ liệu quan hệ, câu lệnh SQL nào dùng để truy vấn và lấy dữ liệu từ bảng?",
      opts: ["SELECT", "INSERT", "UPDATE", "DROP"],
      c: 0,
      expl: "Câu lệnh SELECT ... FROM ... là câu lệnh căn bản nhất trong SQL để đọc và lọc dữ liệu từ bảng."
    }
  ];

  const BANK_ENGLISH = [
    {
      q: "Choose the correct sentence in Present Perfect tense:",
      opts: ["I have lived in this city for five years.", "I has lived in this city since five years.", "I lived in this city for five years ago.", "I am living in this city since 2020."],
      c: 0,
      expl: "Subject 'I' đi với 'have + V3/ed', và khoảng thời gian 'five years' sử dụng giới từ 'for'."
    },
    {
      q: "Complete the conditional sentence: 'If it rains tomorrow, we _______ the outdoor picnic.'",
      opts: ["will cancel", "would cancel", "canceled", "had canceled"],
      c: 0,
      expl: "Câu điều kiện loại 1 (sự việc có thể xảy ra ở hiện tại hoặc tương lai): If + S + V(hiện tại đơn), S + will + V-inf."
    },
    {
      q: "Convert to passive voice: 'They built this bridge in 1995.'",
      opts: ["This bridge was built in 1995.", "This bridge is built in 1995.", "This bridge has been built in 1995.", "This bridge had built in 1995."],
      c: 0,
      expl: "Thì quá khứ đơn ở dạng bị động: was/were + V3/ed (This bridge was built...)."
    },
    {
      q: "Which word is a synonym for 'abundant'?",
      opts: ["Plentiful", "Scarce", "Tiny", "Insufficient"],
      c: 0,
      expl: "'Abundant' có nghĩa là dồi dào, phong phú, đồng nghĩa với 'Plentiful'."
    },
    {
      q: "Choose the correct relative pronoun: 'The doctor _______ treated my father is very experienced.'",
      opts: ["who", "which", "whom", "whose"],
      c: 0,
      expl: "'The doctor' là danh từ chỉ người làm chủ ngữ của mệnh đề quan hệ, do đó dùng đại từ quan hệ 'who'."
    },
    {
      q: "Complete the sentence: 'She is interested _______ learning new foreign languages.'",
      opts: ["in", "on", "at", "about"],
      c: 0,
      expl: "Cấu trúc cố định: to be interested in + V-ing / Noun (quan tâm, hứng thú với điều gì)."
    },
    {
      q: "Identify the correct comparative form: 'This task is _______ than that one.'",
      opts: ["more difficult", "difficulter", "most difficult", "as difficult"],
      c: 0,
      expl: "'Difficult' là tính từ dài có 3 âm tiết, dạng so sánh hơn là 'more difficult'."
    },
    {
      q: "Which tense expresses an action happening at the moment of speaking?",
      opts: ["Present Continuous", "Simple Present", "Present Perfect", "Past Continuous"],
      c: 0,
      expl: "Thì Hiện tại tiếp diễn (Present Continuous) diễn tả một hành động đang xảy ra tại thời điểm nói."
    },
    {
      q: "Choose the correct modal verb: 'You _______ wear a helmet when riding a motorbike. It is the law.'",
      opts: ["must", "might", "can", "should not"],
      c: 0,
      expl: "'Must' diễn tả nghĩa vụ hoặc quy định luật pháp bắt buộc phải tuân theo."
    },
    {
      q: "Select the opposite (antonym) of 'generous':",
      opts: ["Selfish / Stingy", "Kind", "Helpful", "Friendly"],
      c: 0,
      expl: "'Generous' (hào phóng, rộng lượng) có từ trái nghĩa là 'Selfish' (ích kỷ) hoặc 'Stingy' (keo kiệt)."
    }
  ];

  const BANK_LAW = [
    {
      q: "Theo Hiến pháp năm 2013, cơ quan nào là cơ quan đại biểu cao nhất của Nhân dân, cơ quan quyền lực nhà nước cao nhất của nước CHXHCN Việt Nam?",
      opts: ["Quốc hội", "Chính phủ", "Tòa án nhân dân tối cao", "Viện kiểm sát nhân dân tối cao"],
      c: 0,
      expl: "Điều 69 Hiến pháp 2013 quy định Quốc hội là cơ quan đại biểu cao nhất của Nhân dân, cơ quan quyền lực nhà nước cao nhất."
    },
    {
      q: "Cơ quan hành chính nhà nước cao nhất của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là cơ quan nào?",
      opts: ["Chính phủ", "Quốc hội", "Chủ tịch nước", "Bộ Nội vụ"],
      c: 0,
      expl: "Chính phủ là cơ quan hành chính nhà nước cao nhất, thực hiện quyền hành pháp và là cơ quan chấp hành của Quốc hội."
    },
    {
      q: "Theo quy định của pháp luật Việt Nam, công dân đủ bao nhiêu tuổi trở lên có quyền bầu cử đại biểu Quốc hội và Hội đồng nhân dân?",
      opts: ["Đủ 18 tuổi", "Đủ 16 tuổi", "Đủ 20 tuổi", "Đủ 21 tuổi"],
      c: 0,
      expl: "Công dân đủ 18 tuổi trở lên có quyền bầu cử và đủ 21 tuổi trở lên có quyền ứng cử theo quy định của Hiến pháp và Luật Bầu cử."
    },
    {
      q: "Cơ quan nào có thẩm quyền xét xử của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam, thực hiện quyền tư pháp?",
      opts: ["Tòa án nhân dân", "Viện kiểm sát nhân dân", "Công an nhân dân", "Thanh tra Chính phủ"],
      c: 0,
      expl: "Tòa án nhân dân là cơ quan xét xử của nước CHXHCN Việt Nam, thực hiện quyền tư pháp (Điều 102 Hiến pháp 2013)."
    },
    {
      q: "Hình thức dân chủ mà công dân trực tiếp bày tỏ ý chí của mình để quyết định những vấn đề quan trọng của đất nước gọi là gì?",
      opts: ["Trưng cầu ý dân (Dân chủ trực tiếp)", "Dân chủ đại diện", "Họp báo", "Đơn thư khiếu nại"],
      c: 0,
      expl: "Trưng cầu ý dân là hình thức dân chủ trực tiếp để nhân dân quyết định các vấn đề hệ trọng của quốc gia."
    }
  ];

  let selectedBank = [];
  if (normTopic.includes("sử") || normTopic.includes("lịch sử") || normTopic.includes("1945") || normTopic.includes("1975") || normTopic.includes("chiến tranh")) {
    selectedBank = BANK_HISTORY;
  } else if (normTopic.includes("tin") || normTopic.includes("it") || normTopic.includes("excel") || normTopic.includes("word") || normTopic.includes("office") || normTopic.includes("máy tính") || normTopic.includes("code")) {
    selectedBank = BANK_IT;
  } else if (normTopic.includes("anh") || normTopic.includes("english") || normTopic.includes("ngữ pháp") || normTopic.includes("từ vựng")) {
    selectedBank = BANK_ENGLISH;
  } else if (normTopic.includes("luật") || normTopic.includes("pháp luật") || normTopic.includes("hiến pháp") || normTopic.includes("gdcd") || normTopic.includes("ktc") || normTopic.includes("công dân")) {
    selectedBank = BANK_LAW;
  } else {
    selectedBank = [
      {
        q: `Khái niệm căn bản và mục tiêu cốt lõi của "${topic}" được định nghĩa chính xác nhất là gì?`,
        opts: [
          `Là tập hợp các nguyên lý, phương pháp và quy trình chuẩn mực được nghiên cứu và áp dụng vào thực tiễn trong lĩnh vực ${topic}.`,
          `Chỉ là một lý thuyết mang tính trừu tượng, không thể đo lường hoặc áp dụng vào đời sống.`,
          `Một tập hợp các quy định ngẫu nhiên không có tính hệ thống hoặc nền tảng học thuật.`,
          `Quy chuẩn kỹ thuật chỉ áp dụng cho máy tính và hệ thống cơ khí tự động.`
        ],
        c: 0,
        expl: `Trong khoa học và ứng dụng thực tiễn, ${topic} được xây dựng trên hệ thống các nguyên lý, quy chuẩn và phương pháp luận rõ ràng.`
      },
      {
        q: `Nguyên tắc nào sau đây giữ vai trò tiên quyết nhằm đảm bảo tính hiệu quả và bền vững khi nghiên cứu hoặc triển khai "${topic}"?`,
        opts: [
          `Tuân thủ các nguyên tắc khoa học, đo lường dữ liệu khách quan và kiểm chứng qua thực nghiệm.`,
          `Thực hiện hoàn toàn dựa trên cảm tính cá nhân mà không cần quy trình tiêu chuẩn.`,
          `Bỏ qua các bước kiểm tra an toàn và phân tích rủi ro để rút ngắn tối đa thời gian.`,
          `Chỉ áp dụng sao chép máy móc mô hình cũ mà không thích ứng với bối cảnh mới.`
        ],
        c: 0,
        expl: `Tính khoa học, kiểm chứng thực nghiệm và khả năng thích ứng linh hoạt là những tiêu chuẩn vàng trong lĩnh vực ${topic}.`
      },
      {
        q: `Một trong những sai lầm phổ biến cần tránh nhất khi tiếp cận và thực hiện "${topic}" là gì?`,
        opts: [
          `Đốt cháy giai đoạn, xem nhẹ nền tảng cơ bản và thiếu sự nhất quán trong phương pháp.`,
          `Nắm vững các thuật ngữ chuyên ngành và hiểu rõ logic vận hành của hệ thống.`,
          `Xây dựng kế hoạch chi tiết, có phân bổ mục tiêu rõ ràng theo từng giai đoạn.`,
          `Thường xuyên đánh giá định kỳ và tối ưu hóa quy trình dựa trên phản hồi thực tế.`
        ],
        c: 0,
        expl: `Việc thiếu kiến thức nền tảng và nôn nóng đốt cháy giai đoạn thường dẫn đến các sai sót nghiêm trọng và thiếu tính bền vững.`
      },
      {
        q: `Yếu tố then chốt tạo nên sự khác biệt vượt trội về chất lượng khi đánh giá kết quả của "${topic}" là gì?`,
        opts: [
          `Độ chính xác, tính ứng dụng thực tế cao và khả năng giải quyết triệt để vấn đề đặt ra.`,
          `Sự phức tạp hóa vấn đề không cần thiết khiến người dùng khó tiếp cận.`,
          `Số lượng đầu việc lớn nhưng không mang lại giá trị gia tăng cụ thể.`,
          `Thời gian kéo dài vô thời hạn mà không có thước đo kết quả cụ thể.`
        ],
        c: 0,
        expl: `Giá trị cốt lõi của mọi giải pháp trong ${topic} luôn nằm ở tính ứng dụng thực tiễn và hiệu quả giải quyết vấn đề.`
      },
      {
        q: `Để nâng cao năng lực chuyên môn và tối ưu hóa kỹ năng trong "${topic}", bước hành động nào được các chuyên gia khuyên dùng?`,
        opts: [
          `Liên tục cập nhật kiến thức mới, thực hành thường xuyên và rút kinh nghiệm từ các tình huống thực tế.`,
          `Chỉ dựa vào kinh nghiệm cá nhân sẵn có mà không tiếp thu xu hướng phát triển mới.`,
          `Hạn chế trao đổi và cô lập kiến thức với cộng đồng chuyên gia.`,
          `Chỉ tập trung vào lý thuyết trên sách vở và tránh các bài tập thực hành ứng dụng.`
        ],
        c: 0,
        expl: `Học đi đôi với hành, liên tục cập nhật đổi mới là chìa khóa để làm chủ kiến thức và kỹ năng trong ${topic}.`
      }
    ];
  }

  const resultQuestions = [];
  const total = Math.min(count, 30);
  const letters = ["A", "B", "C", "D"];

  for (let i = 0; i < total; i++) {
    const item = selectedBank[i % selectedBank.length];
    const optLines = item.opts.map((opt, oIdx) => {
      const isCorrect = oIdx === item.c;
      return `${isCorrect ? "*" : ""}${letters[oIdx]}. ${opt}`;
    });

    let qBlock = `Câu ${i + 1}: ${item.q}\n` + optLines.join("\n");
    if (hasExpl && item.expl) {
      qBlock += `\nGiải thích: ${item.expl}`;
    }
    resultQuestions.push(qBlock);
  }

  return resultQuestions.join("\n\n");
}

// Xử lý tạo đề Offline tức thì (Không cần Gemini API Key)
function handleGenerateExamOffline() {
  const topicInput = document.getElementById("ai-gen-topic");
  const countSelect = document.getElementById("ai-gen-count");
  const levelSelect = document.getElementById("ai-gen-level");
  const explCheck = document.getElementById("ai-gen-explanation");

  const topic = (topicInput ? topicInput.value : "").trim() || "Kiến thức tổng hợp";
  const count = parseInt(countSelect ? countSelect.value : 10) || 10;
  const level = levelSelect ? levelSelect.value : "Cân bằng mọi mức độ";
  const hasExpl = explCheck ? explCheck.checked : true;

  try {
    const generatedText = generateOfflineQuestions(topic, count, level, hasExpl);
    applyGeneratedQuizToCreator(topic, generatedText, count, false);
  } catch (err) {
    console.error("Offline Exam Generator error:", err);
    showToast(`Lỗi tạo đề offline: ${err.message || err}`, "danger");
  }
}

// Xử lý tạo đề thi bằng AI Google Gemini
async function handleGenerateExamWithAi() {
  const topicInput = document.getElementById("ai-gen-topic");
  const countSelect = document.getElementById("ai-gen-count");
  const levelSelect = document.getElementById("ai-gen-level");
  const explCheck = document.getElementById("ai-gen-explanation");
  const keyInput = document.getElementById("ai-gen-key-input");
  const progressBox = document.getElementById("ai-gen-progress-box");
  const btnSubmit = document.getElementById("btn-submit-ai-generator");
  const statusText = document.getElementById("ai-gen-status-text");

  const topic = (topicInput ? topicInput.value : "").trim();
  if (!topic) {
    showToast("Vui lòng nhập chủ đề hoặc yêu cầu đề thi cần tạo!", "warning");
    if (topicInput) topicInput.focus();
    return;
  }

  let apiKey = getSavedGeminiKey();
  if (!apiKey && keyInput && keyInput.value.trim()) {
    apiKey = keyInput.value.trim();
    setSavedGeminiKey(apiKey);
  }

  if (!apiKey) {
    const keyContainer = document.getElementById("ai-gen-key-container");
    if (keyContainer) keyContainer.style.display = "block";
    showToast("Vui lòng nhập Google Gemini API Key hoặc bấm nút '⚡ Sinh Đề Mẫu Offline' bên dưới!", "warning");
    if (keyInput) keyInput.focus();
    return;
  }

  const count = parseInt(countSelect ? countSelect.value : 10) || 10;
  const level = levelSelect ? levelSelect.value : "Cân bằng mọi mức độ";
  const hasExpl = explCheck ? explCheck.checked : true;

  // Cập nhật model từ lựa chọn trong Modal AI Sinh Đề
  const genModelSelect = document.getElementById("ai-gen-model-select");
  const genCustomInput = document.getElementById("ai-gen-custom-model-input");
  if (genModelSelect) {
    let chosen = genModelSelect.value;
    if (chosen === "custom" && genCustomInput && genCustomInput.value.trim()) {
      chosen = genCustomInput.value.trim();
    }
    if (chosen && chosen !== "custom") {
      activeGeminiModel = chosen;
      setSavedGeminiModel(chosen);
    }
  }

  const modelName = activeGeminiModel || getSavedGeminiModel();

  if (progressBox) progressBox.style.display = "block";
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span>⏳ Đang sinh đề thi (${modelName})...</span>`;
  }
  if (statusText) statusText.textContent = `Google AI (${modelName}) đang tư duy và biên soạn ${count} câu hỏi trắc nghiệm...`;

  const promptText = `Bạn là một chuyên gia sư phạm và chuyên gia biên soạn đề thi trắc nghiệm học đường & kỳ thi chuẩn hóa.
Nhiệm vụ của bạn là: TẠO BỘ ĐỀ THI TRẮC NGHIỆM GỒM ĐÚNG ${count} CÂU HỎI CHẤT LƯỢNG CAO về chủ đề: "${topic}".
Mức độ phân hóa: ${level}.
${hasExpl ? "Yêu cầu: Có kèm theo phần giải thích chi tiết cho từng câu hỏi." : ""}

QUY TẮC ĐỊNH DẠNG BẮT BUỘC ĐỂ HỆ THỐNG TỰ ĐỘNG PARSE:
1. Mỗi câu hỏi bắt đầu bằng "Câu [Số]: [Nội dung câu hỏi]".
2. Mỗi câu hỏi BẮT BUỘC có đúng 4 lựa chọn: A. ..., B. ..., C. ..., D. ... nằm trên các dòng riêng biệt.
3. BẮT BUỘC đặt duy nhất một dấu sao (*) ngay sát trước chữ cái đáp án ĐÚNG (ví dụ: *A. [Nội dung] hoặc *B. [Nội dung] hoặc *C. [Nội dung] hoặc *D. [Nội dung]).
4. 3 phương án còn lại KHÔNG có dấu * (ví dụ: B. [Nội dung], C. [Nội dung], D. [Nội dung]).
5. ${hasExpl ? "Dưới 4 phương án là dòng 'Giải thích: [Lời giải chi tiết, rõ ràng, dễ hiểu]'" : ""}
6. Giữa các câu hỏi cách nhau bởi một dòng trống.

Ví dụ mẫu chuẩn:
Câu 1: Thủ đô của Việt Nam là thành phố nào?
*A. Hà Nội
B. Đà Nẵng
C. TP. Hồ Chí Minh
D. Cần Thơ
Giải thích: Hà Nội là thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.

(TUYỆT ĐỐI CHỈ XUẤT NỘI DUNG ĐỀ THI THEO CẤU TRÚC TRÊN. Không xuất bất kỳ lời chào, lời mở đầu, kết luận hay chú thích nào khác).`;

  try {
    const rawAiOutput = await executeSingleGeminiRequest(promptText, apiKey);
    if (!rawAiOutput || !rawAiOutput.trim()) {
      throw new Error("Không nhận được phản hồi hợp lệ từ AI Gemini.");
    }

    applyGeneratedQuizToCreator(topic, rawAiOutput, count, true);
  } catch (err) {
    console.error("AI Exam Generator error:", err);
    showToast(`Lỗi tạo đề AI: ${err.message || err}`, "danger");
  } finally {
    if (progressBox) progressBox.style.display = "none";
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        🚀 Bắt đầu Tạo Đề Bằng AI Gemini
      `;
    }
  }
}

// =============================================================================
// TINDER-STYLE FLASHCARD TOUCH / MOUSE SWIPE ENGINE
// =============================================================================
let flashcardSwipeState = {
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  draggedDistance: 0
};

function initFlashcardTinderSwipe() {
  const card = document.getElementById("flashcard-element");
  if (!card) return;

  const stampRight = document.getElementById("flashcard-stamp-right");
  const stampLeft = document.getElementById("flashcard-stamp-left");

  function onPointerDown(e) {
    if (e.target.closest("button") || e.target.closest(".flashcard-action-bar")) return;
    flashcardSwipeState.isDragging = true;
    flashcardSwipeState.startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    flashcardSwipeState.startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    flashcardSwipeState.currentX = flashcardSwipeState.startX;
    flashcardSwipeState.currentY = flashcardSwipeState.startY;
    flashcardSwipeState.draggedDistance = 0;

    card.classList.remove("flashcard-reset-pos", "flashcard-swiping-right", "flashcard-swiping-left");
  }

  function onPointerMove(e) {
    if (!flashcardSwipeState.isDragging) return;
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    const dx = clientX - flashcardSwipeState.startX;
    const dy = clientY - flashcardSwipeState.startY;
    flashcardSwipeState.draggedDistance = Math.hypot(dx, dy);

    if (flashcardSwipeState.draggedDistance > 10 && e.cancelable && e.type.startsWith("touch")) {
      e.preventDefault();
    }

    const rotation = dx * 0.08;
    card.style.transform = `translate3d(${dx}px, ${dy * 0.25}px, 0) rotate(${rotation}deg)`;

    if (dx > 20) {
      const opacity = Math.min(1, (dx - 20) / 90);
      if (stampRight) stampRight.style.opacity = opacity;
      if (stampLeft) stampLeft.style.opacity = 0;
    } else if (dx < -20) {
      const opacity = Math.min(1, (-dx - 20) / 90);
      if (stampLeft) stampLeft.style.opacity = opacity;
      if (stampRight) stampRight.style.opacity = 0;
    } else {
      if (stampRight) stampRight.style.opacity = 0;
      if (stampLeft) stampLeft.style.opacity = 0;
    }
  }

  function onPointerUp(e) {
    if (!flashcardSwipeState.isDragging) return;
    flashcardSwipeState.isDragging = false;
    const dx = (e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || flashcardSwipeState.currentX) - flashcardSwipeState.startX;

    if (stampRight) stampRight.style.opacity = 0;
    if (stampLeft) stampLeft.style.opacity = 0;

    const SWIPE_THRESHOLD = 95;
    if (dx > SWIPE_THRESHOLD) {
      card.classList.add("flashcard-swiping-right");
      playSfx("correct");
      setTimeout(() => {
        card.style.transform = "";
        card.classList.remove("flashcard-swiping-right");
        markFlashcardMastered();
      }, 320);
    } else if (dx < -SWIPE_THRESHOLD) {
      card.classList.add("flashcard-swiping-left");
      playSfx("wrong");
      setTimeout(() => {
        card.style.transform = "";
        card.classList.remove("flashcard-swiping-left");
        markFlashcardNeedReview();
      }, 320);
    } else {
      card.classList.add("flashcard-reset-pos");
      card.style.transform = "";

      if (flashcardSwipeState.draggedDistance < 10) {
        flipFlashcard();
      }
    }
  }

  card.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);

  card.addEventListener("touchstart", onPointerDown, { passive: false });
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp);
}

// =============================================================================
// ZEN MODE 2.0 OFFLINE AMBIENT SOUND SYNTHESIZER (WEB AUDIO API)
// =============================================================================
let zenAudioCtx = null;
let zenMasterGain = null;
let currentZenSoundType = "off";
let activeZenAudioNodes = [];

function initZenAudioContext() {
  if (!zenAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    zenAudioCtx = new AudioContextClass();
    zenMasterGain = zenAudioCtx.createGain();
    zenMasterGain.gain.setValueAtTime(0.5, zenAudioCtx.currentTime);
    zenMasterGain.connect(zenAudioCtx.destination);
  }
  if (zenAudioCtx.state === "suspended") {
    zenAudioCtx.resume();
  }
  return zenAudioCtx;
}

function stopCurrentZenSound() {
  if (activeZenAudioNodes && activeZenAudioNodes.length > 0) {
    activeZenAudioNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    activeZenAudioNodes = [];
  }
  currentZenSoundType = "off";
  updateZenUi("off");
}

function setZenAmbientSound(type) {
  const ctx = initZenAudioContext();
  if (!ctx) return;

  stopCurrentZenSound();

  if (type === "off") {
    return;
  }

  currentZenSoundType = type;

  if (type === "rain") {
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(zenMasterGain);
    whiteNoise.start(0);

    activeZenAudioNodes.push(whiteNoise, filter);
  } else if (type === "waves") {
    const bufferSize = ctx.sampleRate * 5;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 1.4;
    }

    const brownNoise = ctx.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = "lowpass";
    waveFilter.frequency.setValueAtTime(380, ctx.currentTime);

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.4, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.13, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.35, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    brownNoise.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(zenMasterGain);

    brownNoise.start(0);
    lfo.start(0);

    activeZenAudioNodes.push(brownNoise, waveFilter, waveGain, lfo, lfoGain);
  } else if (type === "alpha") {
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(432, ctx.currentTime);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(472, ctx.currentTime);

    const alphaGain = ctx.createGain();
    alphaGain.gain.setValueAtTime(0.12, ctx.currentTime);

    osc1.connect(alphaGain);
    osc2.connect(alphaGain);
    alphaGain.connect(zenMasterGain);

    osc1.start(0);
    osc2.start(0);

    activeZenAudioNodes.push(osc1, osc2, alphaGain);
  } else if (type === "whitenoise") {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.08;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(zenMasterGain);
    whiteNoise.start(0);

    activeZenAudioNodes.push(whiteNoise, filter);
  }

  updateZenUi(type);
  showToast(`🎧 Đang phát âm thanh Zen Mode: ${getZenSoundTitle(type)}`, "info");
}

function getZenSoundTitle(type) {
  switch (type) {
    case "rain": return "Mưa rơi êm đềm";
    case "waves": return "Sóng biển dạt dào";
    case "alpha": return "Sóng não Alpha 40Hz";
    case "whitenoise": return "Tiếng ồn trắng tĩnh lặng";
    default: return "Tắt âm";
  }
}

function updateZenUi(type) {
  const label = document.getElementById("zen-ambient-label");
  const icon = document.getElementById("zen-ambient-icon");
  const btnAmbient = document.getElementById("btn-zen-ambient");

  if (type === "off") {
    if (label) label.textContent = "Zen Âm Thanh";
    if (icon) icon.textContent = "🎧";
    if (btnAmbient) btnAmbient.classList.remove("active");
  } else {
    if (label) label.textContent = getZenSoundTitle(type);
    if (icon) {
      if (type === "rain") icon.textContent = "🌧️";
      else if (type === "waves") icon.textContent = "🌊";
      else if (type === "alpha") icon.textContent = "🧠";
      else icon.textContent = "☕";
    }
    if (btnAmbient) btnAmbient.classList.add("active");
  }

  document.querySelectorAll(".zen-opt-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-sound") === type);
  });
}

function setZenAmbientVolume(volume) {
  if (zenMasterGain && zenAudioCtx) {
    const val = Math.max(0, Math.min(1, parseFloat(volume) || 0.5));
    zenMasterGain.gain.setValueAtTime(val, zenAudioCtx.currentTime);
  }
}

// Expose v3.1 functions to window
window.printQuizById = printQuizById;
window.printQuizPaper = printQuizPaper;
window.printCurrentResult = printCurrentResult;
window.toggleZenMode = toggleZenMode;
window.removeMistakeFromVault = removeMistakeFromVault;
window.clearMistakeVault = clearMistakeVault;
window.startPracticeMistakeVault = startPracticeMistakeVault;
window.fireNeonConfetti = fireNeonConfetti;

// Expose AI Audit Diff Review functions to window
window.setAuditedQuestionAnswer = setAuditedQuestionAnswer;
window.revertSingleAiQuestion = revertSingleAiQuestion;
window.revertAllAiAudit = revertAllAiAudit;
window.acceptAllAiAudit = acceptAllAiAudit;
window.processAndShowAiAuditDiff = processAndShowAiAuditDiff;

// Expose Export & Flashcard & Analytics functions to window
window.exportQuizDocxById = exportQuizDocxById;
window.exportCurrentResultDocx = exportCurrentResultDocx;
window.flipFlashcard = flipFlashcard;
window.markFlashcardMastered = markFlashcardMastered;
window.markFlashcardNeedReview = markFlashcardNeedReview;
window.toggleSoundSetting = toggleSoundSetting;
window.openAnalyticsModal = openAnalyticsModal;
window.closeAnalyticsModal = closeAnalyticsModal;
window.openShortcutsModal = openShortcutsModal;
window.closeShortcutsModal = closeShortcutsModal;

// Expose v3.3 functions to window
window.openMultiCodeModal = openMultiCodeModal;
window.closeMultiCodeModal = closeMultiCodeModal;
window.updateMultiCodePreviewBadges = updateMultiCodePreviewBadges;
window.saveMultiCodeToLibrary = saveMultiCodeToLibrary;
window.exportMultiCodeDocx = exportMultiCodeDocx;
window.toggleStickyNoteDrawer = toggleStickyNoteDrawer;
window.appendQuickTagToNote = appendQuickTagToNote;
window.getQuestionDifficulty = getQuestionDifficulty;
window.setAutoAdvanceSetting = setAutoAdvanceSetting;
window.cancelAutoAdvance = cancelAutoAdvance;
window.autoDetectAndLinkAnswers = autoDetectAndLinkAnswers;

// Expose v3.7 functions to window
window.isShortcutsEnabled = isShortcutsEnabled;
window.setShortcutsEnabled = setShortcutsEnabled;
window.openGeminiKeyModal = openGeminiKeyModal;
window.removeOcrImage = removeOcrImage;
window.runAiImageOcr = runAiImageOcr;
window.setupAiImageOcr = setupAiImageOcr;

// Expose v4.0 functions to window
window.resetCreatorForm = resetCreatorForm;
window.openAiGeneratorModal = openAiGeneratorModal;
window.closeAiGeneratorModal = closeAiGeneratorModal;
window.handleGenerateExamWithAi = handleGenerateExamWithAi;
window.handleGenerateExamOffline = handleGenerateExamOffline;
window.setZenAmbientSound = setZenAmbientSound;
window.setZenAmbientVolume = setZenAmbientVolume;

// =============================================================================
// TÍNH NĂNG #4: CHIA SẺ ĐỀ THI TRỰC TIẾP QUA URL LINK (DEFLATE / BASE64URL)
// =============================================================================

let currentShareQuiz = null;
let currentShareUrl = "";
let receivedSharedQuiz = null;

function bytesToBase64Url(bytes) {
  let bin = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(base64url) {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function compressQuizForShare(quiz) {
  const compact = {
    v: 1,
    t: quiz.title || "Đề thi trắc nghiệm",
    d: quiz.description || "",
    c: quiz.category || "Chung",
    m: Number(quiz.timeLimit) || 15,
    q: (quiz.questions || []).map(q => ({
      x: q.text || "",
      o: q.options || [],
      a: q.correctIndex !== undefined ? q.correctIndex : 0,
      e: q.explanation || "",
      i: (q.image && !q.image.startsWith("data:")) ? q.image : ""
    }))
  };
  const jsonStr = JSON.stringify(compact);

  try {
    if (typeof CompressionStream !== "undefined") {
      const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream("deflate"));
      const buffer = await new Response(stream).arrayBuffer();
      return "z." + bytesToBase64Url(new Uint8Array(buffer));
    }
  } catch (err) {
    console.warn("Deflate compression fallback:", err);
  }

  const utf8Bytes = new TextEncoder().encode(jsonStr);
  return "b." + bytesToBase64Url(utf8Bytes);
}

async function decompressQuizFromShare(payload) {
  if (!payload) throw new Error("Mã đề thi chia sẻ không hợp lệ hoặc đã bị cắt ngắn.");

  let jsonStr = "";
  if (payload.startsWith("z.")) {
    const raw = payload.slice(2);
    const bytes = base64UrlToBytes(raw);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    jsonStr = await new Response(stream).text();
  } else if (payload.startsWith("b.")) {
    const raw = payload.slice(2);
    const bytes = base64UrlToBytes(raw);
    jsonStr = new TextDecoder().decode(bytes);
  } else {
    const bytes = base64UrlToBytes(payload);
    jsonStr = new TextDecoder().decode(bytes);
  }

  const compact = JSON.parse(jsonStr);
  return {
    id: "quiz_shared_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    title: compact.t || "Đề thi được chia sẻ",
    description: compact.d || "Được chia sẻ qua liên kết trực tiếp",
    category: compact.c || "Chung",
    timeLimit: Number(compact.m) || 15,
    questions: (compact.q || []).map((q, idx) => ({
      id: idx + 1,
      text: q.x || "",
      options: q.o || [],
      correctIndex: q.a !== undefined ? q.a : 0,
      explanation: q.e || "",
      image: q.i || ""
    }))
  };
}

async function openShareQuizModal(quizId, event) {
  if (event) {
    if (typeof event.stopPropagation === "function") event.stopPropagation();
    if (typeof event.preventDefault === "function") event.preventDefault();
  }
  const quiz = AppState.quizzes.find(q => String(q.id) === String(quizId));
  if (!quiz) {
    showToast("Không tìm thấy bộ đề thi!", "warning");
    return;
  }
  currentShareQuiz = quiz;

  const modal = document.getElementById("modal-share-quiz");
  if (!modal) return;

  // Set quiz info
  const titleEl = document.getElementById("share-modal-quiz-title");
  const badgeEl = document.getElementById("share-modal-badge");
  const countEl = document.getElementById("share-modal-q-count");
  const durEl = document.getElementById("share-modal-duration");
  const statusText = document.getElementById("share-copy-status-text");
  const urlInput = document.getElementById("input-share-quiz-url");
  const sizeBadge = document.getElementById("share-url-size-badge");

  if (titleEl) titleEl.textContent = quiz.title;
  if (badgeEl) badgeEl.textContent = quiz.category || "Chung";
  if (countEl) countEl.textContent = (quiz.questions || []).length;
  if (durEl) durEl.textContent = quiz.timeLimit || 15;
  if (statusText) statusText.style.display = "none";
  if (urlInput) urlInput.value = "Đang tạo liên kết chia sẻ...";

  modal.classList.add("open");

  try {
    const payload = await compressQuizForShare(quiz);
    // Nếu mở file cục bộ (file:///C:/Users...) hoặc localhost, dùng link online GitHub Pages để bạn bè mở được qua Internet
    let baseUrl = window.location.origin + window.location.pathname;
    const isLocalHostOrFile = !window.location.origin || 
                              window.location.origin === "null" || 
                              window.location.protocol === "file:" ||
                              window.location.hostname === "localhost" ||
                              window.location.hostname === "127.0.0.1" ||
                              window.location.hostname.startsWith("192.168.");
    if (isLocalHostOrFile) {
      baseUrl = "https://cpham26.github.io/web-thi-trac-nghiem/";
    }
    currentShareUrl = baseUrl + "#share=" + payload;
    if (urlInput) {
      urlInput.value = currentShareUrl;
      urlInput.focus();
      urlInput.select();
    }

    if (sizeBadge) {
      const kb = (currentShareUrl.length / 1024).toFixed(1);
      sizeBadge.textContent = `Độ dài URL: ${currentShareUrl.length} ký tự (~${kb} KB)`;
    }
  } catch (err) {
    console.error("Lỗi tạo link chia sẻ:", err);
    showToast("Không thể tạo liên kết chia sẻ cho bộ đề này.", "danger");
    if (urlInput) urlInput.value = "Lỗi khi tạo liên kết.";
  }
}

function closeShareQuizModal() {
  const modal = document.getElementById("modal-share-quiz");
  if (modal) modal.classList.remove("open");
}

async function copyShareUrlToClipboard() {
  if (!currentShareUrl) return;
  try {
    await navigator.clipboard.writeText(currentShareUrl);
    showToast("Đã sao chép liên kết chia sẻ vào bộ nhớ đệm!", "success");
    const statusText = document.getElementById("share-copy-status-text");
    if (statusText) {
      statusText.style.display = "inline";
      setTimeout(() => { statusText.style.display = "none"; }, 3000);
    }
  } catch (err) {
    const input = document.getElementById("input-share-quiz-url");
    if (input) {
      input.focus();
      input.select();
      document.execCommand("copy");
      showToast("Đã sao chép liên kết vào bộ nhớ tạm!", "success");
    }
  }
}

async function triggerNativeShare() {
  if (!currentShareQuiz || !currentShareUrl) return;
  if (navigator.share) {
    try {
      await navigator.share({
        title: currentShareQuiz.title + " - NovaQuiz",
        text: `Mời bạn làm thử đề thi "${currentShareQuiz.title}" (${(currentShareQuiz.questions || []).length} câu - ${currentShareQuiz.timeLimit || 15} phút):`,
        url: currentShareUrl
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        copyShareUrlToClipboard();
      }
    }
  } else {
    copyShareUrlToClipboard();
  }
}

async function checkSharedQuizFromUrl() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#share=")) return;

  const payload = hash.slice(7);
  if (!payload) return;

  try {
    const quiz = await decompressQuizFromShare(payload);
    receivedSharedQuiz = quiz;

    const modal = document.getElementById("modal-received-quiz");
    if (!modal) return;

    const titleEl = document.getElementById("received-modal-title");
    const descEl = document.getElementById("received-modal-desc");
    const catEl = document.getElementById("received-modal-category");
    const countEl = document.getElementById("received-modal-count");
    const timeEl = document.getElementById("received-modal-time");
    const previewList = document.getElementById("received-modal-preview-list");

    if (titleEl) titleEl.textContent = quiz.title;
    if (descEl) descEl.textContent = quiz.description || "Bộ đề được chia sẻ qua liên kết trực tiếp.";
    if (catEl) catEl.textContent = quiz.category || "Chung";
    if (countEl) countEl.textContent = `${(quiz.questions || []).length} câu`;
    if (timeEl) timeEl.textContent = `${quiz.timeLimit || 15} phút`;

    if (previewList) {
      const sample = (quiz.questions || []).slice(0, 3);
      previewList.innerHTML = sample.map((q, idx) => `
        <div style="background: var(--bg-card); padding: 0.6rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); font-size: 0.825rem; line-height: 1.4;">
          <strong style="color: var(--primary);">Câu ${idx + 1}:</strong> ${escapeHtml(q.text ? q.text.substring(0, 110) : "")}${q.text && q.text.length > 110 ? "..." : ""}
        </div>
      `).join("");
      if ((quiz.questions || []).length > 3) {
        previewList.innerHTML += `<div style="text-align: center; font-size: 0.78rem; color: var(--text-muted); font-style: italic; margin-top: 2px;">... và còn ${(quiz.questions || []).length - 3} câu hỏi khác</div>`;
      }
    }

    modal.classList.add("open");
  } catch (err) {
    console.error("Lỗi đọc đề thi từ liên kết:", err);
    showToast("Không thể tải đề thi từ liên kết chia sẻ. Đường dẫn có thể đã bị thiếu ký tự!", "danger");
  }
}

function saveReceivedQuizToLibrary() {
  if (!receivedSharedQuiz) return;
  const quiz = receivedSharedQuiz;
  const existing = AppState.quizzes.find(q => q.title === quiz.title && q.questions.length === quiz.questions.length);
  if (!existing) {
    AppState.quizzes.unshift(quiz);
    saveQuizzes();
    renderDashboard();
    showToast(`Đã thêm bộ đề "${quiz.title}" vào thư viện thành công!`, "success");
  } else {
    showToast(`Bộ đề "${quiz.title}" đã có sẵn trong thư viện của bạn!`, "info");
  }
  history.replaceState(null, "", window.location.pathname + window.location.search);
  const modal = document.getElementById("modal-received-quiz");
  if (modal) modal.classList.remove("open");
}

function startReceivedQuiz(mode = "EXAM") {
  if (!receivedSharedQuiz) return;
  const quiz = receivedSharedQuiz;
  const existing = AppState.quizzes.find(q => q.title === quiz.title && q.questions.length === quiz.questions.length);
  const targetId = existing ? existing.id : quiz.id;
  if (!existing) {
    AppState.quizzes.unshift(quiz);
    saveQuizzes();
    renderDashboard();
  }
  history.replaceState(null, "", window.location.pathname + window.location.search);
  const modal = document.getElementById("modal-received-quiz");
  if (modal) modal.classList.remove("open");

  openSetupModal(targetId, mode);
}

// Expose Feature #4 functions to window
window.openShareQuizModal = openShareQuizModal;
window.closeShareQuizModal = closeShareQuizModal;
window.copyShareUrlToClipboard = copyShareUrlToClipboard;
window.triggerNativeShare = triggerNativeShare;
window.checkSharedQuizFromUrl = checkSharedQuizFromUrl;
window.saveReceivedQuizToLibrary = saveReceivedQuizToLibrary;
window.startReceivedQuiz = startReceivedQuiz;


