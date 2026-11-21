const Translator = {
  cache: new Map(),

  getGeminiKey() {
    return (localStorage.getItem("phiendich_gemini_key") || "").trim();
  },

  setGeminiKey(key) {
    const clean = (key || "").trim();
    if (clean) localStorage.setItem("phiendich_gemini_key", clean);
    else localStorage.removeItem("phiendich_gemini_key");
  },

  async translate(text, fromLang, toLang) {
    const cleanText = text.trim();
    if (!cleanText) throw new Error("Không có nội dung để dịch.");

    const geminiKey = this.getGeminiKey();
    const cacheKey = `${geminiKey ? "ai" : "gg"}|${fromLang}|${toLang}|${cleanText.toLowerCase()}`;

    if (this.cache.has(cacheKey)) {
      return { text: this.cache.get(cacheKey), ms: 0, engine: geminiKey ? "AI" : "GG" };
    }

    const start = performance.now();

    // 1. Nếu có Gemini Key -> Dịch bằng AI chuẩn ngữ cảnh giao tiếp tự nhiên nhất
    if (geminiKey) {
      try {
        const aiText = await this.translateWithGemini(cleanText, fromLang, toLang, geminiKey);
        if (aiText) {
          this.cache.set(cacheKey, aiText);
          return { text: aiText, ms: Math.round(performance.now() - start), engine: "AI" };
        }
      } catch (_) {
        // Nếu key sai hoặc mạng chậm, tự rơi về Google Translate để không gián đoạn
      }
    }

    // 2. Google Translate (siêu nhanh ~150-300ms, độ chính xác rất cao)
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(
        cleanText
      )}`;
      const res = await fetch(gUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((part) => part[0]).join("").trim();
          if (translated) {
            this.cache.set(cacheKey, translated);
            return { text: translated, ms: Math.round(performance.now() - start), engine: "GG" };
          }
        }
      }
    } catch (_) {}

    // 3. Dự phòng cuối: MyMemory
    const mUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      cleanText
    )}&langpair=${fromLang}|${toLang}`;
    const res2 = await fetch(mUrl);
    if (!res2.ok) throw new Error("Mất kết nối máy chủ dịch.");
    const data2 = await res2.json();
    if (data2?.responseData?.translatedText) {
      const fallbackText = data2.responseData.translatedText.trim();
      this.cache.set(cacheKey, fallbackText);
      return { text: fallbackText, ms: Math.round(performance.now() - start), engine: "MM" };
    }

    throw new Error("Không nhận được bản dịch. Hãy thử lại.");
  },

  async translateWithGemini(text, fromLang, toLang, apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const directionText =
      fromLang === "vi"
        ? "Vietnamese to natural, everyday spoken American English"
        : "English to natural, polite everyday Vietnamese";

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Translate the following spoken sentence from ${directionText}. Preserve exact meaning, idioms, and tone. Output ONLY the translated sentence with no quotes or explanations:\n${text}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 200,
            },
          }),
        }
      );

      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return out ? out.trim().replace(/^["“]|["”]$/g, "") : null;
    } catch (_) {
      clearTimeout(timer);
      return null;
    }
  },
};
