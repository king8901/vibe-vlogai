(() => {
  // Default to backend origin in dev (backend runs on :5050).
  // Optional override: window.__API_BASE__ (e.g., if you host API separately).
  const API_BASE = (window.__API_BASE__ || "https://vibe-vlogai-nw7q.vercel.app/");



  const el = {
    input: document.getElementById("conceptInput"),
    btn: document.getElementById("generateBtn"),
    error: document.getElementById("errorMsg"),
    hudStatus: document.getElementById("hudStatus"),
    statusText: document.getElementById("statusText"),
    creativeOutput: document.getElementById("creativeOutput"),
    creativeRec: document.getElementById("creativeRec"),
    seoOutput: document.getElementById("seoOutput"),
    thumbnailOutput: document.getElementById("thumbnailOutput"),
    thumbnailRec: document.getElementById("thumbnailRec"),
    seoRec: document.getElementById("seoRec"),
  };
  const state = {
    creative: "",
    thumbnail: "",
    seo: "",
    generating: false,
    activeSectionFilter: null,
  };

  const PLACEHOLDERS = {
    creative: el.creativeOutput.innerHTML,
    thumbnail: el.thumbnailOutput.innerHTML,
    seo: el.seoOutput.innerHTML,
  };

  function detectLanguage(concept) {
    if (!concept || typeof concept !== "string") return "en";

    const normalized = concept.trim().toLowerCase();
    const hasNativeScript = /[\u0900-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0A00-\u0A7F\u0A80-\u0AFF\u0980-\u09FF\u0600-\u06FF\u0750-\u077F\u0B80-\u0BFF]/.test(normalized);

    // Roman-only mapping
    if (!hasNativeScript) {
      const roman = normalized;

      const romanTokens = [
        { lang: "bn", re: /\b(tumi|ami|tomar|tor|kothay|kobe|ajke|ekhon|bangla|kolkata|bengali|er|ke|eta|eita|achhe|chilo|dilo|korbo|kori|korshi|korte|kora)\b/i },
        { lang: "ta", re: /\b(nee|nalla|enakku|varum|pogalam|epdi|entha|tamil|chenna(i|y)|amma|appa|app(a|a)|vanakkam|thang(a|a)i)\b/i },
        { lang: "te", re: /\b(nee(nu)?|nenu|meeru|amma|anna|telugu|ekkuva|enti|emiti|undha|em(i|i)??|ela|ela(a)?)\b/i },
        { lang: "kn", re: /\b(ninu|nanu|nim|kannada|appa|amma|madu|hogi|nodu)\b/i },
        { lang: "ml", re: /\b(ninte|enikku|ponnu|mone|kerala|malayalam|evide|entha|pokam|varum)\b/i },
        { lang: "gu", re: /\b(tame|hu|maru|taru|tari|temnu|gujarat|gujarati|badhu|kem|javu|thay|mane)\b/i },
        { lang: "pa", re: /\b(tusi|mainu|saanu|punjab|punjabi|sat sri akal|tu|te|sadi|assi|kadi)\b/i },
        { lang: "or", re: /\b(odia|odisha|tume|mo|tanka|bhala|bhale|bhal(a|e)|au)\b/i },
        { lang: "hi", re: /\b(mera|meri|mere|naam|hai|nahi|bhi|aur|sath|wali|wala|hona|aap|tum|main|kya|kaise|bahut|wo|woh|yeh|ye|is|us|woh)\b/i },
      ];

      for (const item of romanTokens) {
        if (item.re.test(roman)) return item.lang;
      }
      return "en";
    }

    const hasDevanagari = /[\u0900-\u097F]/.test(concept);

    const hasBengali = /[\u0980-\u09FF]/.test(concept);
    const hasGurmukhi = /[\u0A00-\u0A7F]/.test(concept);
    const hasGujarati = /[\u0A80-\u0AFF]/.test(concept);
    const hasOriya = /[\u0B00-\u0B7F]/.test(concept);
    const hasTamil = /[\u0B80-\u0BFF]/.test(concept);
    const hasTelugu = /[\u0C00-\u0C7F]/.test(concept);
    const hasKannada = /[\u0C80-\u0CFF]/.test(concept);
    const hasMalayalam = /[\u0D00-\u0D7F]/.test(concept);
    const hasUrduArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(concept);

    if (hasDevanagari) return "hi";
    if (hasBengali) return "bn";
    if (hasGurmukhi) return "pa";
    if (hasGujarati) return "gu";
    if (hasOriya) return "or";
    if (hasTamil) return "ta";
    if (hasTelugu) return "te";
    if (hasKannada) return "kn";
    if (hasMalayalam) return "ml";
    if (hasUrduArabic) return "ur";

    return "en";
  }


  const LOCALIZED = {
    en: {
      errorEmptyConcept: "Hey, tell me about your vlog idea first — what's the vibe?",
      thinking: "thinking…",
      done: "done",
      errorFallback: "Generation failed.",
      uiCopied: "Copied",
      statusReady: "Ready to help",
      errorBackendPort: "Hmm, something went wrong. Is the backend reachable?",

    },
    hi: {
      errorEmptyConcept: "पहले अपनी vlog idea बताइए — vibe क्या है?",
      thinking: "सोच रहा हूँ…",
      done: "हो गया",
      errorFallback: "जनरेशन फेल हो गया।",
      uiCopied: "कॉपी हो गया",
      statusReady: "मदद के लिए तैयार",
      errorBackendPort: "कुछ गड़बड़ हो गई। क्या backend पोर्ट 5050 पर चल रहा है?",
    },
  };

  function getLocalizedString(key, lang) {
    const l = (lang && LOCALIZED[lang]) ? lang : "en";
    return LOCALIZED[l][key] || LOCALIZED.en[key] || "";
  }

  function setStatus(mode, label) {
    el.hudStatus.classList.remove("live", "done");
    if (mode) el.hudStatus.classList.add(mode);
    el.statusText.textContent = label;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMarkdown(container, text, streaming) {
    if (!text) return;
    const html = window.marked ? window.marked.parse(text) : `<pre>${escapeHtml(text)}</pre>`;
    container.innerHTML = html + (streaming ? '<span class="cursor-blink"></span>' : "");
  }



  function parseNumberedThumbnailIdeas(text) {
    if (!text || typeof text !== "string") return [];
    // Split by '## Thumbnail N' headings
    const blocks = text.split(/##\s*Thumbnail\s*\d+/i).filter(Boolean);
    if (blocks.length < 2) {
      // Fallback: try line-by-line numbered format
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const ideas = [];
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^([1-5])\)\s*(.*)$/) || lines[i].match(/^([1-5])\.\s*(.*)$/);
        if (m) {
          ideas[Number(m[1]) - 1] = (m[2] || "").trim();
        }
      }
      return ideas.filter(Boolean);
    }
    // Take first 5 blocks, trim them
    return blocks.slice(0, 5).map(b => b.trim()).filter(Boolean);
  }

  function parseIdeaFields(ideaText) {
    if (!ideaText || ideaText.length < 10) return null;

    const text = ideaText;

    // Extract Title
    const titleMatch = text.match(/Title\s*:\s*([^\n]+)/i);
    const overlayText = titleMatch ? titleMatch[1].trim().toUpperCase() : "";
    // Extract Image References
    const imgRefsMatch = text.match(/Image\s*References\s*:\s*([\s\S]*?)(?=AI\s*Prompt\s*:|$)/i);
    const imageReferences = imgRefsMatch
      ? imgRefsMatch[1].split(/\n/).map(l => l.replace(/^-\s*/, '').trim()).filter(Boolean)
      : [];

    // Extract AI Prompt (everything between 'AI Prompt:' and 'Design Notes:' or end)
    const aiPromptMatch = text.match(/AI\s*Prompt\s*:\s*([\s\S]*?)(?=Design\s*Notes\s*:|$)/i);
    const aiPrompt = aiPromptMatch ? aiPromptMatch[1].trim() : "";
    // Extract Design Notes section
    const designNotesMatch = text.match(/Design\s*Notes\s*:\s*([\s\S]*?)$/i);
    const designNotes = designNotesMatch ? designNotesMatch[1] : "";
    // Extract fields from Design Notes
    const colorsLine = designNotes.match(/-\s*Colors\s*:\s*(.+)/i);
    const colorsStr = colorsLine ? colorsLine[1] : "";
    const emotionLine = designNotes.match(/-\s*Emotion\s*:\s*(.+)/i);
    const emotionStr = emotionLine ? emotionLine[1].trim().toLowerCase() : "";
    const styleLine = designNotes.match(/-\s*Style\s*:\s*(.+)/i);
    const styleStr = styleLine ? styleLine[1].trim().toLowerCase() : "";
    const subjectPosLine = designNotes.match(/-\s*Subject\s*Position\s*:\s*(.+)/i);
    const subjectPosStr = subjectPosLine ? subjectPosLine[1].trim().toLowerCase() : "";
    const ctrLine = designNotes.match(/-\s*CTR\s*Element\s*:\s*(.+)/i);
    const ctrStr = ctrLine ? ctrLine[1].trim() : "";
    // Extract hex colors from the entire text
    const hexColors = (text.match(/#([0-9a-fA-F]{6})/g) || []).map(h => h.toLowerCase());
    // Detect colors from color names
    const colorMap = {
      red: "#FF0000", blue: "#0000FF", green: "#00FF00", yellow: "#FFFF00",
      orange: "#FFA500", purple: "#800080", pink: "#FF69B4", cyan: "#00FFFF",
      white: "#FFFFFF", black: "#000000", gray: "#808080", grey: "#808080",
      teal: "#008080", navy: "#000080", maroon: "#800000", gold: "#FFD700",
      silver: "#C0C0", lime: "#00FF00", indigo: "#4B0082", violet: "#EE82EE",
      magenta: "#FF00FF", coral: "#FF7F50", crimson: "#DC143C", turquoise: "#40E0D0",
    };
    const foundColors = [];
    const lower = text.toLowerCase();
    for (const [name, hex] of Object.entries(colorMap)) {
      if (lower.includes(name) && !foundColors.includes(hex)) {
        foundColors.push(hex);
      }
    }

    // Merge hex colors and named colors
    const allColors = [...new Set([...hexColors, ...foundColors])];
    const defaultPalette = ["#1a1a2e", "#16213e", "#0f3460", "#e94560"];
    const palette = allColors.slice(0, 4);
    while (palette.length < 4) palette.push(defaultPalette[palette.length]);
    // Background gradient colors
    const bgColors = palette.slice(0, 2);
    let bgDir = "diagonal";
    if (/horizontal|left to right|right to left/i.test(text)) bgDir = "horizontal";
    else if (/vertical|top to bottom|bottom to top/i.test(text)) bgDir = "vertical";
    // Detect main subject style
    let subjectStyle = "abstract";
    if (/silhouette|shadow|outline/i.test(styleStr) || /silhouette|shadow|outline/i.test(text)) subjectStyle = "silhouette";
    else if (/icon|product|object/i.test(styleStr)) subjectStyle = "icon";
    else if (/photorealistic|realistic|photo|cinematic/i.test(styleStr) || /photorealistic|realistic|photo|cinematic/i.test(text)) subjectStyle = "silhouette";

    let position = "center";
    if (/left/i.test(subjectPosStr)) position = "left";
    else if (/right/i.test(subjectPosStr)) position = "right";

    // Detect vibe from emotion
    let vibe = "exciting";
    const vibeKeywords = [
      { words: ["mysterious", "dark", "shadow", "mystery", "suspense", "intriguing"], val: "mysterious" },
      { words: ["fun", "playful", "happy", "joyful", "colorful", "bright", "excited"], val: "fun" },
      { words: ["dramatic", "intense", "epic", "powerful", "bold", "serious"], val: "dramatic" },
      { words: ["exciting", "action", "thrilling", "adventure", "energetic", "thriller"], val: "exciting" },
      { words: ["calm", "peaceful", "serene", "relaxing", "chill", "tranquil"], val: "calm" },
    ];
    const searchText = (emotionStr + " " + text).toLowerCase();
    for (const group of vibeKeywords) {
      if (group.words.some(w => searchText.includes(w))) {
        vibe = group.val;
        break;
      }
    }

    // Build description from AI prompt
    const description = aiPrompt ? aiPrompt.split(/\n/)[0].trim().substring(0, 200) : (overlayText || "YouTube thumbnail");

    // Overlay color
    const overlayColor = palette[3] || "#000000";
    // Text color
    let textColor = "#ffffff";
    let strokeColor = "#000000";
    if (/white\s+text/i.test(text)) { textColor = "#ffffff"; strokeColor = "#000000"; }
    else if (/black\s+text/i.test(text)) { textColor = "#000000"; strokeColor = "#ffffff"; }
    else if (/yellow\s+text/i.test(text)) { textColor = "#FFFF00"; strokeColor = "#000000"; }
    else if (/red\s+text/i.test(text)) { textColor = "#FF0000"; strokeColor = "#000000"; }
    else if (/gold\s+text/i.test(text)) { textColor = "#FFD700"; strokeColor = "#000000"; }

    const c1 = palette[2] || "#FFFF00";
    const c2 = palette[3] || "#FF512F";

    return {
      background: {
        type: "gradient",
        colors: bgColors,
        direction: bgDir,
      },
      mainVisual: {
        description: description || "A scene from the video concept",
        position,
        size: "large",
        style: subjectStyle,
      },
      overlayShape: {
        type: "rectangle",
        color: overlayColor,
        position: "bottom",
        opacity: 0.7,
      },
      textOverlay: {
        text: overlayText || "WATCH THIS",
        fontSize: 72,
        color: textColor,
        strokeColor,
        position: "bottom",
        shadowColor: "#000000",
      },
      accentElements: [
        { type: "circle", color: c1, position: "top-right", size: 180 },
        { type: "circle", color: c2, position: "bottom-left", size: 120 },
      ],
      colorPalette: palette,
      vibe,
      rawText: text,
      // New fields for UI display
      title: overlayText,
      aiPrompt,
      imageReferences,
      ctrElement: ctrStr,
      emotion: emotionStr,
      style: styleStr,
    };
  }

  function extractSelectedThumbnailFromNumberedList(thumbnailMarkdown, selectedIndex) {
    const text = (thumbnailMarkdown || "").trim();
    const ideas = parseNumberedThumbnailIdeas(text);
    if (!ideas.length) return null;
    const idx = Math.max(0, Math.min(ideas.length - 1, selectedIndex));
    return parseIdeaFields(ideas[idx]);
  }



  function resetPanels() {
    state.creative = "";
    state.thumbnail = "";
    state.seo = "";
    el.creativeOutput.innerHTML = PLACEHOLDERS.creative;
    el.thumbnailOutput.innerHTML = PLACEHOLDERS.thumbnail;
    el.seoOutput.innerHTML = PLACEHOLDERS.seo;
    el.creativeRec.classList.remove("active");
    el.thumbnailRec.classList.remove("active");
    el.seoRec.classList.remove("active");
  }

  function resetSection(section) {
    if (section === "creative") {
      state.creative = "";
      el.creativeOutput.innerHTML = PLACEHOLDERS.creative;
      el.creativeRec.classList.remove("active");
    } else if (section === "thumbnail") {
      state.thumbnail = "";
      el.thumbnailOutput.innerHTML = PLACEHOLDERS.thumbnail;
      el.thumbnailRec.classList.remove("active");
    } else if (section === "seo") {
      state.seo = "";
      el.seoOutput.innerHTML = PLACEHOLDERS.seo;
      el.seoRec.classList.remove("active");
    }
  }

  function setBusy(isBusy) {
    state.generating = isBusy;
    el.btn.disabled = isBusy;

    // Disable regenerate buttons while generating
    document.querySelectorAll(".regen-btn").forEach((b) => {
      b.disabled = isBusy;
    });
  }

  function setSectionActive(section, detectedLang) {
    if (section === "creative") {
      el.creativeRec.classList.add("active");
      el.creativeOutput.innerHTML = `<p class="placeholder thinking">${getLocalizedString("thinking", detectedLang)}<span class="think-dots"></span></p>`;
    } else if (section === "thumbnail") {
      el.thumbnailRec.classList.add("active");
      el.thumbnailOutput.innerHTML = `<p class="placeholder thinking">${getLocalizedString("thinking", detectedLang)}<span class="think-dots"></span></p>`;
    } else if (section === "seo") {
      el.seoRec.classList.add("active");
      el.seoOutput.innerHTML = `<p class="placeholder thinking">${getLocalizedString("thinking", detectedLang)}<span class="think-dots"></span></p>`;
    }
  }

  function clearSectionActive(section) {
    if (section === "creative") el.creativeRec.classList.remove("active");
    else if (section === "thumbnail") el.thumbnailRec.classList.remove("active");
    else if (section === "seo") el.seoRec.classList.remove("active");
  }

  async function generate() {
    const concept = el.input.value.trim();
    const detectedLang = detectLanguage(concept);
    el.error.hidden = true;

    state.activeSectionFilter = null;

    if (!concept) {
      el.error.textContent = getLocalizedString("errorEmptyConcept", detectedLang);
      el.error.hidden = false;
      return;
    }

    if (state.generating) return;

    const length = document.getElementById("lengthSelect")?.value === "long" ? "long" : "short";

    resetPanels();
    setBusy(true);
    setStatus("live", getLocalizedString("thinking", detectedLang));
    el.creativeRec.classList.add("active");
    el.thumbnailRec.classList.add("active");
    el.seoRec.classList.add("active");
    el.creativeOutput.innerHTML = `<p class="placeholder thinking">${getLocalizedString("thinking", detectedLang)}<span class="think-dots"></span></p>`;
    el.thumbnailOutput.innerHTML = `<p class="placeholder thinking">${getLocalizedString("thinking", detectedLang)}<span class="think-dots"></span></p>`;
    el.seoOutput.innerHTML = `<p class="placeholder thinking">${getLocalizedString("thinking", detectedLang)}<span class="think-dots"></span></p>`;

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, lang: detectedLang, length }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded with ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop();

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          let payload;
          try { payload = JSON.parse(jsonStr); } catch (e) { continue; }
          handleEvent(payload);
        }
      }

      setStatus("done", getLocalizedString("done", detectedLang));
    } catch (err) {
      console.error(err);
      el.error.textContent = err.message || getLocalizedString("errorBackendPort", detectedLang);

      el.error.hidden = false;
      setStatus(null, "ERROR");
    } finally {
      setBusy(false);
      el.creativeRec.classList.remove("active");
      el.thumbnailRec.classList.remove("active");
      el.seoRec.classList.remove("active");
    }
  }

  function handleEvent(payload) {
    const filter = state.activeSectionFilter; // null => all sections

    if (payload.type === "chunk" && payload.section === "creative") {
      if (filter && filter !== "creative") return;
      state.creative += payload.text;
      renderMarkdown(el.creativeOutput, state.creative, true);
    } else if (payload.type === "chunk" && payload.section === "thumbnail") {
      if (filter && filter !== "thumbnail") return;
      state.thumbnail += payload.text;
      renderMarkdown(el.thumbnailOutput, state.thumbnail, true);
    } else if (payload.type === "chunk" && payload.section === "seo") {
      if (filter && filter !== "seo") return;
      state.seo += payload.text;
      renderMarkdown(el.seoOutput, state.seo, true);
    } else if (payload.type === "section-end") {
      // End logic differs for full generation vs section-only regeneration
      if (payload.section === "creative") {
        if (!filter || filter === "creative") renderMarkdown(el.creativeOutput, state.creative, false);
        if (!filter) {
          el.creativeRec.classList.remove("active");
          el.thumbnailRec.classList.add("active");
        } else {
          clearSectionActive("creative");
        }
      } else if (payload.section === "thumbnail") {
        if (!filter || filter === "thumbnail") renderMarkdown(el.thumbnailOutput, state.thumbnail, false);
        if (!filter) {
          el.thumbnailRec.classList.remove("active");
          el.seoRec.classList.add("active");
        } else {
          clearSectionActive("thumbnail");
        }
      } else if (payload.section === "seo") {
        if (!filter || filter === "seo") renderMarkdown(el.seoOutput, state.seo, false);
        if (!filter) {
          el.seoRec.classList.remove("active");
        } else {
          clearSectionActive("seo");
        }
      }
    } else if (payload.type === "error") {
      const detectedLang = detectLanguage(el.input.value.trim());
      el.error.textContent = payload.message || getLocalizedString("errorFallback", detectedLang);
      el.error.hidden = false;
    }
  }

  async function regenerateSection(section) {
    const concept = el.input.value.trim();
    const detectedLang = detectLanguage(concept);
    el.error.hidden = true;

    if (!concept) {
      el.error.textContent = getLocalizedString("errorEmptyConcept", detectedLang);
      el.error.hidden = false;
      return;
    }

    if (state.generating) return;

    state.activeSectionFilter = section;

    // Reset + show placeholder only for that section
    resetSection(section);
    setBusy(true);
    setStatus("live", getLocalizedString("thinking", detectedLang));

    // Activate only the requested indicator + placeholder
    setSectionActive(section, detectedLang);

    try {
      const length = document.getElementById("lengthSelect")?.value === "long" ? "long" : "short";

      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, lang: detectedLang, length }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded with ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop();

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          let payload;
          try { payload = JSON.parse(jsonStr); } catch (e) { continue; }
          handleEvent(payload);
        }
      }

      setStatus("done", getLocalizedString("done", detectedLang));
    } catch (err) {
      console.error(err);
      el.error.textContent = err.message || getLocalizedString("errorBackendPort", detectedLang);
      el.error.hidden = false;
      setStatus(null, "ERROR");
    } finally {
      setBusy(false);
      state.activeSectionFilter = null;
      // Ensure indicators are cleaned
      clearSectionActive("creative");
      clearSectionActive("thumbnail");
      clearSectionActive("seo");
    }
  }

  el.btn.addEventListener("click", generate);

  document.querySelectorAll(".regen-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      if (section) regenerateSection(section);
    });
  });
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  });

  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = document.getElementById(btn.dataset.target);
      const text = target.innerText.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add("copied");
        const original = btn.textContent;
        const detectedLang = detectLanguage(el.input.value.trim());
        btn.textContent = (LOCALIZED[detectedLang] && LOCALIZED[detectedLang].uiCopied) ? LOCALIZED[detectedLang].uiCopied : LOCALIZED.en.uiCopied;

        setTimeout(() => {
          btn.classList.remove("copied");
          btn.textContent = original;
        }, 100);
      } catch (err) { /* clipboard unavailable */ }
    });
  });

  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    const t = (theme === "light" || theme === "dark") ? theme : "light";
    document.body.setAttribute("data-theme", t);
    // Button label shows the NEXT action
    // dark -> Dark Theme, light -> Light Theme
    if (themeToggle) themeToggle.textContent = t === "light" ? "Dark Theme" : "Light Theme";
  }

  const savedTheme = window.localStorage ? window.localStorage.getItem("theme") : null;
  applyTheme(savedTheme || "dark");

  themeToggle?.addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme") || "dark";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
    window.localStorage?.setItem("theme", next);
  });

  const initialConcept = el.input ? el.input.value.trim() : "";
  const initialLang = detectLanguage(initialConcept);
  setStatus(null, getLocalizedString("statusReady", initialLang) || "standby");
})();



