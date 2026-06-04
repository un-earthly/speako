const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const MODEL = 'gpt-5.4-mini';
const BASE_URL = 'https://api.openai.com/v1/chat/completions';

const SYSTEM_PROMPT = (src: string, tgt: string) => `\
You are Speako AI, a high-precision multilingual translation engine.
Translate from ${src} to ${tgt} naturally, accurately, and fluently.

Rules:
- Preserve meaning, tone, and intent exactly.
- Adapt idioms and slang naturally rather than literally.
- Keep names, brands, URLs, code, hashtags, and technical terms unchanged.
- For short conversational messages prioritise natural human phrasing.
- Output ONLY the translated text — no quotes, no notes, no explanations.`;

export async function translateWithAI(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT(sourceLang, targetLang) },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      console.warn('[AI Translation] OpenAI error:', res.status);
      return null;
    }

    const json = await res.json();
    const translated = json.choices?.[0]?.message?.content?.trim();
    if (!translated || translated === text) return null;
    return translated;
  } catch (err) {
    console.warn('[AI Translation] Error:', err);
    return null;
  }
}

// Single-call language detection + translation using GPT.
// Returns the translated text AND which language was detected as the source.
export async function detectAndTranslate(
  text: string,
  langA: string,
  langB: string,
  langAName: string,
  langBName: string,
): Promise<{ translated: string; sourceLang: string; targetLang: string } | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a translation engine. Determine whether the text is in ${langAName} (code: "${langA}") or ${langBName} (code: "${langB}"), then translate it to the other language.

Respond with ONLY valid JSON in this exact shape:
{"sourceLang":"<detected code>","translated":"<translation>"}

Rules:
- "sourceLang" must be exactly "${langA}" or "${langB}".
- "translated" must be the full, natural translation — no quotes, no explanations.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw);

    const sourceLang: string = parsed.sourceLang === langA ? langA : langB;
    const targetLang = sourceLang === langA ? langB : langA;
    const translated: string = parsed.translated?.trim() ?? text;

    return { translated, sourceLang, targetLang };
  } catch (err) {
    console.warn('[AI detectAndTranslate] Error:', err);
    return null;
  }
}
