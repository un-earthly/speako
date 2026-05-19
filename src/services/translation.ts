import { detectScript } from './language-detect';
import { getLanguageByCode } from '../constants/languages';

// Optional DeepL key — set to unlock 500K chars/month free tier
const DEEPL_API_KEY = '';

// Build full locale string (e.g. 'fr-FR', 'bn-BD') from a base code.
// MyMemory gives significantly better results with full locale pairs.
function toLocale(code: string): string {
  const lang = getLanguageByCode(code);
  return lang ? `${lang.code}-${lang.countryCode}` : code;
}

// ── Individual translation backends ──────────────────────────────────────────

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

// ── Auto-detect source language ───────────────────────────────────────────────

export function detectSourceLanguage(text: string, fallback: string): string {
  return detectScript(text) ?? fallback;
}

// ── Main translation entry point ──────────────────────────────────────────────

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const src = sourceLang.split('-')[0];
  const tgt = targetLang.split('-')[0];
  if (!text.trim() || src === tgt) return text;

  const srcLocale = toLocale(src);
  const tgtLocale = toLocale(tgt);

  // 1. DeepL — highest quality (requires free key), handles long text natively
  const deepl = await translateWithDeepL(text, src, tgt);
  if (deepl && deepl !== text) return deepl;

  // 2. MyMemory with full locale pair, chunked for the 500-char free-tier limit
  const myMemory = await translateChunked(text, (chunk) =>
    translateWithMyMemory(chunk, srcLocale, tgtLocale)
  );
  if (myMemory && myMemory !== text) return myMemory;

  // 3. LibreTranslate fallback, also chunked
  const libre = await translateChunked(text, (chunk) =>
    translateWithLibre(chunk, src, tgt)
  );
  if (libre && libre !== text) return libre;

  return text;
}
