const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  buildCreativePrompt,
  buildSeoPrompt,
  buildThumbnailPrompt,
} = require("./prompts");

const app = express();
const PORT = process.env.PORT || 5050;
const HOST = process.env.HOST || "0.0.0.0";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

// In production, restrict CORS with CORS_ORIGIN. For free-tier / first deploy, leave default permissive.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  corsOrigin
    ? cors({ origin: corsOrigin, methods: ["GET", "POST"], credentials: false })
    : cors()
);
app.use(express.json({ limit: "1mb" }));

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "GEMINI_API_KEY is not set. Add it to backend/.env before running the server."
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamSection(res, model, prompt, section) {
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) sseWrite(res, { type: "chunk", section, text });
  }
  sseWrite(res, { type: "section-end", section });
}

app.post("/api/generate", async (req, res) => {
  const { concept, lang } = req.body || {};
  const safeLang = typeof lang === "string" && lang.trim() ? lang.trim() : "en";

  if (!concept || typeof concept !== "string" || !concept.trim()) {
    return res
      .status(400)
      .json({ error: "A 'concept' string is required in the request body." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res
      .status(500)
      .json({ error: "GEMINI_API_KEY is not configured on the server." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const trimmedConcept = concept.trim().slice(0, 4000);

  function getGeminiErrorMeta(err) {
    const statusCode = err?.status || err?.response?.status;
    const msg = String(err?.message || "");

    const upper = msg.toUpperCase();
    const is503 =
      statusCode === 503 ||
      upper.includes("503") ||
      upper.includes("SERVICE UNAVAILABLE");
    const is403 =
      statusCode === 403 ||
      upper.includes("403") ||
      upper.includes("FORBIDDEN");
    const is429 =
      statusCode === 429 ||
      upper.includes("429") ||
      upper.includes("TOO MANY REQUESTS");

    // Gemini quota errors sometimes provide a RetryInfo.retryDelay (e.g. "19s").
    const retryDelayStr =
      err?.errorDetails?.find?.((d) => d?.["@type"]?.includes("RetryInfo"))
        ?.retryDelay ||
      err?.errorDetails?.find?.((d) => String(d?.["@type"] || "").includes("RetryInfo"))
        ?.retryDelay ||
      null;

    const is404 =
      statusCode === 404 || statusCode === 404 ||
      upper.includes("404") ||
      upper.includes("NOT FOUND");

    return { statusCode, msg, is503, is403, is429, is404, retryDelayStr };
  }

  function parseRetryDelayMs(retryDelayStr) {
    if (!retryDelayStr || typeof retryDelayStr !== "string") return null;
    const s = retryDelayStr.trim().toLowerCase();
    if (s.endsWith("ms")) {
      const n = Number(s.replace("ms", ""));
      return Number.isFinite(n) ? n : null;
    }
    if (s.endsWith("s")) {
      const n = Number(s.replace("s", ""));
      return Number.isFinite(n) ? Math.round(n * 1000) : null;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function streamWithRetries(
    res,
    model,
    prompt,
    section,
    { maxRetries = 3 } = {}
  ) {
    let attempt = 0;

    while (true) {
      try {
        await streamSection(res, model, prompt, section);
        return { ok: true };
      } catch (err) {
        const { is503, is429, msg, retryDelayStr } = getGeminiErrorMeta(err);
        attempt += 1;

        const transient = is503 || is429;
        if (!transient || attempt > maxRetries) {
          throw err;
        }

        // Prefer Gemini-provided retry delay for 429; otherwise exponential backoff.
        const parsedRetryDelayMs = parseRetryDelayMs(retryDelayStr);
        const backoffMs =
          parsedRetryDelayMs != null
            ? parsedRetryDelayMs
            : Math.min(8000, 500 * Math.pow(2, attempt - 1));

        console.warn(
          `Gemini transient error while streaming section="${section}" (attempt ${attempt}/${maxRetries}). ` +
            `Retrying in ${backoffMs}ms. Details: ${msg}`
        );

        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  async function generateSection(prompt, section) {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    await streamWithRetries(res, model, prompt, section, { maxRetries: 3 });
  }

  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);

  try {
    sseWrite(res, { type: "start" });
    await generateSection(
      buildCreativePrompt(trimmedConcept, safeLang),
      "creative"
    );
    await generateSection(
      buildThumbnailPrompt(trimmedConcept, safeLang),
      "thumbnail"
    );
    await generateSection(buildSeoPrompt(trimmedConcept, safeLang), "seo");
    sseWrite(res, { type: "done" });
  } catch (err) {
    console.error("Generation error:", err);
    const msg = String(err?.message || "");
    const is403 = msg.includes("403");
    const message = is403
      ? "Gemini API returned 403 Forbidden. Verify your API key and model access."
      : err?.message || "Something went wrong while generating content.";
    sseWrite(res, { type: "error", message });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

// Serve the frontend (single-service deployment)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// For routes not handled above (and to support direct /path loads), return index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`\n🎬 Vibe-VlogAI running at http://${HOST}:${PORT}`);
  console.log(`   Model: ${GEMINI_MODEL}\n`);
});

