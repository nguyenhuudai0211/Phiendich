const btnVi = document.getElementById("btn-vi");
const btnEn = document.getElementById("btn-en");
const btnTestAudio = document.getElementById("btn-test-audio");
const btnTheme = document.getElementById("btn-theme");
const btnClear = document.getElementById("btn-clear");
const btnTypeToggle = document.getElementById("btn-type-toggle");
const btnSettings = document.getElementById("btn-settings");
const engineBadge = document.getElementById("engine-badge");

const typeBar = document.getElementById("type-bar");
const typeDir = document.getElementById("type-dir");
const typeInput = document.getElementById("type-input");
const btnTypeSend = document.getElementById("btn-type-send");
const quickBar = document.getElementById("quick-bar");

const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const chatList = document.getElementById("chat-list");
const livePreview = document.getElementById("live-preview");

// Settings Modal
const settingsModal = document.getElementById("settings-modal");
const modalBackdrop = document.getElementById("modal-backdrop");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnSaveSettings = document.getElementById("btn-save-settings");
const geminiKeyInput = document.getElementById("gemini-key-input");
const speedButtons = document.querySelectorAll("#speed-selector button");

// Zoom Modal
const zoomModal = document.getElementById("zoom-modal");
const btnCloseZoom = document.getElementById("btn-close-zoom");
const zoomOriginal = document.getElementById("zoom-original");
const zoomTranslated = document.getElementById("zoom-translated");
const btnZoomSpeak = document.getElementById("btn-zoom-speak");

let activeDirection = null;
let selectedRate = SpeechModule.speechRate;
let zoomPayload = { text: "", lang: "en-US" };

// Theme Management (Light / Dark)
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  btnTheme.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("phiendich_theme", theme);
}

applyTheme(localStorage.getItem("phiendich_theme") || "light");

btnTheme.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

function updateEngineBadge() {
  if (Translator.getGeminiKey()) {
    engineBadge.textContent = "✨ AI Pro";
    engineBadge.classList.add("pro");
  } else {
    engineBadge.textContent = "⚡ Nhanh";
    engineBadge.classList.remove("pro");
  }
}

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusBar.className = `status-bar ${type}`.trim();
}

function resetButtons() {
  btnVi.classList.remove("recording");
  btnEn.classList.remove("recording");
  livePreview.classList.add("hidden");
  livePreview.textContent = "";
  activeDirection = null;
}

function openZoom(orig, trans, langCode) {
  zoomOriginal.textContent = orig;
  zoomTranslated.textContent = trans;
  zoomPayload = { text: trans, lang: langCode };
  zoomModal.classList.remove("hidden");
}

function addCard(originalText, translatedText, fromLang, targetSpeechLang, metaInfo) {
  const empty = chatList.querySelector(".empty-state");
  if (empty) empty.remove();

  const card = document.createElement("div");
  card.className = `card ${fromLang === "en" ? "from-en" : "from-vi"}`;

  const top = document.createElement("div");
  top.className = "card-top";

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.textContent = fromLang === "vi" ? "Tiếng Việt → Tiếng Anh" : "Tiếng Anh → Tiếng Việt";

  const speedTag = document.createElement("span");
  speedTag.className = "card-speed";
  const sec = metaInfo.ms === 0 ? "Tức thì" : `${(metaInfo.ms / 1000).toFixed(2)}s`;
  speedTag.textContent = `${metaInfo.engine === "AI" ? "✨ AI" : "⚡"} ${sec}`;
  top.append(meta, speedTag);

  const origEl = document.createElement("div");
  origEl.className = "card-original";
  origEl.textContent = originalText;

  const transEl = document.createElement("div");
  transEl.className = "card-translated";
  transEl.textContent = translatedText;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const replayBtn = document.createElement("button");
  replayBtn.className = "btn-replay";
  replayBtn.textContent = fromLang === "vi" ? "🔊 Đọc Tiếng Anh" : "🔊 Đọc Tiếng Việt";
  replayBtn.addEventListener("click", () => {
    SpeechModule.speak(translatedText, targetSpeechLang, {
      onStart: () => setStatus("🔊 Đang phát loa...", "speaking"),
      onDone: () => setStatus("Sẵn sàng — Chạm nút bên dưới để nói"),
      onError: (msg) => setStatus(msg, "error"),
    });
  });

  const zoomBtn = document.createElement("button");
  zoomBtn.className = "btn-mini";
  zoomBtn.textContent = "🔍";
  zoomBtn.title = "Phóng to toàn màn hình";
  zoomBtn.addEventListener("click", () => openZoom(originalText, translatedText, targetSpeechLang));

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn-mini";
  copyBtn.textContent = "📋";
  copyBtn.title = "Sao chép";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
      copyBtn.textContent = "✅";
      setTimeout(() => (copyBtn.textContent = "📋"), 1200);
    } catch (_) {}
  });

  actions.append(replayBtn, zoomBtn, copyBtn);
  card.append(top, origEl, transEl, actions);
  chatList.appendChild(card);
  chatList.scrollTop = chatList.scrollHeight;
}

async function processTranslation(spokenText, direction) {
  const isViToEn = direction === "vi-en";
  const fromLang = isViToEn ? "vi" : "en";
  const toLang = isViToEn ? "en" : "vi";
  const outputSpeechLang = isViToEn ? "en-US" : "vi-VN";

  setStatus("⚡ Đang dịch...", "listening");
  try {
    const result = await Translator.translate(spokenText, fromLang, toLang);
    addCard(spokenText, result.text, fromLang, outputSpeechLang, result);

    SpeechModule.speak(result.text, outputSpeechLang, {
      onStart: () =>
        setStatus(
          isViToEn ? "🔊 Đang phát loa Tiếng Anh..." : "🔊 Đang phát loa Tiếng Việt...",
          "speaking"
        ),
      onDone: () => setStatus("Sẵn sàng — Chạm nút bên dưới để nói"),
      onError: (msg) => setStatus(msg, "error"),
    });
  } catch (err) {
    setStatus(err.message, "error");
  }
}

function handleMicClick(direction) {
  SpeechModule.unlockAudio();

  if (SpeechModule.isListening && activeDirection === direction) {
    SpeechModule.stopListening();
    resetButtons();
    setStatus("Đã dừng nghe.");
    return;
  }

  const isViToEn = direction === "vi-en";
  const inputSpeechLang = isViToEn ? "vi-VN" : "en-US";

  resetButtons();
  activeDirection = direction;
  (isViToEn ? btnVi : btnEn).classList.add("recording");
  setStatus(
    isViToEn ? "🎙️ Đang nghe Tiếng Việt..." : "🎙️ Listening English...",
    "listening"
  );

  SpeechModule.startListening(inputSpeechLang, {
    onInterim: (text) => {
      livePreview.textContent = `“${text}”`;
      livePreview.classList.remove("hidden");
    },
    onResult: (spokenText) => processTranslation(spokenText, direction),
    onError: (errMsg) => {
      setStatus(errMsg, "error");
      resetButtons();
    },
    onEnd: () => resetButtons(),
  });
}

// Listeners
btnVi.addEventListener("click", () => handleMicClick("vi-en"));
btnEn.addEventListener("click", () => handleMicClick("en-vi"));

quickBar.addEventListener("click", (e) => {
  const chip = e.target.closest(".quick-chip");
  if (!chip) return;
  SpeechModule.unlockAudio();
  processTranslation(chip.dataset.text, "vi-en");
});

btnTestAudio.addEventListener("click", () => {
  SpeechModule.unlockAudio();
  setStatus("🔊 Đang kiểm tra loa...", "speaking");
  SpeechModule.speak("Hello! The translator is ready.", "en-US", {
    onStart: () => setStatus("🔊 Loa đang phát Tiếng Anh...", "speaking"),
    onDone: () => setStatus("✅ Loa hoạt động tốt! Bấm nút bên dưới để dùng."),
    onError: (msg) => setStatus(msg, "error"),
  });
});

btnTypeToggle.addEventListener("click", () => {
  typeBar.classList.toggle("hidden");
  if (!typeBar.classList.contains("hidden")) typeInput.focus();
});

async function handleTypeSend() {
  const val = typeInput.value.trim();
  if (!val) return;
  SpeechModule.unlockAudio();
  typeInput.value = "";
  await processTranslation(val, typeDir.value);
}

btnTypeSend.addEventListener("click", handleTypeSend);
typeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleTypeSend();
});

btnClear.addEventListener("click", () => {
  SpeechModule.stopAllAudio();
  chatList.innerHTML = `
    <div class="empty-state">
      <div class="empty-halo">
        <img src="icon.svg" alt="Logo" class="empty-logo" width="80" height="80" />
      </div>
      <h2>Chạm để phiên dịch ngay</h2>
      <p>
        Bấm nút <strong class="c-red">ĐỎ</strong> để nói Tiếng Việt (loa phát Tiếng Anh).<br />
        Bấm nút <strong class="c-blue">XANH</strong> để nói Tiếng Anh (loa phát Tiếng Việt).
      </p>
      <div class="empty-tips">
        <span>⚡ Dịch tức thì</span>
        <span>🔊 Tự phát loa</span>
        <span>🔍 Phóng to chữ</span>
      </div>
    </div>
  `;
  setStatus("Sẵn sàng — Chạm nút bên dưới để nói");
});

// Zoom Modal Events
btnCloseZoom.addEventListener("click", () => zoomModal.classList.add("hidden"));
btnZoomSpeak.addEventListener("click", () => {
  SpeechModule.speak(zoomPayload.text, zoomPayload.lang);
});

// Settings Modal Events
function openSettings() {
  geminiKeyInput.value = Translator.getGeminiKey();
  selectedRate = SpeechModule.speechRate;
  speedButtons.forEach((btn) => {
    const r = parseFloat(btn.dataset.rate);
    btn.classList.toggle("active", Math.abs(r - selectedRate) < 0.05);
  });
  settingsModal.classList.remove("hidden");
}

btnSettings.addEventListener("click", openSettings);
btnCloseModal.addEventListener("click", () => settingsModal.classList.add("hidden"));
modalBackdrop.addEventListener("click", () => settingsModal.classList.add("hidden"));

speedButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    speedButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedRate = parseFloat(btn.dataset.rate);
  });
});

btnSaveSettings.addEventListener("click", () => {
  SpeechModule.setRate(selectedRate);
  Translator.setGeminiKey(geminiKeyInput.value);
  updateEngineBadge();
  settingsModal.classList.add("hidden");
  setStatus("✅ Đã lưu cài đặt!");
});

updateEngineBadge();
