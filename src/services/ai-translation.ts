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

export type DetectTranslateContext = {
  /**
   * Recent conversation lines (most recent last) to ground the model in topic,
   * names, and each speaker's way of talking. Plain text, newline-separated.
   */
  history?: string;
  /**
   * A soft hint from acoustic detection (e.g. Whisper's detected language name).
   * Treated as a clue, NOT a rule — the model may override it, which is what we
   * want for code-mixed speech.
   */
  acousticHint?: string;
};

// Single-call understanding + translation using GPT.
//
// This intentionally does NOT force the input into a single clean language.
// Real speakers code-mix (Banglish, Hinglish, Arabic-English, Spanglish, …),
// so we hand the model the raw utterance plus conversation context and let it
// reason about the *intended meaning* and which participant most likely spoke.
// We only resolve a directional label (A or B) for the UI; the comprehension
// itself stays unconstrained.
export async function detectAndTranslate(
  text: string,
  langA: string,
  langB: string,
  langAName: string,
  langBName: string,
  context: DetectTranslateContext = {},
): Promise<{ translated: string; sourceLang: string; targetLang: string } | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const system = `You are Speako AI, a real-time interpreter sitting between two people in a live conversation:
- Person A speaks ${langAName} (code: "${langA}").
- Person B speaks ${langBName} (code: "${langB}").

Your job: understand what was just said, then produce a clean translation for the OTHER person to read.

How real speech works — read carefully:
- Speakers frequently MIX languages within one utterance (e.g. Banglish = Bengali + English, Hinglish, Arabic + English, Spanglish). A sentence may be mostly one language with foreign words, names, or whole phrases dropped in.
- Speech-to-text is imperfect: words may be cut off, misheard, or run together. Use meaning and the conversation context to repair obvious errors before translating.
- Do not translate word-for-word. Capture the intent, tone, and register; adapt idioms and slang naturally.
- Keep names, brands, URLs, code, hashtags, numbers, and untranslatable technical terms intact.

Deciding direction:
- Figure out which person most likely spoke this, based on the DOMINANT language of intent (not just a few borrowed words) and the conversation context. That person is the source; translate INTO the other person's language so their counterpart understands.
- A code-mixed utterance still has one intended audience — translate the COMPLETE meaning into the target language, leaving no foreign-script or mixed fragments untranslated.
${context.acousticHint ? `- Acoustic detection guessed the audio sounded like: "${context.acousticHint}". Treat this only as a weak hint; override it if the words and context say otherwise.\n` : ''}
Respond with ONLY valid JSON in this exact shape:
{"sourceLang":"<"${langA}" or "${langB}" — whichever person spoke>","translated":"<full natural translation in the OTHER person's language>"}

Rules:
- "sourceLang" must be exactly "${langA}" or "${langB}".
- "translated" must be the full, natural translation — no quotes, no notes, no leftover source-language fragments.`;

    const userParts: string[] = [];
    if (context.history?.trim()) {
      userParts.push(`Recent conversation (for context only, do not translate this):\n${context.history.trim()}`);
    }
    userParts.push(`Utterance to translate:\n${text}`);

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
          { role: 'system', content: system },
          { role: 'user', content: userParts.join('\n\n') },
        ],
        temperature: 0.1,
        max_tokens: 700,
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
