import { initLlama, type LlamaContext } from 'llama.rn';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Qwen2.5-0.5B: ~390 MB, strong multilingual translation, fast on mobile
const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';
const MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';

export const MODEL_PATH = `${FileSystem.documentDirectory}${MODEL_FILENAME}`;
export const MODEL_SIZE_MB = 390;

let ctx: LlamaContext | null = null;
let loadPromise: Promise<void> | null = null;

// ── Download ──────────────────────────────────────────────────────────────────

export async function isModelDownloaded(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  return info.exists && (info as any).size > 1_000_000;
}

export async function downloadModel(
  onProgress: (ratio: number) => void,
): Promise<void> {
  const dl = FileSystem.createDownloadResumable(
    MODEL_URL,
    MODEL_PATH,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      if (totalBytesExpectedToWrite > 0) {
        onProgress(totalBytesWritten / totalBytesExpectedToWrite);
      }
    },
  );
  await dl.downloadAsync();
}

export async function deleteModel(): Promise<void> {
  if (await isModelDownloaded()) {
    await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
  }
  ctx = null;
  loadPromise = null;
}

// ── Load ──────────────────────────────────────────────────────────────────────

export function isModelLoaded(): boolean {
  return ctx !== null;
}

export async function loadModel(): Promise<void> {
  if (ctx) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const downloaded = await isModelDownloaded();
    if (!downloaded) return;

    // Android paths must not have the file:// prefix
    const modelPath =
      Platform.OS === 'android'
        ? MODEL_PATH.replace('file://', '')
        : MODEL_PATH;

    ctx = await initLlama({
      model: modelPath,
      n_ctx: 512,   // small context — translation inputs are short
      n_threads: 4,
      n_gpu_layers: 0, // CPU-only for widest device compatibility
    });
  })();

  return loadPromise;
}

// ── Inference ─────────────────────────────────────────────────────────────────

const LANG_NAMES: Record<string, string> = {
  en: 'English', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
  pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', ru: 'Russian', uk: 'Ukrainian',
  ar: 'Arabic', he: 'Hebrew', fa: 'Persian', ur: 'Urdu',
  hi: 'Hindi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam',
  si: 'Sinhala', my: 'Burmese', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  tr: 'Turkish', ko: 'Korean', ja: 'Japanese', zh: 'Chinese',
  el: 'Greek', km: 'Khmer',
};

function langName(code: string): string {
  return LANG_NAMES[code.split('-')[0]] ?? code;
}

// Returns the corrected version of the text, or null if model isn't loaded.
// Used as a fallback spell/grammar fix for languages LanguageTool doesn't cover well.
export async function correctWithModel(text: string, lang: string): Promise<string | null> {
  if (!ctx) return null;
  const name = langName(lang);
  try {
    const { text: output } = await ctx.completion({
      messages: [
        {
          role: 'system',
          content:
            `You are a ${name} spell and grammar checker. Fix only spelling and grammar errors in the user's text. Output only the corrected text — no explanations, no quotes, no extra lines. If the text is already correct, output it unchanged.`,
        },
        { role: 'user', content: text },
      ],
      n_predict: 128,
      temperature: 0.0,
      top_p: 1.0,
      stop: ['\n\n', '<|im_end|>', '<|endoftext|>'],
    });
    const cleaned = output.trim().replace(/^["""'']+|["""'']+$/g, '').trim();
    return cleaned || null;
  } catch {
    return null;
  }
}

