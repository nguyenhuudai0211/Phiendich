const btnVi = document.getElementById("btn-vi");
const btnEn = document.getElementById("btn-en");
const btnSpeed = document.getElementById("btn-speed");
const btnClear = document.getElementById("btn-clear");
const btnTypeToggle = document.getElementById("btn-type-toggle");
const typeBar = document.getElementById("type-bar");
const typeDir = document.getElementById("type-dir");
const typeInput = document.getElementById("type-input");
const btnTypeSend = document.getElementById("btn-type-send");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const chatList = document.getElementById("chat-list");
const livePreview = document.getElementById("live-preview");

let activeDirection = null;

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

function addCard(originalText, translatedText, fromLang, targetSpeechLang) {
  const empty = chatList.querySelector(".empty-state");
  if (empty) empty.remove();

  const card = document.createElement("div");
  card.className = `card ${fromLang === "en" ? "from-en" : "from-vi"}`;

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.textContent = fromLang === "vi" ? "Tiếng Việt → Tiếng Anh" : "Tiếng Anh → Tiếng Việt";

  const origEl = document.createElement("div");
  origEl.className = "card-original";
  origEl.textContent = originalText;

  const transEl = document.createElement("div");
  transEl.className = "card-translated";
  transEl.textContent = translatedText;

  const replayBtn = document.createElement("button");
  replayBtn.className = "btn-replay";
  replayBtn.textContent =
    fromLang === "vi" ? "🔊 Đọc lại Tiếng Anh" : "🔊 Đọc lại Tiếng Việt";
  replayBtn.addEventListener("click", () => {
    SpeechModule.speak(translatedText, targetSpeechLang, {
      onStart: () => setStatus("🔊 Đang phát loa...", "speaking"),
      onDone: () => setStatus("Sẵn sàng — Bấm nút bên dưới để nói"),
    });
  });

  card.append(meta, origEl, transEl, replayBtn);
  chatList.appendChild(card);
  chatList.scrollTop = chatList.scrollHeight;
}

async function processTranslation(spokenText, direction) {
  const isViToEn = direction === "vi-en";
  const fromLang = isViToEn ? "vi" : "en";
  const toLang = isViToEn ? "en" : "vi";
  const outputSpeechLang = isViToEn ? "en-US" : "vi-VN";

  setStatus("⏳ Đang dịch...", "listening");
  try {
    const translated = await Translator.translate(spokenText, fromLang, toLang);
    addCard(spokenText, translated, fromLang, outputSpeechLang);

    SpeechModule.speak(translated, outputSpeechLang, {
      onStart: () =>
        setStatus(
          isViToEn ? "🔊 Đang phát loa Tiếng Anh..." : "🔊 Đang phát loa Tiếng Việt...",
          "speaking"
        ),
      onDone: () => setStatus("Sẵn sàng — Bấm nút bên dưới để nói"),
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
    isViToEn ? "🎙️ Đang nghe Tiếng Việt... Hãy nói đi!" : "🎙️ Listening English... Speak now!",
    "listening"
  );

  SpeechModule.startListening(inputSpeechLang, {
    onInterim: (text) => {
      if (text) {
        livePreview.textContent = `“${text}”`;
        livePreview.classList.remove("hidden");
      }
    },
    onResult: (spokenText) => {
      processTranslation(spokenText, direction);
    },
    onError: (errMsg) => {
      setStatus(errMsg, "error");
      resetButtons();
    },
    onEnd: () => {
      resetButtons();
    },
  });
}

btnVi.addEventListener("click", () => handleMicClick("vi-en"));
btnEn.addEventListener("click", () => handleMicClick("en-vi"));

btnSpeed.addEventListener("click", () => {
  if (SpeechModule.speechRate < 1) {
    SpeechModule.speechRate = 1.05;
    btnSpeed.textContent = "🐇 Vừa";
  } else {
    SpeechModule.speechRate = 0.85;
    btnSpeed.textContent = "🐢 Chậm";
  }
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
      <div class="empty-orb">🎙️</div>
      <h2>Chạm để trò chuyện</h2>
      <p>
        Bấm nút <strong class="txt-red">ĐỎ</strong> để nói Tiếng Việt (loa phát Tiếng Anh).<br />
        Bấm nút <strong class="txt-blue">XANH</strong> để nói Tiếng Anh (loa phát Tiếng Việt).
      </p>
    </div>
  `;
  setStatus("Đã xóa lịch sử — Bấm nút bên dưới để nói");
});
