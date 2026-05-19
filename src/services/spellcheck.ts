import { correctWithModel, isModelLoaded } from './local-llm';

export interface SpellMatch {
  offset: number;
  length: number;
  word: string;
  replacements: string[];
}

// Full locale codes used as preferredVariants when language is 'auto'
const LANG_MAP: Record<string, string> = {
  en: 'en-US',
  pt: 'pt-BR',
  zh: 'zh-CN',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  nl: 'nl-NL',
  ru: 'ru-RU',
  pl: 'pl-PL',
  sv: 'sv',
  da: 'da-DK',
  uk: 'uk-UA',
  ca: 'ca-ES',
  ro: 'ro-RO',
};

const ALLOWED_ISSUE_TYPES = new Set(['misspelling', 'typographical', 'grammar']);
const LT_TIMEOUT_MS = 8000;

// Languages LanguageTool covers well enough to not need the model fallback
const LT_SUPPORTED = new Set(Object.keys(LANG_MAP));

export async function checkSpelling(text: string, lang: string): Promise<SpellMatch[]> {
  if (!text.trim()) return [];

  // For languages LanguageTool supports, use it first
  if (LT_SUPPORTED.has(lang)) {
    const langCode = LANG_MAP[lang] ?? lang;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LT_TIMEOUT_MS);
    try {
      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        // Use explicit language code so single words are checked reliably
        body: new URLSearchParams({
          text,
          language: langCode,
        }).toString(),
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        const matches = (json.matches ?? [])
          .filter((m: any) => ALLOWED_ISSUE_TYPES.has(m.rule?.issueType) && m.replacements?.length > 0)
          .map((m: any) => ({
            offset: m.offset,
            length: m.length,
            word: text.substring(m.offset, m.offset + m.length),
            replacements: m.replacements.slice(0, 3).map((r: any) => r.value),
          }));
        if (matches.length > 0) return matches;
      }
    } catch {
      // fall through to model
    } finally {
      clearTimeout(timer);
    }
  }

  // Fallback: on-device model for unsupported languages or when LT returns nothing
  if (isModelLoaded()) {
    const corrected = await correctWithModel(text, lang);
    if (corrected && corrected !== text) {
      // Surface the whole text as a single suggestion
      return [{
        offset: 0,
        length: text.length,
        word: text,
        replacements: [corrected],
      }];
    }
  }

  return [];
}

export function applyCorrection(text: string, match: SpellMatch, replacement: string): string {
  return text.substring(0, match.offset) + replacement + text.substring(match.offset + match.length);
}
