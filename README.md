# VibeVlogAI — Your Friendly Script & SEO Buddy

An AI-powered creative partner for video creators. Paste a raw vlog idea and get back:
- a shot-by-shot **Production Script**
- **Thumbnail Concept(s)**
- **Publish-ready SEO metadata** (titles, description, tags, pinned comment)

All three outputs stream live from the backend using **Server-Sent Events (SSE)** via the Gemini API.

```
vibe-vlogai/
├── backend/     Node.js + Express, streams from Gemini via SSE
└── frontend/    Plain HTML/CSS/JS dashboard (no build step)
```

---

## Quick Start

### 1) Get a Gemini API key

Create/get your key at: https://aistudio.google.com/apikey

### 2) Run the backend (required)

```bash
cd backend
npm install
```

Create `backend/.env` (see **.env** section below) and then run:

```bash
npm start
```

You should see:

```text
🎬 Vibe-VlogAI backend running at http://localhost:5050
```

### 3) Run the frontend (static)

The frontend is plain static files. Easiest options:

- Serve the `frontend/` folder (so the page can call the backend):

```bash
cd frontend
npx serve .
```

- Or open `frontend/index.html` directly in your browser for quick checks (recommended only when backend access/cors is working in your environment).

### 4) Generate content

1. Type your vlog concept in the input box.
2. Click **Let’s go**.
3. Watch the three panels stream in order:
   - **Production Script** (`creative`)
   - **Thumbnail Concept** (`thumbnail`)
   - **Publish Metadata** (`seo`)
4. Use the **📋 copy** buttons to copy each panel.

---

## Configuration

### Required: `backend/.env`

Create a file at `backend/.env`:

```bash
GEMINI_API_KEY=YOUR_KEY_HERE
```

Optional settings:

```bash
GEMINI_MODEL=gemini-3.1-flash-lite
PORT=5050
```

### Env variables (reference)

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | Gemini API key (**required**) |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Model used for generation |
| `PORT` | `5050` | Backend server port |

---

## API Reference

### Health

**GET** `/api/health`

Response:

```json
{
  "status": "ok",
  "geminiApiKeyConfigured": true
}
```

### Generate (streaming)

**POST** `/api/generate`

Request body (JSON):

```json
{
  "concept": "string (required)",
  "lang": "string (optional; defaults to en)"
}
```

- `concept`: the raw vlog idea you provide
- `lang`: language code; the frontend sends one after auto-detection

Streaming format:
- Response `Content-Type`: `text/event-stream`
- The backend emits JSON payloads prefixed with SSE `data:` lines.

Event payloads:
- `type: "start"`
- `type: "chunk"`, with `section` in `{ "creative", "thumbnail", "seo" }`
  - fields: `{ type, section, text }`
- `type: "section-end"`, with `section`
- `type: "done"`
- `type: "error"`, fields: `{ type, message }`

---

## Language Support (auto-detect)

- The **frontend** detects the input language (based on script + romanized keywords) and sends `lang` to the backend.
- The **backend prompts** instruct the model to respond in **EXACTLY the same language** as your input concept.

Special roman-input handling:
- If `lang` is one of: `bn/ta/te/kn/ml/gu/pa/or/hi`
- …the backend prompt instructs the model to output in **romanized Latin script** (not native script).

---

## Output Formats (what you’ll see in the UI)

### 1) Production Script (`creative`)
Generated as clean Markdown with this structure:
- `## Hook`
- `## Scene Breakdown`
  - `### Scene <n> - <label> (<timestamp range>)`
- `## Loop Ending`
- `## Director's Notes`

### 2) Thumbnail Concept (`thumbnail`)
Generated as exactly **5** thumbnail concepts with strict English labels (important for parsing/display):
- `## Thumbnail 1`
- `Title: ...`
- `Image References:`
- `AI Prompt:`

Then repeated for Thumbnail 2–5.

### 3) Publish Metadata (`seo`)
Generated as clean Markdown with this structure:
- `## Titles` (5 titles)
- `## Description` (3–4 sentences)
- `## Tags` (15–20 comma-separated)
- `## Pinned Comment`

---

## Deployment (Render - Docker)

This project is a **single Node service** that serves the frontend and exposes the API.

### 1) Add environment variables in Render

Set:
- `GEMINI_API_KEY` = your Gemini key (**required**)
- (optional) `GEMINI_MODEL` = `gemini-3.1-flash-lite`
- (optional) `PORT` = `5050`
- (optional) `HOST` = `0.0.0.0`

### 2) Use Dockerfile

Render should build from the repo root using the provided `Dockerfile`, which starts:
- `node backend/server.js`

### 3) Port

Ensure the Render service listens on port **5050** (the backend exposes `5050` in the container).

After deployment, open the Render URL. The UI calls `POST /api/generate` and streams results via **SSE** on the same origin.

---


## Notes


- The Gemini API key is server-side only; it is **never exposed** to the browser.
- CORS is currently open in `backend/server.js` for local development. For production, restrict it to your frontend origin.

