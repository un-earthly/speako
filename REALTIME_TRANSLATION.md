# Realtime Translation — Remaining Work

Status of the Google-conversation-mode streaming pipeline (continuous listen →
transcribe → translate → display → speak, all in parallel).

## ✅ Done

- **Streaming STT** — [`src/services/realtime-stt.ts`](src/services/realtime-stt.ts):
  one persistent OpenAI Realtime WebSocket, raw PCM streamed continuously, interim
  deltas + final segments + server-VAD, auto language detection (no fixed locale).
- **Parallel live translation** — [`src/services/live-translate.ts`](src/services/live-translate.ts):
  debounced, stale-guarded translation of the rolling partial on a fast path; the
  translation rewrites itself as you speak.
- **Self-editing captions** — [`src/components/conversation/LiveCaption.tsx`](src/components/conversation/LiveCaption.tsx):
  prefix-diff renderer (locks stable prefix, animates the changed tail).
- **FaceToFace integration** — source + translation captions edit live; segment
  commit (authoritative GPT translate + Firestore + points) and auto-TTS run
  fire-and-forget. Whisper hybrid kept as automatic fallback.
- **Ephemeral-token security** — `mintRealtimeToken` Firebase callable **deployed
  & live** (us-central1). Client auto-prefers it; dev-key fallback for local.
- **Dependency** — `react-native-live-audio-stream@1.1.1` installed.

## 🔧 To run on device (Mac — native build required)

Prebuilt setup (`ios/` + `android/` exist) + EAS dev client. **Do NOT run
`expo prebuild --clean`** (would regenerate native dirs). The audio module just
autolinks.

**Local build:**
```bash
npx pod-install ios          # autolink native audio module (iOS)
npx expo run:ios             # or: npx expo run:android
```

**Or EAS dev build (matches eas.json):**
```bash
eas build --profile development --platform ios   # and/or android
npx expo start --dev-client
```

## 🔍 First-run verification checklist

- [ ] **OpenAI Realtime event names** — verify against current docs. Add a temp
  `console.log(msg.type)` at the top of `onServerEvent()` in `realtime-stt.ts`.
  If transcripts don't appear, the event names need adjusting (all isolated to
  that one switch).
- [ ] **Ephemeral session response shape** — confirm `client_secret.value` is the
  right path in `functions/index.js` `mintRealtimeToken`. Check logs:
  `firebase functions:log --only mintRealtimeToken`.
- [ ] **Token mint working** — if you see `[Realtime] ephemeral token mint failed`,
  it's falling back to the dev key. Confirm the user is signed in (function
  requires `request.auth`).
- [ ] **Mic streaming** — if no `data` events fire, the native module may not be
  linked or may be incompatible with new architecture (see Risks).
- [ ] **Latency / cost feel** — Realtime is billed per minute of audio; confirm
  acceptable for a multi-minute conversation.

## 🔐 Security follow-ups (before production)

- [ ] **Remove the dev OpenAI key from the client** (`EXPO_PUBLIC_OPENAI_KEY` /
  `EXPO_PUBLIC_OPENAI_API_KEY`) once the ephemeral token is verified working, so
  the long-lived key never ships in the app bundle.
- [ ] **Move Gmail app password to a secret** — currently `defineString` reads
  `functions/.env` in plaintext. Prefer `defineSecret` +
  `firebase functions:secrets:set GMAIL_APP_PASSWORD` (and the same for
  `OPENAI_API_KEY`).
- [ ] **Rate-limit `mintRealtimeToken`** — it's authed but unbounded; consider a
  per-user throttle to cap abuse of the streaming spend.

## ⚠️ Known risks / fallbacks

- **`react-native-live-audio-stream` is old** (last meaningful update years ago).
  If it misbehaves on RN 0.83 new architecture, drop-in alternatives:
  `@dr.pogodin/react-native-audio` or `expo-audio`'s streaming APIs — same
  `RealtimeTranscriber` interface, just swap `startMic()`.
- **Whisper hybrid fallback** — if the realtime socket errors (missing module /
  key), `fallbackToHybrid()` silently switches to the per-turn Whisper flow so
  voice still works. Set `REALTIME_ENABLED = false` in `FaceToFaceScreen.tsx` to
  force the hybrid path.
- **Web** — this targets iOS/Android. Browser WebSockets can't set auth headers;
  web would need the ephemeral token passed differently + Web Audio capture.

## 🚀 Phase 2 enhancements (not started)

- [ ] **Port streaming to `ConversationScreen`** (remote chat) — currently on the
  hybrid Whisper path.
- [ ] **TTS queue** — serialize/auto-interrupt overlapping segment speech instead
  of firing concurrently.
- [ ] **Live re-translation upgrade** — optionally use a streaming translation
  model so the committed translation also streams in, not just the preview.
- [ ] **Caption history** — show the last finalized line above the live captions
  for continuity during fast exchanges.
- [ ] **Settings toggles** — expose `AUTO_SPEAK`, silence sensitivity, and a
  realtime on/off switch in the UI.
