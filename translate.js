const Translator = {
  async translate(text, fromLang, toLang) {
    const cleanText = text.trim();
    if (!cleanText) throw new Error("Không có nội dung để dịch.");

    // Ưu tiên 1: Google Translate (dịch tiếng Việt tự nhiên và nhanh)
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(
        cleanText
      )}`;
      const res = await fetch(gUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((part) => part[0]).join("");
          if (translated) return translated;
        }
      }
    } catch (_) {
      // Nếu lỗi thì tự chuyển sang máy chủ dự phòng bên dưới
    }

    // Ưu tiên 2 (Dự phòng): MyMemory API
    const mUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      cleanText
    )}&langpair=${fromLang}|${toLang}`;
    const res2 = await fetch(mUrl);
    if (!res2.ok) throw new Error("Không thể kết nối máy chủ dịch.");
    const data2 = await res2.json();
    if (data2?.responseData?.translatedText) {
      return data2.responseData.translatedText;
    }

    throw new Error("Không nhận được bản dịch. Hãy thử lại.");
  },
};
