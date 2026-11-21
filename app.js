const btnVi = document.getElementById("btn-vi");
const btnEn = document.getElementById("btn-en");
const btnSpeed = document.getElementById("btn-speed");
const btnClear = document.getElementById("btn-clear");
const statusBar = document.getElementById("status-bar");
const chatList = document.getElementById("chat-list");

let activeDirection = null;

function setStatus(message, type = "") {
  statusBar.textContent = message;
  statusBar.className = `status-bar ${type}`.trim();
}

function resetButtons() {
  btnVi.classList.remove("recording");
  btnEn.classList.remove("recording");
  activeDirection = null;
}

function addCard(originalText, translatedText, fromLang, targetSpeechLang) {
  const empty = chatList.querySelector(".empty-state");
  if (empty) empty.remove();

  const card = document.createElement("div");
  card.className = `card ${fromLang === "en" ? "from-en" : "from-vi"}`;

  const origEl = document.createElement("div");
  origEl.className = "card-original";
  origEl.textContent = (fromLang === "vi" ? "🇻🇳 " : "🇺🇸 ") + originalText;

  const transEl = document.createElement("div");
  transEl.className = "card-translated";
  transEl.textContent = (fromLang === "vi" ? "🇺🇸 " : "🇻🇳 ") + translatedText;

  const replayBtn = document.createElement("button");
  replayBtn.className = "btn-replay";
  replayBtn.textContent = "🔊 Đọc lại";
  replayBtn.addEventListener("click", () => {
    SpeechModule.speak(translatedText, targetSpeechLang);
  });

  card.append(origEl, transEl, replayBtn);
  chatList.appendChild(card);
  chatList.scrollTop = chatList.scrollHeight;
}

function handleMicClick(direction) {
  // Nếu đang ghi âm nút đó thì bấm lại để dừng
  if (SpeechModule.isListening && activeDirection === direction) {
    SpeechModule.stopListening();
    resetButtons();
    setStatus("Đã dừng nghe.");
    return;
  }

  const isViToEn = direction === "vi-en";
  const inputSpeechLang = isViToEn ? "vi-VN" : "en-US";
  const outputSpeechLang = isViToEn ? "en-US" : "vi-VN";
  const fromLang = isViToEn ? "vi" : "en";
  const toLang = isViToEn ? "en" : "vi";

  resetButtons();
  activeDirection = direction;
  (isViToEn ? btnVi : btnEn).classList.add("recording");
  setStatus(
    isViToEn ? "🎙️ Đang nghe Tiếng Việt..." : "🎙️ Đang nghe Tiếng Anh...",
    "listening"
  );

  SpeechModule.startListening(inputSpeechLang, {
    onResult: async (spokenText) => {
      setStatus("⏳ Đang dịch...");
      try {
        const translated = await Translator.translate(spokenText, fromLang, toLang);
        addCard(spokenText, translated, fromLang, outputSpeechLang);
        setStatus("🔊 Đang phát loa...");
        SpeechModule.speak(translated, outputSpeechLang);
      } catch (err) {
        setStatus(err.message, "error");
      }
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
    SpeechModule.speechRate = 1.0;
    btnSpeed.textContent = "🐇 Vừa (1.0x)";
  } else {
    SpeechModule.speechRate = 0.85;
    btnSpeed.textContent = "🐢 Chậm (0.85x)";
  }
});

btnClear.addEventListener("click", () => {
  window.speechSynthesis.cancel();
  chatList.innerHTML = `
    <div class="empty-state">
      Bấm nút <strong>Đỏ</strong> để nói Tiếng Việt.<br />
      Bấm nút <strong>Xanh</strong> để nói Tiếng Anh.
    </div>
  `;
  setStatus("Đã xóa lịch sử. Bấm nút bên dưới để nói.");
});
