const SpeechModule = {
  recognition: null,
  isListening: false,
  speechRate: parseFloat(localStorage.getItem("phiendich_rate") || "0.95"),
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

  setRate(rate) {
    this.speechRate = rate;
    localStorage.setItem("phiendich_rate", String(rate));
  },

  async ensureMicPermission() {
    if (this.micGranted) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      this.micGranted = true;
      return true;
    } catch (_) {
      return false;
    }
  },

  unlockAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioCtx) this.audioCtx = new AudioCtx();
        if (this.audioCtx.state === "suspended") this.audioCtx.resume();
        const buf = this.audioCtx.createBuffer(1, 1, 22050);
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(this.audioCtx.destination);
        src.start(0);
      }
      if ("speechSynthesis" in window) window.speechSynthesis.resume();
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
      onError("Trình duyệt chưa hỗ trợ thu âm. Hãy dùng Chrome hoặc Safari.");
      return;
    }

    this.unlockAudio();
    const ok = await this.ensureMicPermission();
    if (!ok) {
      onError("Chrome đang chặn Micro! Hãy cấp quyền Micro trên thanh địa chỉ.");
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
    let delivered = false;

    const deliverNow = (text) => {
      if (delivered || !text) return;
      delivered = true;
      // Nhả mic ngay để dịch + phát loa nhanh tối đa
      this.stopListening();
      setTimeout(() => onResult(text), 120);
    };

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
      const display = (finalTranscript + " " + interim).trim();
      if (onInterim && display) onInterim(display);

      // Vừa chốt câu xong là dịch liền không chờ trễ
      if (finalTranscript.trim()) {
        deliverNow(finalTranscript.trim());
      }
    };

    recog.onerror = (event) => {
      if (event.error === "aborted" && delivered) return;
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
      const fallback = (finalTranscript || lastInterim).trim();
      if (fallback && !delivered) {
        deliverNow(fallback);
      }
    };

    this.recognition = recog;
    this.isListening = true;
    recog.start();
  },

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (_) {}
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

    if (!("speechSynthesis" in window) || !bestVoice) {
      this.speakViaAudioFallback(text, shortLang, { onStart, onDone, onError });
      return;
    }

    let started = false;
    let finished = false;

    const utter = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utter;
    utter.voice = bestVoice;
    utter.lang = bestVoice.lang || langCode;
    utter.rate = this.speechRate;
    utter.volume = 1.0;

    const watchdog = setTimeout(() => {
      if (!started && !finished) {
        finished = true;
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
        this.speakViaAudioFallback(text, shortLang, { onStart, onDone, onError });
      }
    }, 1100);

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
        if (onError) onError("Không phát được loa. Hãy kiểm tra âm lượng máy hoặc quyền Âm thanh.");
        if (onDone) onDone();
      };

      const playPromise = this.audioPlayer.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (onError) onError("Trình duyệt chặn tự phát loa. Hãy bấm nút 🔊 Đọc lại.");
          if (onDone) onDone();
        });
      }
    };

    playNext();
  },
};

SpeechModule.initVoices();
