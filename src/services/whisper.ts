const API_KEY = process.env.EXPO_PUBLIC_OPENAI_KEY ?? '';

export async function transcribeAudio(uri: string): Promise<string> {
  if (!API_KEY) throw new Error('EXPO_PUBLIC_OPENAI_KEY is not set');

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as any);
  formData.append('model', 'whisper-1');

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
  return data.text?.trim() ?? '';
}
