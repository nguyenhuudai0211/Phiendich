const SpeechModule = {
  recognition: null,
  isListening: false,
  speechRate: 0.88,
  audioPlayer: new Audio(),
  voices: [],

  initVoices() {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      this.voices = window.speechSynthesis.getVoices() || [];
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  },

  // Mở khóa loa ngay khi người dùng chạm nút (bắt buộc cho iPhone & Chrome)
  unlockAudio() {
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.resume();
        const silent = new SpeechSynthesisUtterance("");
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      }
    } catch (_) {}
  },

  isSupported() {
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  },

  stopAllAudio() {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
    } catch (_) {}
  },

  startListening(langCode, { onInterim, onResult, onEnd, onError }) {
    if (!this.isSupported()) {
      onError("Trình duyệt chưa hỗ trợ thu âm. Hãy dùng Chrome hoặc Safari.");
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
      if (onInterim) onInterim(finalTranscript || interim);
    };

    recog.onerror = (event) => {
      const msgMap = {
        "not-allowed": "Chưa cấp quyền Micro. Hãy bấm Cho phép (Allow).",
        "no-speech": "Không nghe thấy tiếng. Bấm lại và nói rõ hơn nhé.",
        network: "Lỗi mạng. Kiểm tra lại Wi-Fi / 4G.",
      };
      onError(msgMap[event.error] || `Lỗi Micro: ${event.error}`);
    };

    recog.onend = () => {
      this.isListening = false;
      onEnd();
      if (finalTranscript.trim()) {
        onResult(finalTranscript.trim());
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

    // Ưu tiên giọng Google / Microsoft / Apple tự nhiên
    return (
      matches.find((v) => /google|natural|hoaimy|samantha|linh/i.test(v.name)) ||
      matches.find((v) => v.lang.toLowerCase() === langCode.toLowerCase()) ||
      matches[0]
    );
  },

  speak(text, langCode, { onStart, onDone } = {}) {
    if (!text) return;
    this.stopAllAudio();

    const shortLang = langCode.slice(0, 2).toLowerCase();
    const bestVoice = this.pickBestVoice(langCode);

    // Nếu thiết bị có sẵn giọng đọc chuẩn (đặc biệt trên iOS/Android/Windows en-US)
    if ("speechSynthesis" in window && bestVoice) {
      setTimeout(() => {
        try {
          window.speechSynthesis.resume();
          const utter = new SpeechSynthesisUtterance(text);
          utter.voice = bestVoice;
          utter.lang = bestVoice.lang || langCode;
          utter.rate = this.speechRate;
          utter.volume = 1.0;

          utter.onstart = () => onStart && onStart();
          utter.onend = () => onDone && onDone();
          utter.onerror = () => {
            this.speakViaAudioFallback(text, shortLang, { onStart, onDone });
          };

          window.speechSynthesis.speak(utter);
        } catch (_) {
          this.speakViaAudioFallback(text, shortLang, { onStart, onDone });
        }
      }, 60);
      return;
    }

    // Dự phòng tự động (cực kỳ hữu ích khi Windows thiếu giọng đọc Tiếng Việt)
    this.speakViaAudioFallback(text, shortLang, { onStart, onDone });
  },

  speakViaAudioFallback(text, shortLang, { onStart, onDone } = {}) {
    try {
      const clipped = text.slice(0, 190);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${shortLang}&q=${encodeURIComponent(
        clipped
      )}`;
      this.audioPlayer.src = url;
      this.audioPlayer.playbackRate = this.speechRate;
      this.audioPlayer.onplay = () => onStart && onStart();
      this.audioPlayer.onended = () => onDone && onDone();
      this.audioPlayer.onerror = () => onDone && onDone();
      this.audioPlayer.play().catch(() => onDone && onDone());
    } catch (_) {
      onDone && onDone();
    }
  },
};

SpeechModule.initVoices();
