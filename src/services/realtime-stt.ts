/**
 * Realtime streaming transcription over the OpenAI Realtime API.
 *
 * Unlike whisper.ts (batch: stop → upload file → wait), this holds ONE
 * persistent WebSocket open for the whole conversation and streams raw mic
 * audio continuously. The server emits:
 *   - interim transcript deltas  → live "word-by-word + self-correcting" caption
 *   - completed segments         → a finished utterance to translate & send
 *   - server-side VAD events      → speech start/stop, so we never stop the mic
 *
 * Language is auto-detected by the model (no fixed locale), which is why this
 * works identically across iOS / Android — it does not touch any native speech
 * engine.
 *
 * Requires a raw PCM mic stream (react-native-live-audio-stream) and therefore
 * a custom dev build / prebuild — it will not run in Expo Go.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

// Loaded lazily so a missing native module / web target doesn't crash import.
let LiveAudioStream: any = null;
function getAudioStream() {
  if (LiveAudioStream) return LiveAudioStream;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LiveAudioStream = require('react-native-live-audio-stream').default;
  return LiveAudioStream;
}

// Dev fallback only — production uses the ephemeral token from the server.
const DEV_API_KEY =
  process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? process.env.EXPO_PUBLIC_OPENAI_KEY ?? '';

// Mint a short-lived ephemeral token via our Firebase function so the real key
// never ships in the app. Falls back to the dev key if the function isn't
// deployed yet (so local testing still works).
async function getRealtimeToken(): Promise<string | null> {
  try {
    const fn = httpsCallable<unknown, { token: string }>(getFunctions(), 'mintRealtimeToken');
    const res = await fn({});
    if (res.data?.token) return res.data.token;
  } catch (e) {
    console.warn('[Realtime] ephemeral token mint failed, falling back to dev key:', e);
  }
  return DEV_API_KEY || null;
}

// OpenAI Realtime expects PCM16, mono, 24 kHz.

// OpenAI Realtime expects PCM16, mono, 24 kHz.
const SAMPLE_RATE = 24000;

export type RealtimeHandlers = {
  /** Fires on every interim update — the full current hypothesis, not a delta. */
  onPartial?: (text: string) => void;
  /** Fires when a turn finalizes — a complete utterance ready to translate. */
  onSegment?: (text: string) => void;
  /** Server VAD detected speech start / end (drives the waveform + UI state). */
  onSpeechStart?: () => void;
  onSpeechStop?: () => void;
  onOpen?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

export class RealtimeTranscriber {
  private ws: WebSocket | null = null;
  private handlers: RealtimeHandlers = {};
  private partial = '';
  private started = false;

  get active() {
    return this.started;
  }

  start(handlers: RealtimeHandlers) {
    if (this.started) return;
    this.handlers = handlers;
    this.partial = '';
    this.started = true; // set synchronously so `active` guards work immediately
    void this.connect();
  }

  private async connect() {
    const token = await getRealtimeToken();
    if (!token) {
      this.started = false;
      this.handlers.onError?.('No OpenAI credentials available');
      return;
    }
    if (!this.started) return; // stopped while minting the token

    // RN's WebSocket supports a third `options` arg with headers (the DOM lib
    // type doesn't, hence the cast). Browsers can't set headers — there you'd
    // pass the ephemeral token a different way.
    const WS = WebSocket as any;
    const ws: WebSocket = new WS(
      'wss://api.openai.com/v1/realtime?intent=transcription',
      undefined,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      },
    );
    this.ws = ws;

    ws.onopen = () => {
      // Configure the transcription session: pcm16 in, gpt-4o-transcribe,
      // server-side VAD for turn segmentation, language auto (omit `language`).
      this.send({
        type: 'transcription_session.update',
        session: {
          input_audio_format: 'pcm16',
          input_audio_transcription: { model: 'gpt-4o-transcribe' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
          input_audio_noise_reduction: { type: 'near_field' },
        },
      });
      this.startMic();
      this.handlers.onOpen?.();
    };

    ws.onmessage = (ev) => this.onServerEvent(ev.data);
    ws.onerror = (e: any) => this.handlers.onError?.(e?.message ?? 'socket error');
    ws.onclose = () => {
      this.started = false;
      this.handlers.onClose?.();
    };
  }

  stop() {
    this.started = false;
    try { getAudioStream().stop(); } catch { /* ignore */ }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
  }

  // ── Mic streaming ──────────────────────────────────────────────────────────

  private startMic() {
    const Audio = getAudioStream();
    Audio.init({
      sampleRate: SAMPLE_RATE,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6, // Android VOICE_RECOGNITION; ignored on iOS
      bufferSize: 4096,
    });
    // Emits base64-encoded PCM16 chunks — forward straight to the socket.
    Audio.on('data', (chunk: string) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'input_audio_buffer.append', audio: chunk });
      }
    });
    Audio.start();
  }

  // ── Server events ──────────────────────────────────────────────────────────

  private onServerEvent(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'input_audio_buffer.speech_started':
        this.partial = '';
        this.handlers.onSpeechStart?.();
        break;

      case 'input_audio_buffer.speech_stopped':
        this.handlers.onSpeechStop?.();
        break;

      // Interim transcript pieces for the current utterance.
      case 'conversation.item.input_audio_transcription.delta':
        if (typeof msg.delta === 'string') {
          this.partial += msg.delta;
          this.handlers.onPartial?.(this.partial);
        }
        break;

      // The utterance finalized.
      case 'conversation.item.input_audio_transcription.completed': {
        const text = (msg.transcript ?? this.partial ?? '').trim();
        this.partial = '';
        if (text) this.handlers.onSegment?.(text);
        break;
      }

      case 'error':
        this.handlers.onError?.(msg.error?.message ?? 'realtime error');
        break;
    }
  }

  private send(obj: unknown) {
    try { this.ws?.send(JSON.stringify(obj)); } catch { /* ignore */ }
  }
}
