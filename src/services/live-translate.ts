import { detectScript } from './language-detect';

/**
 * Live, concurrent translation of a streaming (partial) transcript — the
 * translation-side equivalent of the source caption rewriting itself.
 *
 * Design goals (so it runs in parallel with listening, never blocking it):
 *  - Debounced: coalesces rapid partials into ~1 call per 300ms.
 *  - Stale-guarded: a sequence number means a slow response for old text can
 *    never overwrite a newer partial (out-of-order safety).
 *  - Direction locked once per utterance: we detect A→B vs B→A a single time,
 *    cheaply, then reuse it for the rest of the utterance.
 *  - Fast/free path (Google endpoint) for the live preview; the authoritative,
 *    context-aware GPT translation still runs once on the finalized segment.
 */

async function fastTranslate(text: string, src: string, tgt: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${tgt}&dt=t&q=${encodeURIComponent(text)}`;
    const json = await (await fetch(url)).json();
    const out = (json[0] as any[][])?.map((c) => c[0] || '').join('') ?? '';
    return out || null;
  } catch {
    return null;
  }
}

// Detect which of the two languages is being spoken, cheaply.
// 1) local script detection (offline, instant) for different-script pairs
// 2) Google auto-detect (one network call) as a fallback for same-script pairs
async function detectDirection(
  text: string,
  langA: string,
  langB: string,
): Promise<{ src: string; tgt: string }> {
  const aBase = langA.split('-')[0];
  const bBase = langB.split('-')[0];

  const script = detectScript(text);
  if (script === bBase) return { src: bBase, tgt: aBase };
  if (script === aBase) return { src: aBase, tgt: bBase };

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${aBase}&dt=t&q=${encodeURIComponent(text)}`;
    const json = await (await fetch(url)).json();
    const detected: string = (json[2] ?? '').split('-')[0];
    if (detected === bBase) return { src: bBase, tgt: aBase };
  } catch {
    /* fall through */
  }
  return { src: aBase, tgt: bBase };
}

export class LiveTranslator {
  private seq = 0;
  private direction: { src: string; tgt: string } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = '';
  private langA = 'en';
  private langB = 'en';
  private onUpdate: (translated: string) => void = () => {};

  configure(langA: string, langB: string, onUpdate: (t: string) => void) {
    this.langA = langA;
    this.langB = langB;
    this.onUpdate = onUpdate;
  }

  /** New utterance — drop direction + invalidate any in-flight translation. */
  reset() {
    this.seq++;
    this.direction = null;
    this.pending = '';
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  /** Feed the latest partial transcript. Non-blocking; updates come via onUpdate. */
  feed(text: string) {
    this.pending = text;
    if (this.timer) return; // a run is already scheduled; it'll pick up `pending`
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run(this.pending);
    }, 300);
  }

  private async run(text: string) {
    const t = text.trim();
    if (!t) return;
    const mySeq = this.seq;

    if (!this.direction) {
      this.direction = await detectDirection(t, this.langA, this.langB);
      if (mySeq !== this.seq) return; // utterance changed while detecting
    }

    const translated = await fastTranslate(t, this.direction.src, this.direction.tgt);
    if (mySeq !== this.seq) return; // a newer partial superseded this one
    if (translated) this.onUpdate(translated);
  }
}
