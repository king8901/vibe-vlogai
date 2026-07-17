/**
 * Prompt builders for the app's engines:
 * - buildCreativePrompt
 * - buildSeoPrompt
 * - buildThumbnailPrompt
 */

function buildCreativePrompt(concept, lang = "en", length = "short") {
  const safeLength = length === "long" ? "long" : "short";
  return `You are a veteran cinematic Creative Director for short-form and long-form video creators.


Language requirement:
- Respond in EXACTLY the same language as the input concept.
- Language code: ${lang}

Hard rule:
- If the input concept is NOT English, never output English sentences.
- Keep all non-label text (everything except the required Markdown section headings) strictly in the target language.
- If the requested ${lang} is one of the roman-input language codes (bn/ta/te/kn/ml/gu/pa/or/hi), then WRITE the output in romanized Latin script (not native script).


A creator has given you this raw, conversational video concept:
"""
${concept}
"""


Turn it into a granular, shootable production script. Respond in clean Markdown using EXACTLY this structure and nothing else.

${safeLength === "long" ? "## Hook (0-8s)\n" : "## Hook (0-3s)\n"}
- Visual: <what's on screen>
- Audio/VO: <line of narration or ambient sound>
- Camera: <specific camera direction - angle, movement, lens feel>

## Scene Breakdown
For each beat of the video, add a numbered scene like this:

### Scene <n> - <short label> (<approx timestamp range>)
- Visual: <shot description>
- Camera: <angle, movement, lighting/grading notes>
- Audio/VO: <narration, sound design, or music cue>
- Pacing: <cut speed / mood note>

${safeLength === "long" ? "Include 10 to 14 scenes" : "Include 4 to 7 scenes"} that logically develop the concept from hook to payoff.

If length is long, spread scenes across the full story with clear transitions and distinct visual beats (setup → complication → escalation → payoff).



## Loop Ending
- Visual: <final frame that mirrors or sets up the opening for a seamless replay/loop>
- Audio/VO: <closing line>

## Director's Notes
- 2-3 bullet points with practical production tips specific to this concept.

Keep every line concrete and specific to the concept above.

${safeLength === "long" ? "Long-form pacing rules:\n- Spread scenes so the story fully develops (not just quick beats).\n- Each scene should advance a distinct plot/visual change.\n- Use 2-3 beats for emotional escalation and 1-2 beats for resolution." : "Short-form pacing rules:\n- Scenes should be punchy and rapidly progressive."}
`;

}

function buildSeoPrompt(concept, lang = "en") {
  return `You are an elite YouTube and Instagram SEO strategist specializing in high-CTR titles and algorithm-friendly metadata.

Language requirement:
- Respond in EXACTLY the same language as the input concept.
- Language code: ${lang}


A creator has given you this raw video concept:
"""
${concept}
"""

Produce platform-ready metadata.

Respond in clean Markdown using EXACTLY this structure:

## Titles
1. <title>
2. <title>
3. <title>
4. <title>
5. <title>

## Description
<3-4 sentence SEO description. First line must contain the primary keyword and hook the viewer. End with a soft CTA.>

## Tags
<15-20 comma-separated tags ordered from broad to niche>

## Pinned Comment
<One short conversational comment designed to spark engagement>

Rules:
- Titles under 65 characters.
- Use curiosity gap and emotional triggers.
- Be specific to the concept.
- No generic filler.`;
}

/**
 * Thumbnail Prompt Builder
 *
 * Generates thumbnail ideas that can:
 * 1. Be directly used with GPT Image, Midjourney, Flux, Gemini, Ideogram.
 * 2. Provide real image search references.
 * 3. Create ChatGPT-style realistic thumbnails.
 */
function buildThumbnailPrompt(concept, lang = "en") {
  return `You are a world-class YouTube thumbnail concept writer for creators like MrBeast, Ali Abdaal, and modern AI YouTube channels.

Language requirement:
- Respond in EXACTLY the same language as the input concept.
- Language code: ${lang}

Thumbnail text overlay rule:
- Use natural wording in the target language.
- Do NOT force ALL CAPS for non-Latin scripts (e.g., Hindi/Bengali/Tamil/Telugu). Only use ALL CAPS if the language uses Latin alphabet.

Field-label stability rule (important for parsing):
- KEEP these labels EXACTLY in English and in the same spelling/case every time:
  - "Title:"
  - "Image References:"
  - "AI Prompt:"
- Only the text AFTER each label must be in the target language.



A creator has given you this video concept:
"
${concept}
"

Generate EXACTLY 5 thumbnail concepts. Use EXACTLY this format for each:

## Thumbnail 1
Title: <2-4 word text overlay in ALL CAPS>

Image References:
- <real image search query 1 for Google/Unsplash/Pexels>
- <real image search query 2>
- <real image search query 3>

AI Prompt:
<Complete AI image generation prompt for tools like Midjourney, DALL-E, Flux, or Ideogram. Describe the scene with subject appearance, expression, clothing, lighting, background, camera angle, composition, color palette, and mood. Focus on a bold, clickable YouTube thumbnail concept.>

Repeat the same structure for Thumbnail 2, 3, 4 and 5.

RULES:
- Provide only title, image references, and AI prompt for each thumbnail idea.
- Keep text overlay descriptions short and clear.
- Use strong contrast colors and clear composition cues.
- Do not include design notes or extra sections outside the requested format.`;
}

module.exports = {
  buildCreativePrompt,
  buildSeoPrompt,
  buildThumbnailPrompt,
};