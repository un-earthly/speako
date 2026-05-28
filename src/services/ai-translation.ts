const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

export async function translateWithAI(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    console.warn('[AI Translation] No EXPO_PUBLIC_OPENAI_API_KEY set, returning null');
    return null;
  }

  try {
    const response = await fetch('https://api.kimi.com/coding/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        "User-Agent": "Kimi CLI (Linux 6.17.0-29-generic x86_64)"
      },
      body: JSON.stringify({
        model: 'kimi-for-coding',
        messages: [
          {
            role: 'system',
            content: `You are Speako AI, a high-precision multilingual translation engine.
                Your task is to translate text from ${sourceLang} to ${targetLang} naturally, accurately, and fluently.

                Core Rules:
                - Preserve the original meaning, intent, tone, emotion, and context.
                - Adapt idioms, slang, and culturally specific phrases naturally instead of translating them literally.
                - Maintain the speaker’s style:
                  - casual stays casual
                  - formal stays formal
                  - professional stays professional
                  - emotional stays emotional
                - Preserve formatting, paragraph spacing, bullet points, emojis, punctuation, and line breaks whenever possible.
                - Keep names, brands, URLs, code snippets, emails, hashtags, and technical terms unchanged unless they should normally be translated in the target language.
                - If the input already appears to be in ${targetLang}, return it naturally improved only if needed.
                - For ambiguous phrases, choose the most contextually natural translation.
                - Never censor, summarize, explain, interpret, or add extra commentary.
                - Never wrap output in quotes.
                - Never include notes like "Translation:" or explanations.

                Special Handling:
                - For short conversational messages, prioritize natural human phrasing over literal accuracy.
                - For UI text, keep translations concise and interface-friendly.
                - For business/professional text, prioritize clarity and professionalism.
                - For social media/chat messages, preserve internet tone and energy.

                Output Rules:
                - Respond with ONLY the translated text.
                - Do not include markdown.
                - Do not include metadata.
                - Do not explain decisions.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    const json = await response.json();
    const translated = json.choices?.[0]?.message?.content?.trim();
    if (!translated || translated === text) return null;
    return translated;
  } catch (err) {
    console.warn('[AI Translation] Error:', err);
    return null;
  }
}
