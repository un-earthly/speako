// Fast script-based language detection — no model needed.
// Covers non-Latin scripts by Unicode range, then uses word patterns for Latin.

interface ScriptRange { lang: string; min: number; max: number }

const SCRIPT_RANGES: ScriptRange[] = [
  { lang: 'ar', min: 0x0600, max: 0x06FF }, // Arabic
  { lang: 'bn', min: 0x0980, max: 0x09FF }, // Bengali
  { lang: 'zh', min: 0x4E00, max: 0x9FFF }, // CJK Unified
  { lang: 'zh', min: 0x3400, max: 0x4DBF }, // CJK Extension A
  { lang: 'ja', min: 0x3040, max: 0x30FF }, // Hiragana + Katakana
  { lang: 'ko', min: 0xAC00, max: 0xD7AF }, // Hangul syllables
  { lang: 'hi', min: 0x0900, max: 0x097F }, // Devanagari (hi/mr/ne share this range)
  { lang: 'ru', min: 0x0400, max: 0x04FF }, // Cyrillic
  { lang: 'el', min: 0x0370, max: 0x03FF }, // Greek
  { lang: 'he', min: 0x0590, max: 0x05FF }, // Hebrew
  { lang: 'th', min: 0x0E00, max: 0x0E7F }, // Thai
  { lang: 'ta', min: 0x0B80, max: 0x0BFF }, // Tamil
  { lang: 'te', min: 0x0C00, max: 0x0C7F }, // Telugu
  { lang: 'ml', min: 0x0D00, max: 0x0D7F }, // Malayalam
  { lang: 'si', min: 0x0D80, max: 0x0DFF }, // Sinhala
  { lang: 'my', min: 0x1000, max: 0x109F }, // Myanmar
  { lang: 'km', min: 0x1780, max: 0x17FF }, // Khmer
  { lang: 'ur', min: 0x0600, max: 0x06FF }, // Urdu (Arabic script)
  { lang: 'fa', min: 0x0600, max: 0x06FF }, // Persian (Arabic script)
  { lang: 'uk', min: 0x0400, max: 0x04FF }, // Ukrainian (Cyrillic)
  { lang: 'gu', min: 0x0A80, max: 0x0AFF }, // Gujarati
  { lang: 'pa', min: 0x0A00, max: 0x0A7F }, // Punjabi (Gurmukhi)
  { lang: 'kn', min: 0x0C80, max: 0x0CFF }, // Kannada
  { lang: 'ka', min: 0x10A0, max: 0x10FF }, // Georgian
  { lang: 'lo', min: 0x0E80, max: 0x0EFF }, // Lao
  { lang: 'am', min: 0x1200, max: 0x137F }, // Ethiopic (Amharic)
  { lang: 'hy', min: 0x0530, max: 0x058F }, // Armenian
];

// Common word patterns for Latin-script languages
const LATIN_WORD_PATTERNS: Array<{ lang: string; words: string[] }> = [
  { lang: 'fr', words: ['le', 'la', 'les', 'de', 'du', 'un', 'une', 'est', 'et', 'en', 'je', 'tu', 'il', 'bonjour', 'oui', 'non', 'merci'] },
  { lang: 'es', words: ['el', 'la', 'los', 'de', 'un', 'una', 'es', 'y', 'en', 'yo', 'hola', 'gracias', 'por', 'que', 'no'] },
  { lang: 'de', words: ['der', 'die', 'das', 'ein', 'ist', 'und', 'ich', 'du', 'er', 'nicht', 'hallo', 'danke', 'bitte'] },
  { lang: 'pt', words: ['o', 'a', 'os', 'de', 'um', 'uma', 'é', 'e', 'eu', 'você', 'olá', 'obrigado', 'não'] },
  { lang: 'it', words: ['il', 'la', 'lo', 'di', 'un', 'una', 'è', 'e', 'io', 'ciao', 'grazie', 'non', 'che'] },
  { lang: 'nl', words: ['de', 'het', 'een', 'is', 'en', 'ik', 'jij', 'hallo', 'dank', 'niet', 'dat', 'van'] },
  { lang: 'pl', words: ['i', 'w', 'z', 'na', 'do', 'się', 'że', 'nie', 'to', 'tak', 'cześć', 'dziękuję'] },
  { lang: 'tr', words: ['ve', 'bir', 'bu', 'da', 'de', 'ki', 'için', 'ile', 'merhaba', 'teşekkür', 'evet', 'hayır'] },
  { lang: 'id', words: ['dan', 'yang', 'di', 'ke', 'dari', 'ini', 'itu', 'ada', 'halo', 'terima', 'tidak'] },
  { lang: 'vi', words: ['và', 'của', 'là', 'có', 'trong', 'đó', 'này', 'với', 'xin', 'chào', 'cảm', 'ơn'] },
  { lang: 'sv', words: ['och', 'att', 'det', 'är', 'en', 'ett', 'hej', 'tack', 'inte', 'jag', 'du', 'vi'] },
  { lang: 'no', words: ['og', 'er', 'det', 'en', 'et', 'ikke', 'hei', 'takk', 'jeg', 'du', 'vi', 'med'] },
  { lang: 'da', words: ['og', 'er', 'det', 'en', 'et', 'ikke', 'hej', 'tak', 'jeg', 'du', 'vi', 'med'] },
  { lang: 'fi', words: ['ja', 'on', 'ei', 'se', 'hei', 'kiitos', 'minä', 'sinä', 'että', 'mutta', 'olen', 'kyllä'] },
  { lang: 'cs', words: ['je', 'to', 'se', 'na', 'ahoj', 'díky', 'ano', 'jsem', 'jak', 'ale', 'pro', 'byl'] },
  { lang: 'hu', words: ['és', 'az', 'nem', 'van', 'egy', 'szia', 'igen', 'hogy', 'mi', 'de', 'én', 'köszönöm'] },
  { lang: 'ro', words: ['și', 'este', 'de', 'nu', 'că', 'un', 'o', 'bună', 'mulțumesc', 'da', 'eu', 'la'] },
  { lang: 'ca', words: ['i', 'el', 'la', 'els', 'les', 'de', 'és', 'no', 'hola', 'gràcies', 'però', 'que'] },
  { lang: 'ms', words: ['dan', 'yang', 'di', 'ke', 'tidak', 'saya', 'ini', 'itu', 'ada', 'helo', 'dengan', 'untuk'] },
  { lang: 'tl', words: ['at', 'ang', 'ng', 'sa', 'ay', 'na', 'ito', 'kumusta', 'salamat', 'hindi', 'ako', 'ikaw'] },
  { lang: 'sw', words: ['na', 'ya', 'wa', 'kwa', 'ni', 'hii', 'habari', 'asante', 'ndiyo', 'hapana', 'mimi', 'wewe'] },
  { lang: 'sq', words: ['dhe', 'është', 'në', 'me', 'si', 'mirëdita', 'faleminderit', 'po', 'jo', 'unë', 'çfarë'] },
  { lang: 'az', words: ['və', 'bu', 'bir', 'çox', 'salam', 'bəli', 'xeyr', 'necə', 'nə', 'mən', 'ilə', 'üçün'] },
  { lang: 'hr', words: ['i', 'je', 'u', 'na', 'se', 'da', 'nije', 'bok', 'hvala', 'da', 'ne', 'što'] },
  { lang: 'sk', words: ['a', 'je', 'to', 'sa', 'na', 'ahoj', 'ďakujem', 'áno', 'nie', 'som', 'ako', 'ale'] },
  { lang: 'sl', words: ['in', 'je', 'to', 'se', 'na', 'živjo', 'hvala', 'da', 'ne', 'sem', 'kaj', 'ali'] },
  { lang: 'af', words: ['en', 'die', 'is', 'van', 'nie', 'hallo', 'dankie', 'ja', 'dit', 'wat', 'met', 'het'] },
  { lang: 'et', words: ['ja', 'on', 'ei', 'see', 'ka', 'tere', 'aitäh', 'jah', 'olen', 'mis', 'aga', 'kui'] },
  { lang: 'lv', words: ['un', 'ir', 'no', 'ar', 'sveiki', 'paldies', 'jā', 'nē', 'es', 'tas', 'kas', 'par'] },
  { lang: 'lt', words: ['ir', 'su', 'ne', 'labas', 'ačiū', 'taip', 'aš', 'kas', 'yra', 'tai', 'bet', 'kaip'] },
  { lang: 'eu', words: ['eta', 'da', 'ez', 'bat', 'bai', 'kaixo', 'eskerrik', 'zer', 'nola', 'nor', 'baina', 'dago'] },
  { lang: 'gl', words: ['e', 'o', 'a', 'de', 'que', 'non', 'ola', 'grazas', 'si', 'con', 'por', 'eu'] },
  { lang: 'cy', words: ['a', 'y', 'yr', 'ac', 'mae', 'yn', 'yw', 'shwmae', 'diolch', 'ie', 'na', 'gyda'] },
  { lang: 'mt', words: ['u', 'il', 'li', 'ta', 'fi', 'mhux', 'bonġu', 'grazzi', 'iva', 'le', 'għax', 'jew'] },
  { lang: 'is', words: ['og', 'er', 'ekki', 'hæ', 'takk', 'já', 'nei', 'við', 'hvað', 'þetta', 'með', 'sem'] },
];

function countScriptChars(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    for (const range of SCRIPT_RANGES) {
      if (code >= range.min && code <= range.max) {
        counts[range.lang] = (counts[range.lang] ?? 0) + 1;
        break;
      }
    }
  }
  return counts;
}

export function detectScript(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  // Count characters by script
  const counts = countScriptChars(t);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // If >20% of chars belong to a non-Latin script, use it
  if (entries.length > 0 && entries[0][1] / t.length > 0.2) {
    return entries[0][0];
  }

  // Latin script — try word matching
  const words = t.toLowerCase().split(/\s+/);
  const scores: Record<string, number> = {};
  for (const { lang, words: patterns } of LATIN_WORD_PATTERNS) {
    scores[lang] = words.filter((w) => patterns.includes(w)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (best.length > 0 && best[0][1] > 0) return best[0][0];

  return null; // Unknown Latin-script language
}
