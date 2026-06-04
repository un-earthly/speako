import { createAudioPlayer, AudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { ref, getDownloadURL, uploadString } from 'firebase/storage';
import { storage } from '../config/firebase';

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_KEY ?? '';
const CACHE_DIR = FileSystem.cacheDirectory + 'tts/';

let currentPlayer: AudioPlayer | null = null;
let currentOnEnd: (() => void) | null = null;

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

async function localPath(hash: string): Promise<string> {
  await ensureCacheDir();
  return CACHE_DIR + hash + '.mp3';
}

async function uploadToStorage(hash: string, base64: string): Promise<void> {
  try {
    const storageRef = ref(storage, `tts/${hash}.mp3`);
    await uploadString(storageRef, base64, 'base64', { contentType: 'audio/mpeg' });
  } catch {
    // Non-critical — local cache still works
  }
}

async function generateAndCache(text: string, hash: string, path: string): Promise<void> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: 'nova',
      response_format: 'mp3',
    }),
  });

  console.log('[TTS] OpenAI status:', res.status);

  if (!res.ok) {
    const body = await res.text();
    console.error('[TTS] OpenAI error:', body);
    throw new Error(`TTS API returned ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });

  const info = await FileSystem.getInfoAsync(path, { size: true });
  console.log('[TTS] saved file size:', (info as any).size, 'bytes');

  // Upload to Firebase Storage in background — don't await
  FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 })
    .then((base64) => uploadToStorage(hash, base64))
    .catch(() => {});
}

async function getAudioPath(text: string): Promise<string> {
  const hash = hashText(text);
  const path = await localPath(hash);

  // 1. Local cache hit (skip tiny/corrupt files)
  const localInfo = await FileSystem.getInfoAsync(path, { size: true });
  if (localInfo.exists) {
    const size = (localInfo as any).size ?? 0;
    console.log('[TTS] local cache hit, size:', size);
    if (size > 1000) return path;
    console.log('[TTS] cached file too small, deleting and regenerating');
    await FileSystem.deleteAsync(path, { idempotent: true });
  }

  // 2. Firebase Storage hit — download to local cache
  try {
    const storageRef = ref(storage, `tts/${hash}.mp3`);
    const url = await getDownloadURL(storageRef);
    console.log('[TTS] firebase storage hit, downloading...');
    await FileSystem.downloadAsync(url, path);
    return path;
  } catch (e) {
    console.log('[TTS] not in storage, generating via OpenAI...', e);
  }

  // 3. Generate via OpenAI, cache locally + upload to Storage
  await generateAndCache(text, hash, path);
  return path;
}

export async function speakText(text: string, onEnd?: () => void): Promise<void> {
  if (!text.trim()) return;

  if (currentPlayer) {
    currentPlayer.remove();
    currentPlayer = null;
    currentOnEnd?.();
    currentOnEnd = null;
  }

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldRouteThroughEarpiece: false,
    interruptionMode: 'duckOthers',
  });

  console.log('[TTS] getting audio path for:', text.slice(0, 40));
  const path = await getAudioPath(text);
  console.log('[TTS] got path:', path);

  currentPlayer = createAudioPlayer({ uri: path });
  currentOnEnd = onEnd ?? null;

  currentPlayer.addListener('playbackStatusUpdate', (status: any) => {
    if (status.didJustFinish) {
      currentOnEnd?.();
      currentOnEnd = null;
      currentPlayer?.remove();
      currentPlayer = null;
    }
  });

  console.log('[TTS] player created, calling play()');
  currentPlayer.play();
  console.log('[TTS] play() called');
}

export function pauseSpeaking(): void {
  currentPlayer?.pause();
}

export function resumeSpeaking(): void {
  currentPlayer?.play();
}

export function stopSpeaking(): void {
  if (currentPlayer) {
    currentPlayer.remove();
    currentPlayer = null;
  }
}
