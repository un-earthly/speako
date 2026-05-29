import { getLanguageByCode } from '../constants/languages';
import { translateWithAI } from './ai-translation';

// Optional DeepL key — set to unlock 500K chars/month free tier
const DEEPL_API_KEY = '';

// Build full locale string (e.g. 'fr-FR', 'bn-BD') from a base code.
// MyMemory gives significantly better results with full locale pairs.
function toLocale(code: string): string {
  const lang = getLanguageByCode(code);
  return lang ? `${lang.code}-${lang.countryCode}` : code;
}

// ── Individual translation backends ──────────────────────────────────────────

async function translateWithGoogle(text: string, src: string, tgt: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const json = await res.json();
    const translated = (json[0] as any[][])
      ?.map((chunk) => chunk[0] || '')
      .join('');
    if (!translated || translated === text) return null;
    return translated;
  } catch {
    return null;
  }
}

async function translateWithDeepL(text: string, src: string, tgt: string): Promise<string | null> {
  if (!DEEPL_API_KEY) return null;
  try {
    const srcCode = src.toUpperCase();
    const tgtCode = tgt.toUpperCase() === 'EN' ? 'EN-US' : tgt.toUpperCase();
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [text], source_lang: srcCode, target_lang: tgtCode }),
    });
    const json = await res.json();
    return json.translations?.[0]?.text || null;
  } catch {
    return null;
  }
}

// src/tgt should be full locales like 'fr-FR', 'bn-BD'
async function translateWithMyMemory(text: string, src: string, tgt: string): Promise<string | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${src}|${tgt}`;
    const json = await (await fetch(url)).json();
    if (json.responseStatus === 200) {
      const primary = json.responseData?.translatedText;
      if (!primary || primary === text) return null;
      // Discard if result has far more words than input — sign of acronym expansion
      const inWords = text.trim().split(/\s+/).length;
      const outWords = primary.trim().split(/\s+/).length;
      if (outWords > inWords * 3 && inWords <= 2) return null;
      return primary;
    }
    return null;
  } catch {
    return null;
  }
}

// LibreTranslate only accepts base 2-letter codes
async function translateWithLibre(text: string, src: string, tgt: string): Promise<string | null> {
  try {
    const res = await fetch('https://translate.argosopentech.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: src.split('-')[0], target: tgt.split('-')[0], format: 'text' }),
    });
    const json = await res.json();
    return json.translatedText || null;
  } catch {
    return null;
  }
}

const MYMEMORY_CHAR_LIMIT = 480;

// Split text into chunks that fit within the API character limit,
// breaking at sentence boundaries where possible.
function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';
  for (const sentence of sentences) {
    if ((current + (current ? ' ' : '') + sentence).length > limit) {
      if (current) chunks.push(current);
      // Single sentence longer than limit — hard split on word boundary
      if (sentence.length > limit) {
        const words = sentence.split(' ');
        current = '';
        for (const word of words) {
          const next = current ? `${current} ${word}` : word;
          if (next.length > limit) {
            if (current) chunks.push(current);
            current = word;
          } else {
            current = next;
          }
        }
      } else {
        current = sentence;
      }
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateChunked(
  text: string,
  translateFn: (chunk: string) => Promise<string | null>,
): Promise<string | null> {
  const chunks = chunkText(text, MYMEMORY_CHAR_LIMIT);
  const results: string[] = [];
  for (const chunk of chunks) {
    const result = await translateFn(chunk);
    if (!result) return null;
    results.push(result);
  }
  return results.join(' ');
}

// ── Auto-detect source language and translate ─────────────────────────────────

// Calls Google Translate with sl=auto&tl=langA.
// If Google detects the source as langB (or not langA), the returned translation
// is already langB→langA — no second call needed, no forced sl= on the wrong script.
// If Google detects langA, we make one more call to translate to langB.
export async function translateAutoDetect(
  text: string,
  langA: string,
  langB: string,
): Promise<{ translated: string; sourceLang: string; targetLang: string }> {
  const langABase = langA.split('-')[0];
  const langBBase = langB.split('-')[0];
  if (!text.trim() || langABase === langBBase) {
    return { translated: text, sourceLang: langA, targetLang: langB };
  }
  try {
    // Translate to langA with auto-detect — one call gives us detected lang + translation
    const urlA = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langABase}&dt=t&q=${encodeURIComponent(text)}`;
    const resA = await fetch(urlA);
    const jsonA = await resA.json();
    const detectedSource: string = (jsonA[2] ?? '').split('-')[0];
    const translatedToA = (jsonA[0] as any[][])?.map((c) => c[0] || '').join('') ?? '';

    if (detectedSource !== langABase) {
      // Google detected something other than langA → Person B is speaking
      // translatedToA is already the correct langB→langA translation
      return {
        translated: translatedToA && translatedToA !== text ? translatedToA : text,
        sourceLang: langB,
        targetLang: langA,
      };
    }

    // Google detected langA → Person A is speaking, translate to langB
    const urlB = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${langABase}&tl=${langBBase}&dt=t&q=${encodeURIComponent(text)}`;
    const resB = await fetch(urlB);
    const jsonB = await resB.json();
    const translatedToB = (jsonB[0] as any[][])?.map((c) => c[0] || '').join('') ?? '';
    return {
      translated: translatedToB && translatedToB !== text ? translatedToB : text,
      sourceLang: langA,
      targetLang: langB,
    };
  } catch {
    const translated = await translateText(text, langA, langB);
    return { translated, sourceLang: langA, targetLang: langB };
  }
}

// ── Main translation entry point ──────────────────────────────────────────────

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  useAI: boolean = false,
): Promise<string> {
  const src = sourceLang.split('-')[0];
  const tgt = targetLang.split('-')[0];
  if (!text.trim() || src === tgt) return text;

  // 0. AI Translation (premium)
  if (useAI) {
    const ai = await translateWithAI(text, src, tgt);
    if (ai && ai !== text) return ai;
  }

  const srcLocale = toLocale(src);
  const tgtLocale = toLocale(tgt);

  // 1. DeepL — highest quality (requires free key), handles long text natively
  const deepl = await translateWithDeepL(text, src, tgt);
  if (deepl && deepl !== text) return deepl;

  // 2. Google Translate (unofficial client, no key required, most reliable free option)
  const google = await translateWithGoogle(text, src, tgt);
  if (google && google !== text) return google;

  // 3. MyMemory with full locale pair, chunked for the 500-char free-tier limit
  const myMemory = await translateChunked(text, (chunk) =>
    translateWithMyMemory(chunk, srcLocale, tgtLocale)
  );
  if (myMemory && myMemory !== text) return myMemory;

  // 4. LibreTranslate fallback, also chunked
  const libre = await translateChunked(text, (chunk) =>
    translateWithLibre(chunk, src, tgt)
  );
  if (libre && libre !== text) return libre;

  return text;
}
