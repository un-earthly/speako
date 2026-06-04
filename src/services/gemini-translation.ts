import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from '../config/firebase';

let model: ReturnType<typeof getGenerativeModel> | null = null;

function getModel() {
  if (!model) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    model = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash',
    });
  }
  return model;
}

export async function translateWithGemini(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  try {
    const prompt =
      `Translate the following text from ${sourceLang} to ${targetLang}.\n` +
      `Output ONLY the translated text. No explanations, no quotes, no extra content.\n\n` +
      `Text: ${text}`;

    const result = await getModel().generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    });

    const translated = result.response.text().trim();
    if (!translated || translated === text) return null;
    return translated;
  } catch (err) {
    console.warn('[Gemini Translation] Error:', err);
    return null;
  }
}
