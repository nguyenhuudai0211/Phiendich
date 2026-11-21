const SpeechModule = {
  recognition: null,
  isListening: false,
  speechRate: 0.85,

  isSupported() {
    return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  },

  startListening(langCode, { onResult, onEnd, onError }) {
    if (!this.isSupported()) {
      onError("Trình duyệt này không hỗ trợ nhận diện giọng nói.");
      return;
    }

    this.stopListening();
    window.speechSynthesis.cancel();

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();

    recog.lang = langCode;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.continuous = false;

    recog.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recog.onerror = (event) => {
      const msgMap = {
        "not-allowed": "Chưa cấp quyền Micro. Hãy cho phép dùng Micro trong cài đặt.",
        "no-speech": "Không nghe thấy giọng nói. Hãy bấm lại và nói to hơn.",
        network: "Lỗi mạng. Hãy kiểm tra kết nối Wi-Fi / 4G.",
      };
      onError(msgMap[event.error] || `Lỗi thu âm: ${event.error}`);
    };

    recog.onend = () => {
      this.isListening = false;
      onEnd();
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

  speak(text, langCode) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = this.speechRate;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith(langCode.slice(0, 2).toLowerCase())
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    window.speechSynthesis.speak(utterance);
  },
};

// Nạp trước danh sách giọng đọc cho Safari/Chrome
if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
