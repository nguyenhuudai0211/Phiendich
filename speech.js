const SpeechModule = {
  recognition: null,
  isListening: false,
  speechRate: 0.9,
  audioPlayer: new Audio(),
  audioCtx: null,
  currentUtterance: null,
  voices: [],
  micGranted: false,

  initVoices() {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      this.voices = window.speechSynthesis.getVoices() || [];
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  },

  // Xin quyền Micro trực tiếp trên Chrome để hiện bảng "Cho phép" ngay
  async ensureMicPermission() {
    if (this.micGranted) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.micGranted = true;
      return true;
    } catch (err) {
      return false;
    }
  },

  // Mở khóa cổng loa của Chrome / Safari ngay khi người dùng chạm nút
  unlockAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioCtx) this.audioCtx = new AudioCtx();
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume();
        }
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.resume();
      }
    } catch (_) {}
  },

  isSupported() {
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  },

  stopAllAudio() {
    try {
      if ("speechSynthesis" in window) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      }
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    } catch (_) {}
  },

  async startListening(langCode, { onInterim, onResult, onEnd, onError }) {
    if (!this.isSupported()) {
      onError("Trình duyệt không hỗ trợ thu âm. Hãy dùng Chrome hoặc Safari.");
      return;
    }

    this.unlockAudio();
    const ok = await this.ensureMicPermission();
    if (!ok) {
      onError("Chrome đang chặn Micro! Bấm vào biểu tượng bên trái thanh địa chỉ để Cho phép.");
      return;
    }

    this.stopListening();
    this.stopAllAudio();

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();

    recog.lang = langCode;
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.continuous = false;

    let finalTranscript = "";
    let lastInterim = "";

    recog.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += chunk;
        } else {
          interim += chunk;
        }
      }
      lastInterim = interim;
      if (onInterim) onInterim((finalTranscript + " " + interim).trim());
    };

    recog.onerror = (event) => {
      const msgMap = {
        "not-allowed": "Chưa cấp quyền Micro. Hãy bấm Cho phép (Allow) trên Chrome.",
        "no-speech": "Không nghe thấy tiếng. Bấm lại và nói rõ hơn nhé.",
        network: "Lỗi mạng. Kiểm tra lại Wi-Fi / 4G.",
      };
      onError(msgMap[event.error] || `Lỗi Micro: ${event.error}`);
    };

    recog.onend = () => {
      this.isListening = false;
      onEnd();
      const resultText = (finalTranscript || lastInterim).trim();
      if (resultText) {
        // Đợi 250ms để hệ điều hành nhả cổng Mic chuyển sang cổng Loa
        setTimeout(() => onResult(resultText), 250);
      }
    };

    this.recognition = recog;
    this.isListening = true;
    recog.start();
  },

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  },

  pickBestVoice(langCode) {
    const list =
      this.voices.length > 0
        ? this.voices
        : "speechSynthesis" in window
        ? window.speechSynthesis.getVoices()
        : [];
    const prefix = langCode.slice(0, 2).toLowerCase();
    const matches = list.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    if (matches.length === 0) return null;

    // Ưu tiên giọng cài sẵn trong máy (localService) để không bao giờ bị treo mạng
    return (
      matches.find((v) => v.localService && v.lang.toLowerCase() === langCode.toLowerCase()) ||
      matches.find((v) => v.localService) ||
      matches.find((v) => /google|natural|samantha|hoaimy|linh/i.test(v.name)) ||
      matches[0]
    );
  },

  speak(text, langCode, { onStart, onDone, onError } = {}) {
    if (!text || !text.trim()) return;
    this.unlockAudio();
    this.stopAllAudio();

    const shortLang = langCode.slice(0, 2).toLowerCase();
    const bestVoice = this.pickBestVoice(langCode);

    // Nếu máy không có sẵn giọng đọc ngôn ngữ đó (hay gặp với Tiếng Việt trên Windows) -> phát thẳng qua Audio
    if (!("speechSynthesis" in window) || !bestVoice) {
      this.speakViaAudioFallback(text, shortLang, { onStart, onDone, onError });
      return;
    }

    let started = false;
    let finished = false;

    const utter = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utter; // Giữ tham chiếu để Chrome không tự xóa giữa chừng
    utter.voice = bestVoice;
    utter.lang = bestVoice.lang || langCode;
    utter.rate = this.speechRate;
    utter.volume = 1.0;

    // Nếu sau 1.2 giây loa trình duyệt vẫn im -> tự chuyển sang phát file Audio
    const watchdog = setTimeout(() => {
      if (!started && !finished) {
        finished = true;
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
        this.speakViaAudioFallback(text, shortLang, { onStart, onDone, onError });
      }
    }, 1200);

    utter.onstart = () => {
      started = true;
      clearTimeout(watchdog);
      if (onStart) onStart();
    };

    utter.onend = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      this.currentUtterance = null;
      if (onDone) onDone();
    };

    utter.onerror = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      this.currentUtterance = null;
      this.speakViaAudioFallback(text, shortLang, { onStart, onDone, onError });
    };

    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utter);
    } catch (_) {
      clearTimeout(watchdog);
      this.speakViaAudioFallback(text, shortLang, { onStart, onDone, onError });
    }
  },

  speakViaAudioFallback(text, shortLang, { onStart, onDone, onError } = {}) {
    // Chia nhỏ câu nếu quá dài (>180 ký tự)
    const chunks = text.match(/.{1,180}(\s|$)/g) || [text];
    let index = 0;

    const playNext = () => {
      if (index >= chunks.length) {
        if (onDone) onDone();
        return;
      }
      const part = chunks[index++].trim();
      if (!part) {
        playNext();
        return;
      }

      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${shortLang}&q=${encodeURIComponent(
        part
      )}`;
      this.audioPlayer.src = url;
      this.audioPlayer.volume = 1.0;
      this.audioPlayer.playbackRate = this.speechRate;
      this.audioPlayer.onplay = () => {
        if (index === 1 && onStart) onStart();
      };
      this.audioPlayer.onended = playNext;
      this.audioPlayer.onerror = () => {
        if (onError) onError("Không phát được loa. Hãy kiểm tra âm lượng máy hoặc quyền Âm thanh trên Chrome.");
        if (onDone) onDone();
      };

      const playPromise = this.audioPlayer.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (onError) onError("Trình duyệt đang chặn tự phát loa. Hãy bấm nút 🔊 Đọc lại.");
          if (onDone) onDone();
        });
      }
    };

    playNext();
  },
};

SpeechModule.initVoices();
