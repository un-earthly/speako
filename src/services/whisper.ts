// Support both env var names used across the app (ai-translation.ts uses
// EXPO_PUBLIC_OPENAI_API_KEY; this file historically used EXPO_PUBLIC_OPENAI_KEY).
const API_KEY =
  process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? process.env.EXPO_PUBLIC_OPENAI_KEY ?? '';

export type Transcription = {
  /** The transcribed text. */
  text: string;
  /**
   * The language Whisper detected, as a full lowercase name (e.g. "english",
   * "bengali", "spanish"). Empty string when unavailable.
   */
  language: string;
};

export type TranscribeOptions = {
  /**
   * Biasing context passed to Whisper's `prompt` field. Use recent conversation
   * text, names, and domain terms — it nudges spelling/vocabulary and reduces
   * mid-word cutoffs on proper nouns. Keep it short (~200 chars is plenty).
   */
  prompt?: string;
  /**
   * Optional ISO-639-1 hint (e.g. "en", "bn"). Omit to let Whisper auto-detect,
   * which is what the face-to-face flow wants.
   */
  language?: string;
  /** File extension/codec hint for the multipart upload. Default "m4a". */
  ext?: 'm4a' | 'wav' | 'caf';
};

/**
 * Transcribe an audio file with OpenAI Whisper.
 *
 * Returns both the text AND the detected language (via verbose_json), so callers
 * can route translation directionally instead of guessing the source language.
 */
export async function transcribeAudio(
  uri: string,
  options: TranscribeOptions = {},
): Promise<Transcription> {
  if (!API_KEY) throw new Error('OpenAI API key is not set');

  const ext = options.ext ?? 'm4a';
  const mime =
    ext === 'wav' ? 'audio/wav' : ext === 'caf' ? 'audio/x-caf' : 'audio/m4a';

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: `recording.${ext}`,
    type: mime,
  } as any);
  formData.append('model', 'whisper-1');
  // verbose_json surfaces the detected `language` field.
  formData.append('response_format', 'verbose_json');
  if (options.prompt) formData.append('prompt', options.prompt.slice(0, 880));
  if (options.language) formData.append('language', options.language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Whisper error ${res.status}: ${msg}`);
  }

  const data = await res.json();
  return {
    text: data.text?.trim() ?? '',
    language: (data.language ?? '').toLowerCase(),
  };
}
