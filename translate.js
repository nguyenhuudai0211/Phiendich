const Translator = {
  async translate(text, fromLang, toLang) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${fromLang}|${toLang}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Không thể kết nối máy chủ dịch.");
    }

    const data = await response.json();
    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }

    throw new Error("Không nhận được kết quả dịch.");
  },
};
