import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import { speakText, pauseSpeaking, resumeSpeaking } from '../../services/tts';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getLanguageByCode } from '../../constants/languages';
import {
  sendMessage,
  subscribeToMessages,
  subscribeToConversation,
  deleteAllMessagesInConversation,
  type Message,
  type Conversation,
} from '../../services/firestore';
import { translateAutoDetect } from '../../services/translation';
import { transcribeAudio } from '../../services/whisper';
import { RealtimeTranscriber } from '../../services/realtime-stt';
import { LiveTranslator } from '../../services/live-translate';
import { LiveCaption } from '../../components/conversation/LiveCaption';
import { isSameDay, formatDateLabel } from '../../utils/date';
import { getMessageCost } from '../../utils/points';
import { POINTS, deductPoints, getUserPoints, rewardAdWatch } from '../../services/rewards';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import { AdBanner } from '../../components/common/AdBanner';
import { Timestamp } from 'firebase/firestore';

type Phase = 'idle' | 'recording' | 'processing';

export function FaceToFaceScreen({ route, navigation }: any) {
  const { conversationId, langA, langB } = route.params;
  const { user, points: authPoints } = useAuth();
  const { colors, isDark } = useTheme();
  const { showToast } = useToast();
  const { showAd: showRewardedAd } = useRewardedAd();
  const { showAd: showInterstitial } = useInterstitialAd();

  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [voicePartial, setVoicePartial] = useState('');
  const [livePreview, setLivePreview] = useState(''); // live translation, edits in realtime
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('voice');
  const [translationPreview, setTranslationPreview] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [userPoints, setUserPoints] = useState(authPoints);
  const [showPointsBanner, setShowPointsBanner] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pausedId, setPausedId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessionMsgCountRef = useRef(0);
  const insets = useSafeAreaInsets();

  const langAInfo = getLanguageByCode(langA);
  const langBInfo = getLanguageByCode(langB);

  const phaseRef = useRef<Phase>('idle');
  const autoRecordRef = useRef(true);
  const voicePartialRef = useRef(''); // tracks latest interim text as fallback on manual stop

  // ── Hybrid speech refs ───────────────────────────────────────────────────────
  // Native recognizer gives us instant live captions + records each turn to a
  // file; the recorded file is then sent to Whisper for the authoritative,
  // language-agnostic transcript. We drive end-of-turn ourselves with a silence
  // timer so a breath no longer cuts the sentence.
  const recordedUriRef = useRef<string | null>(null); // audio file for the current turn
  const finalTextRef = useRef('');                    // native final transcript (fallback)
  const hadSpeechRef = useRef(false);                 // any audible speech this turn?
  const lastVoiceTsRef = useRef(0);                   // last time we heard voice
  const speechStartTsRef = useRef(0);                 // when this turn's speech began
  const endTurnArmedRef = useRef(false);              // guard: end-of-turn fired once
  // Seed locale for the native LIVE CAPTION only (Whisper is authoritative and
  // auto-detects, so this never constrains the actual translation). Starts on A,
  // tracks the last side we saw so captions sharpen over a conversation.
  const seedLocaleRef = useRef(
    langAInfo ? `${langAInfo.code}-${langAInfo.countryCode}` : 'en-US'
  );
  const messagesRef = useRef<Message[]>([]);

  // ── Realtime streaming (primary) ─────────────────────────────────────────────
  // OpenAI Realtime keeps one socket open for the whole conversation: continuous
  // audio in, live transcript deltas out, auto language detection. No per-turn
  // stop/upload, works identically on iOS + Android. The Whisper hybrid above
  // stays as the fallback if streaming can't start (e.g. native audio module
  // missing or key error).
  const REALTIME_ENABLED = true;
  const AUTO_SPEAK = true; // speak the translation aloud, like Google's mode
  const realtimeRef = useRef(REALTIME_ENABLED); // flips false on fallback
  const transcriberRef = useRef<RealtimeTranscriber | null>(null);
  const liveTranslatorRef = useRef<LiveTranslator | null>(null);
  const waveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // End-of-turn tuning (native fallback path only).
  const SILENCE_MS = 1400;   // silence after speech before we finalize the turn
  const MIN_SPEECH_MS = 500; // ignore sub-half-second blips (coughs, taps)
  const VOICE_LEVEL = 0;     // volumechange value above this counts as audible

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const waveformBars = useRef(
    Array(5).fill(null).map(() => new Animated.Value(0.25))
  ).current;

  // ── Waveform (driven by volumechange) ─────────────────────────────────────

  const stopWaveform = useCallback(() => {
    if (waveTimer.current) { clearInterval(waveTimer.current); waveTimer.current = null; }
    waveformBars.forEach((bar) =>
      Animated.timing(bar, { toValue: 0.25, duration: 120, useNativeDriver: true }).start()
    );
  }, [waveformBars]);

  // Realtime has no volume events, so animate the waveform while speech is active.
  const startWaveformPulse = useCallback(() => {
    if (waveTimer.current) return;
    waveTimer.current = setInterval(() => {
      waveformBars.forEach((bar) =>
        Animated.timing(bar, {
          toValue: 0.2 + Math.random() * 0.8,
          duration: 140,
          useNativeDriver: true,
        }).start()
      );
    }, 150);
  }, [waveformBars]);

  // ── Firestore subscriptions ────────────────────────────────────────────────

  useEffect(() => {
    const unsubMsgs = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const unsubConvo = subscribeToConversation(conversationId, (convo) => {
      setConversation(convo);
    });
    return () => { unsubMsgs(); unsubConvo(); };
  }, [conversationId]);

  useEffect(() => { setUserPoints(authPoints); }, [authPoints]);

  // Keep a ref of recent messages so speech-event closures can build fresh
  // conversation context for the Whisper prompt + GPT translation.
  useEffect(() => {
    messagesRef.current = [...messages, ...optimisticMessages];
  }, [messages, optimisticMessages]);

  useEffect(() => {
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, []);

  // ── Permission pre-warm + auto-start ──────────────────────────────────────

  useEffect(() => {
    autoRecordRef.current = true;
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then(({ granted }) => {
        if (!granted) { showToast('Microphone permission required', 'error'); return; }
        const timer = setTimeout(() => {
          if (realtimeRef.current) startStreaming();
          else if (autoRecordRef.current) startRecording();
        }, 500);
        return () => clearTimeout(timer);
      })
      .catch((e) => console.error('[SpeechRec] permission error:', e));

    return () => {
      autoRecordRef.current = false;
      try { transcriberRef.current?.stop(); } catch { /* ignore */ }
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
      if (waveTimer.current) clearInterval(waveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Conversation context for the model ────────────────────────────────────
  // Recent lines ground Whisper + GPT in topic, names, and each speaker's way of
  // talking — the single biggest accuracy lever for short, code-mixed utterances.
  const buildHistory = (): string => {
    const recent = messagesRef.current.slice(-4);
    return recent
      .map((m) => {
        const name = getLanguageByCode(m.sourceLanguage)?.name ?? 'Speaker';
        return `${name}: ${m.originalText}`;
      })
      .join('\n');
  };

  // ── Realtime streaming pipeline ──────────────────────────────────────────────

  const startStreaming = () => {
    if (transcriberRef.current?.active) return;

    // The live translator runs concurrently with listening: it translates the
    // rolling partial as the person speaks, debounced + stale-guarded, and
    // pushes updates into the second caption.
    const lt = new LiveTranslator();
    lt.configure(langA, langB, (translated) => setLivePreview(translated));
    liveTranslatorRef.current = lt;

    const t = new RealtimeTranscriber();
    transcriberRef.current = t;
    t.start({
      onOpen: () => { setPhase('recording'); phaseRef.current = 'recording'; },
      onSpeechStart: () => {
        setPhase('recording'); phaseRef.current = 'recording';
        startWaveformPulse();
        // New utterance — drop the previous live translation + direction lock.
        lt.reset();
        setLivePreview('');
      },
      onSpeechStop: () => { stopWaveform(); },
      // Two things in parallel: paint the source caption instantly, AND kick the
      // live translation (fire-and-forget — never awaited, never blocks audio).
      onPartial: (txt) => {
        setVoicePartial(txt);
        lt.feed(txt);
      },
      // Finished utterance: clear the live captions and hand off the authoritative
      // translate + send + speak to the background. The socket keeps streaming
      // the next utterance immediately — no stop, no await on the hot path.
      onSegment: (txt) => {
        setVoicePartial('');
        setLivePreview('');
        lt.reset();
        void commitSegment(txt);
      },
      onError: (m) => {
        console.warn('[Realtime] error, falling back to standard mode:', m);
        fallbackToHybrid();
      },
      onClose: () => {
        stopWaveform();
        if (phaseRef.current !== 'processing') { setPhase('idle'); phaseRef.current = 'idle'; }
      },
    });
  };

  const stopStreaming = () => {
    try { transcriberRef.current?.stop(); } catch { /* ignore */ }
    transcriberRef.current = null;
    liveTranslatorRef.current?.reset();
    liveTranslatorRef.current = null;
    setLivePreview('');
    stopWaveform();
  };

  // If realtime can't run (missing native module / key), drop to the Whisper
  // hybrid so voice still works.
  const fallbackToHybrid = () => {
    realtimeRef.current = false;
    stopStreaming();
    showToast('Live mode unavailable — using standard mode', 'error');
    setPhase('idle'); phaseRef.current = 'idle';
    autoRecordRef.current = true;
    setTimeout(() => { if (autoRecordRef.current) startRecording(); }, 300);
  };

  // Commit one finalized utterance in the BACKGROUND: authoritative (context-
  // aware) translate, points, Firestore write, and auto-TTS — all without
  // touching the recording lifecycle, so the stream keeps listening/translating
  // the next utterance in parallel.
  const commitSegment = async (raw: string) => {
    const transcript = raw.trim();
    if (!transcript) return;
    const msgCount = conversation?.messageCount ?? messages.length;
    const cost = getMessageCost(msgCount);
    if (userPoints < cost) { setShowPointsBanner(true); return; }

    try {
      const history = buildHistory();
      const { translated, sourceLang, targetLang } = await translateAutoDetect(
        transcript, langA, langB, { history },
      );
      // Fire the rest in the background — don't await on the hot path.
      deductPoints(user!.uid, cost, 'message', conversationId)
        .then((ok) => { if (ok) setUserPoints((p) => Math.max(0, p - cost)); })
        .catch((err) => console.error('Points deduct failed:', err));

      addOptimisticMessage(transcript, translated, sourceLang, targetLang, 'voice');
      sendMessage(conversationId, user!.uid, transcript, translated, sourceLang, targetLang, 'voice')
        .catch((err) => console.error('Firestore send failed:', err));

      // Speak the translation aloud, like Google's conversation mode. Fire-and-
      // forget so it never blocks the next utterance.
      if (AUTO_SPEAK && translated && translated !== transcript) {
        speakText(translated).catch(() => { /* ignore */ });
      }

      sessionMsgCountRef.current += 1;
      if (sessionMsgCountRef.current % 10 === 0) showInterstitial();
    } catch (err: any) {
      console.error('[FaceToFace] streamed translate failed:', err);
      showToast(err.message || 'Translation failed', 'error');
    }
  };

  // Salient terms (names, brands, rare words) to bias the on-device live caption.
  const buildContextualStrings = (): string[] => {
    const words = messagesRef.current
      .slice(-4)
      .flatMap((m) => m.originalText.split(/\s+/))
      .filter((w) => w.length > 3 && /[A-Z]/.test(w[0])); // capitalised → likely a name/brand
    return Array.from(new Set(words)).slice(0, 20);
  };

  // ── End-of-turn finalize ──────────────────────────────────────────────────
  // Single guarded entry point. Stops the recognizer so it flushes the recorded
  // audio file (audioend) and final transcript, then 'end' drives processing.
  const armEndTurn = () => {
    if (endTurnArmedRef.current) return;
    if (phaseRef.current !== 'recording') return;
    endTurnArmedRef.current = true;
    setPhase('processing');
    phaseRef.current = 'processing';
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
  };

  // ── Speech recognition events ──────────────────────────────────────────────

  useSpeechRecognitionEvent('audiostart', (e) => {
    recordedUriRef.current = e.uri ?? null;
  });
  useSpeechRecognitionEvent('audioend', (e) => {
    if (e.uri) recordedUriRef.current = e.uri;
  });

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (text.trim()) hadSpeechRef.current = true;
    if (e.isFinal) {
      finalTextRef.current = text;
      // On devices that auto-stop (Android ≤12, iOS 17-), a final result is the
      // end of the turn even though we didn't call stop() ourselves. Arm here so
      // those turns still get processed via 'end'.
      if (text.trim()) armEndTurn();
    } else {
      setVoicePartial(text);
      voicePartialRef.current = text;
    }
  });

  useSpeechRecognitionEvent('volumechange', (e) => {
    const vol = e.value;
    const normalized = vol < 0 ? 0.15 : Math.min(0.15 + (vol / 10) * 0.85, 1.0);
    waveformBars.forEach((bar) => {
      const v = Math.max(0.1, normalized + (Math.random() * 0.2 - 0.1));
      Animated.timing(bar, { toValue: v, duration: 80, useNativeDriver: true }).start();
    });

    // Silence-based endpointing: we end the turn only after a real pause, so a
    // mid-sentence breath no longer triggers a premature translation.
    if (phaseRef.current !== 'recording') return;
    const now = Date.now();
    if (vol > VOICE_LEVEL) {
      lastVoiceTsRef.current = now;
      if (!hadSpeechRef.current) {
        hadSpeechRef.current = true;
        speechStartTsRef.current = now;
      }
    } else if (
      hadSpeechRef.current &&
      now - lastVoiceTsRef.current > SILENCE_MS &&
      now - speechStartTsRef.current > MIN_SPEECH_MS
    ) {
      armEndTurn();
    }
  });

  useSpeechRecognitionEvent('error', (e) => {
    // 'aborted' = we intentionally stopped (pause / mode switch / unmount).
    if (e.error === 'aborted') return;
    if (e.error !== 'no-speech') {
      console.warn('[SpeechRec] error:', e.error, e.message);
    }
    if (phaseRef.current !== 'processing') {
      stopWaveform();
      setVoicePartial('');
      voicePartialRef.current = '';
    }
  });

  // The session has fully stopped. If we armed an end-of-turn, the recorded audio
  // is now flushed — hand it to Whisper. Otherwise just idle/restart.
  useSpeechRecognitionEvent('end', () => {
    stopWaveform();
    setVoicePartial('');
    voicePartialRef.current = '';
    if (phaseRef.current === 'processing' && endTurnArmedRef.current) {
      processRecordedUtterance();
      return;
    }
    setPhase('idle');
    phaseRef.current = 'idle';
    if (autoRecordRef.current) {
      setTimeout(() => {
        if (autoRecordRef.current && phaseRef.current === 'idle') startRecording();
      }, 300);
    }
  });

  // ── Recording ──────────────────────────────────────────────────────────────

  const startRecording = () => {
    if (phaseRef.current !== 'idle') return;
    // Reset per-turn state.
    recordedUriRef.current = null;
    finalTextRef.current = '';
    hadSpeechRef.current = false;
    endTurnArmedRef.current = false;
    lastVoiceTsRef.current = Date.now();
    speechStartTsRef.current = Date.now();
    try {
      ExpoSpeechRecognitionModule.start({
        // Seed locale drives the on-device LIVE CAPTION only. Whisper re-does the
        // transcription with auto language detection, so this never forces the
        // actual translation toward one language.
        lang: seedLocaleRef.current,
        interimResults: true,
        // We control endpointing via the silence timer, so keep the recognizer
        // open through pauses instead of letting the OS cut on the first breath.
        continuous: true,
        addsPunctuation: true,
        contextualStrings: buildContextualStrings(),
        iosTaskHint: 'dictation',
        // Persist each turn's audio to a file for Whisper.
        recordingOptions: { persist: true },
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
      setPhase('recording');
      phaseRef.current = 'recording';
    } catch (err) {
      console.error('[SpeechRec] start failed:', err);
      setPhase('idle');
      phaseRef.current = 'idle';
    }
  };

  const handleTap = () => {
    if (phase === 'processing') return;

    // Realtime path: tap toggles the live session on/off.
    if (realtimeRef.current) {
      if (transcriberRef.current?.active) {
        stopStreaming();
        setVoicePartial('');
        setPhase('idle'); phaseRef.current = 'idle';
      } else {
        startStreaming();
      }
      return;
    }

    if (phase === 'idle') {
      autoRecordRef.current = true;
      startRecording();
      return;
    }
    // Pause: stop auto-restart. If something was said, finalize & translate it;
    // otherwise just go idle.
    autoRecordRef.current = false;
    if (hadSpeechRef.current || voicePartialRef.current.trim()) {
      armEndTurn();
    } else {
      try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
      stopWaveform();
      setPhase('idle');
      phaseRef.current = 'idle';
    }
  };

  // ── Process recorded turn: Whisper → translate → send ───────────────────────

  const processRecordedUtterance = async () => {
    const uri = recordedUriRef.current;
    const history = buildHistory();
    let transcript = finalTextRef.current.trim() || voicePartialRef.current.trim();
    let acousticHint = '';

    // Whisper is the authoritative, language-agnostic transcript. Passing recent
    // conversation context as the prompt repairs cut-off words and biases names.
    if (uri) {
      try {
        const ext = uri.endsWith('.wav') ? 'wav' : uri.endsWith('.caf') ? 'caf' : 'm4a';
        const w = await transcribeAudio(uri, { prompt: history, ext });
        if (w.text.trim()) {
          transcript = w.text.trim();
          acousticHint = w.language;
        }
      } catch (err) {
        console.warn('[FaceToFace] Whisper failed, using native transcript:', err);
      }
    }

    if (!transcript) {
      // Nothing usable — unwind and resume listening.
      setPhase('idle');
      phaseRef.current = 'idle';
      if (autoRecordRef.current) {
        setTimeout(() => { if (autoRecordRef.current) startRecording(); }, 300);
      }
      return;
    }

    await finalizeAndSend(transcript, history, acousticHint);
  };

  const finalizeAndSend = async (
    transcript: string,
    history: string,
    acousticHint: string,
  ) => {
    const msgCount = conversation?.messageCount ?? messages.length;
    const cost = getMessageCost(msgCount);
    if (userPoints < cost) {
      setShowPointsBanner(true);
      setPhase('idle');
      phaseRef.current = 'idle';
      return;
    }

    setSending(true);
    try {
      // GPT understands the (possibly code-mixed) utterance with context, decides
      // direction, and translates — no rigid source-language classification.
      const { translated, sourceLang, targetLang } = await translateAutoDetect(
        transcript, langA, langB, { history, acousticHint },
      );
      // Sharpen the next live caption toward whoever just spoke.
      const spokenInfo = getLanguageByCode(sourceLang);
      if (spokenInfo) seedLocaleRef.current = `${spokenInfo.code}-${spokenInfo.countryCode}`;

      const ok = await deductPoints(user!.uid, cost, 'message', conversationId);
      if (ok) setUserPoints((p) => Math.max(0, p - cost));

      addOptimisticMessage(transcript, translated, sourceLang, targetLang, 'voice');
      sendMessage(conversationId, user!.uid, transcript, translated, sourceLang, targetLang, 'voice')
        .catch((err) => console.error('Firestore send failed:', err));

      sessionMsgCountRef.current += 1;
      if (sessionMsgCountRef.current % 10 === 0) showInterstitial();
    } catch (err: any) {
      console.error('[FaceToFace] translate failed:', err);
      showToast(err.message || 'Translation failed', 'error');
    } finally {
      setSending(false);
      setPhase('idle');
      phaseRef.current = 'idle';
      if (autoRecordRef.current) {
        setTimeout(() => { if (autoRecordRef.current) startRecording(); }, 400);
      }
    }
  };

  const handleWatchAdForPoints = async () => {
    if (!user) return;
    showRewardedAd(async () => {
      const result = await rewardAdWatch(user.uid);
      setUserPoints(result.newTotal);
      setShowPointsBanner(false);
    });
  };

  const addOptimisticMessage = (
    originalText: string,
    translatedText: string,
    sourceLang: string,
    targetLang: string,
    type: 'text' | 'voice' = 'voice',
  ) => {
    if (!user) return;
    const optimistic: Message = {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId,
      senderId: user.uid,
      originalText,
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      type,
      createdAt: Timestamp.now(),
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  };

  // ── Keyboard mode ──────────────────────────────────────────────────────────

  const handleTextChange = (text: string) => {
    setInputText(text);
    clearTimeout(previewTimer.current);
    if (!text.trim()) { setTranslationPreview(''); setIsPreviewLoading(false); return; }
    setIsPreviewLoading(true);
    previewTimer.current = setTimeout(async () => {
      const { translated } = await translateAutoDetect(text, langA, langB);
      setTranslationPreview(translated !== text ? translated : '');
      setIsPreviewLoading(false);
    }, 900);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user || sending) return;
    const msgCount = conversation?.messageCount ?? messages.length;
    const cost = getMessageCost(msgCount);
    if (userPoints < cost) { setShowPointsBanner(true); return; }

    setInputText('');
    setTranslationPreview('');
    setIsPreviewLoading(false);
    clearTimeout(previewTimer.current);
    setSending(true);
    try {
      const { translated, sourceLang, targetLang } = await translateAutoDetect(text, langA, langB);
      const ok = await deductPoints(user.uid, cost, 'message', conversationId);
      if (ok) setUserPoints((p) => Math.max(0, p - cost));
      addOptimisticMessage(text, translated, sourceLang, targetLang, 'text');
      sendMessage(conversationId, user.uid, text, translated, sourceLang, targetLang, 'text')
        .catch((err) => console.error('FaceToFace send failed:', err));
      sessionMsgCountRef.current += 1;
      if (sessionMsgCountRef.current % 10 === 0) showInterstitial();
    } catch (err) {
      console.error('FaceToFace send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleClearConversation = () => {
    Alert.alert('Clear conversation', 'Delete all messages in this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: () => {
          deleteAllMessagesInConversation(conversationId).catch((err) =>
            console.error('Clear failed:', err),
          );
        },
      },
    ]);
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const allMessages = useMemo(() => {
    const langABase = langA.split('-')[0].split('_')[0];
    const dedupedOptimistic = optimisticMessages.filter((om) =>
      !messages.some((fm) => {
        const timeMatch =
          !fm.createdAt || !om.createdAt ||
          Math.abs(fm.createdAt.toMillis() - om.createdAt.toMillis()) < 15000;
        return timeMatch && fm.originalText === om.originalText &&
          fm.senderId === om.senderId && fm.sourceLanguage === om.sourceLanguage;
      })
    );
    return [...messages, ...dedupedOptimistic].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      return aTime !== bTime ? aTime - bTime : a.id.localeCompare(b.id);
    });
  }, [messages, optimisticMessages, langA]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const langABase = langA.split('-')[0].split('_')[0];
    const prev = allMessages[index - 1];
    const showDate = index === 0 || !isSameDay(prev?.createdAt ?? null, item.createdAt);
    const itemBase = item.sourceLanguage.split('-')[0].split('_')[0];
    const isPersonA = itemBase === langABase;

    return (
      <View style={{ marginBottom: 12 }}>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {formatDateLabel(item.createdAt)}
            </Text>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <View style={[styles.messageRow, isPersonA ? styles.rowRight : styles.rowLeft]}>
          {!isPersonA && (
            <View style={[styles.avatarSmall, {
              backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
              borderColor: isDark ? colors.glassBorder : colors.border,
            }]}>
              <FlagEmoji countryCode={langBInfo?.countryCode ?? 'BD'} size={18} />
            </View>
          )}
          <View style={styles.messageContent}>
            <View style={[
              styles.bubble,
              isPersonA
                ? [styles.bubbleRight, { backgroundColor: '#007AFF', shadowColor: '#007AFF' }]
                : [styles.bubbleLeft, {
                    backgroundColor: isDark ? colors.glass : colors.surface,
                    borderColor: isDark ? colors.glassBorder : colors.border,
                    shadowColor: colors.shadow,
                  }],
            ]}>
              <Text style={[styles.primaryText, { color: isPersonA ? '#FFF' : colors.text }]}>
                {item.translatedText}
              </Text>
              {item.translatedText !== item.originalText && (
                <Text style={[styles.secondaryText,
                  { color: isPersonA ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}>
                  {item.originalText}
                </Text>
              )}
            </View>
            <View style={[styles.messageActions, isPersonA ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              <TouchableOpacity
                style={[styles.actionBtn, {
                  borderColor: isDark ? colors.glassBorder : colors.border,
                  backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
                }]}
                disabled={loadingId === item.id}
                onPress={async () => {
                  if (playingId === item.id) { pauseSpeaking(); setPlayingId(null); setPausedId(item.id); return; }
                  if (pausedId === item.id) { resumeSpeaking(); setPlayingId(item.id); setPausedId(null); return; }
                  setPlayingId(null); setPausedId(null); setLoadingId(item.id);
                  try {
                    await speakText(item.translatedText, () => { setPlayingId(null); setPausedId(null); });
                    setPlayingId(item.id);
                  } finally { setLoadingId(null); }
                }}
              >
                {loadingId === item.id
                  ? <ActivityIndicator size={14} color={colors.textSecondary} />
                  : <Ionicons
                      name={playingId === item.id ? 'pause-outline' : 'play-outline'}
                      size={14}
                      color={pausedId === item.id ? '#007AFF' : colors.textSecondary}
                    />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, {
                  borderColor: isDark ? colors.glassBorder : colors.border,
                  backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
                }]}
                onPress={() => { Clipboard.setString(item.translatedText); showToast('Copied', 'success'); }}
              >
                <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
          {isPersonA && (
            <View style={[styles.avatarSmall, {
              backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
              borderColor: isDark ? colors.glassBorder : colors.border,
            }]}>
              <FlagEmoji countryCode={langAInfo?.countryCode ?? 'US'} size={18} />
            </View>
          )}
        </View>
      </View>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.langIndicators}>
            <View style={[styles.langChipSelected, {
              backgroundColor: isDark ? 'rgba(0,122,255,0.18)' : 'rgba(0,122,255,0.10)',
              borderColor: isDark ? 'rgba(0,122,255,0.40)' : 'rgba(0,122,255,0.25)',
            }]}>
              <FlagEmoji countryCode={langAInfo?.countryCode ?? 'US'} size={13} />
              <Text style={[styles.langChipSelectedText, { color: isDark ? '#5AC8FA' : '#007AFF' }]}>{langAInfo?.name}</Text>
            </View>
            <Text style={[styles.langSep, { color: colors.textSecondary }]}>↔</Text>
            <View style={[styles.langChipSelected, {
              backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : 'rgba(52,199,89,0.10)',
              borderColor: isDark ? 'rgba(52,199,89,0.40)' : 'rgba(52,199,89,0.25)',
            }]}>
              <FlagEmoji countryCode={langBInfo?.countryCode ?? 'BD'} size={13} />
              <Text style={[styles.langChipSelectedText, { color: isDark ? '#32D74B' : '#34C759' }]}>{langBInfo?.name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowMenu((v) => !v)}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Menu dropdown */}
        {showMenu && (
          <>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowMenu(false)} />
            <View style={[styles.menuDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleClearConversation(); }}>
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Clear conversation</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <AdBanner />

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={44} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Speak in either language — translation happens automatically.
              </Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Keyboard mode preview */}
        {inputMode === 'keyboard' && (translationPreview || isPreviewLoading) && (
          <View style={[styles.previewStrip, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            {isPreviewLoading
              ? <ActivityIndicator size="small" color={colors.textSecondary} />
              : <Text style={[styles.previewText, { color: colors.textSecondary }]}>{translationPreview}</Text>}
          </View>
        )}

        {/* Cost indicator */}
        <View style={[styles.costIndicator, { borderTopColor: colors.border }]}>
          <Text style={[styles.costIndicatorText, { color: colors.textSecondary }]}>
            {`Next message costs ${getMessageCost(conversation?.messageCount ?? messages.length)} points`}
          </Text>
        </View>

        {/* Insufficient points banner */}
        {showPointsBanner && (
          <View style={[styles.pointsBanner, { backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : '#FFEBEE' }]}>
            <Ionicons name="flash" size={14} color="#FF3B30" />
            <Text style={[styles.pointsBannerText, { color: '#FF3B30' }]}>
              Need {getMessageCost(conversation?.messageCount ?? messages.length)} points
            </Text>
            <TouchableOpacity onPress={handleWatchAdForPoints} style={styles.pointsBannerBtn}>
              <Text style={styles.pointsBannerBtnText}>Watch Ad +{POINTS.WATCH_AD_BASE}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
          {inputMode === 'voice' ? (
            <View style={styles.voiceRow}>
              <TouchableOpacity
                style={styles.modeToggle}
                onPress={() => {
                  if (realtimeRef.current) {
                    stopStreaming();
                  } else if (phase === 'recording') {
                    try { ExpoSpeechRecognitionModule.abort(); } catch { /* ignore */ }
                    autoRecordRef.current = false;
                  }
                  stopWaveform();
                  setVoicePartial('');
                  setPhase('idle');
                  phaseRef.current = 'idle';
                  setInputMode('keyboard');
                }}
              >
                <Ionicons name="keypad-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.micCenter}>
                {/* Source transcript (top) and live translation (below) — both
                    rewrite themselves in realtime, in parallel. */}
                <LiveCaption
                  text={voicePartial}
                  color={colors.textSecondary}
                  tailColor={colors.textSecondary}
                  size={13}
                />
                <LiveCaption
                  text={livePreview}
                  color={isDark ? '#5AC8FA' : '#007AFF'}
                  tailColor={isDark ? 'rgba(90,200,250,0.55)' : 'rgba(0,122,255,0.55)'}
                  size={16}
                />

                <TouchableOpacity onPress={handleTap} disabled={phase === 'processing'} activeOpacity={0.8}>
                  <View style={[
                    styles.micBtnLarge,
                    {
                      backgroundColor: phase === 'recording' ? '#007AFF' : phase === 'processing' ? colors.surface : '#007AFF',
                      opacity: phase === 'processing' ? 0.6 : 1,
                    },
                  ]}>
                    {phase === 'processing'
                      ? <ActivityIndicator size="small" color="#FFF" />
                      : <Ionicons name={phase === 'recording' ? 'pause' : 'mic'} size={28} color="#FFF" />}
                  </View>
                </TouchableOpacity>
                <Text style={[styles.micLabel, { color: colors.textSecondary }]}>
                  {phase === 'processing'
                    ? 'Translating…'
                    : phase === 'recording'
                      ? (realtimeRef.current ? 'Listening — tap to pause' : 'Pause')
                      : 'Tap to speak'}
                </Text>
              </View>

              <View style={styles.modeToggle} />
            </View>
          ) : (
            <View style={styles.keyboardRow}>
              <TouchableOpacity onPress={() => {
                setInputText('');
                setTranslationPreview('');
                setInputMode('voice');
                if (realtimeRef.current) startStreaming();
                else { autoRecordRef.current = true; setTimeout(() => startRecording(), 200); }
              }}>
                <View style={[styles.actionBtn2, { backgroundColor: colors.surface }]}>
                  <Ionicons name="mic" size={20} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Type in either language..."
                  placeholderTextColor={colors.textSecondary}
                  value={inputText}
                  onChangeText={handleTextChange}
                  multiline
                  onSubmitEditing={handleSend}
                  autoFocus
                />
              </View>
              <TouchableOpacity onPress={handleSend} disabled={sending || !inputText.trim()}>
                <View style={[styles.actionBtn2, { backgroundColor: sending || !inputText.trim() ? colors.surface : '#007AFF' }]}>
                  {sending
                    ? <ActivityIndicator size="small" color={colors.textSecondary} />
                    : <Ionicons name="send" size={16} color={inputText.trim() ? '#FFF' : colors.textSecondary} />}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Live waveform */}
          {phase === 'recording' && (
            <View style={styles.waveformStrip}>
              {waveformBars.map((bar, i) => (
                <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: bar }] }]} />
              ))}
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1,
  },
  langIndicators: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langChipSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1,
  },
  langChipSelectedText: { fontSize: 12, fontWeight: '600' },
  langSep: { fontSize: 11, opacity: 0.5 },
  menuDropdown: {
    position: 'absolute', top: 50, right: 12, borderRadius: 12,
    borderWidth: 1, paddingVertical: 6, paddingHorizontal: 4,
    zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  messagesList: { padding: 16, flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80, gap: 14, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  messageContent: { maxWidth: '75%' },
  bubble: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  bubbleLeft: { borderBottomLeftRadius: 4 },
  bubbleRight: { borderBottomRightRadius: 4 },
  primaryText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  secondaryText: { fontSize: 14, lineHeight: 20, marginTop: 6, fontStyle: 'italic' },
  messageActions: { flexDirection: 'row', gap: 10, marginTop: 4, paddingHorizontal: 4 },
  actionBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  previewStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewText: { fontSize: 13, fontStyle: 'italic', lineHeight: 18, flex: 1 },
  inputBar: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: 12 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  modeToggle: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  micCenter: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 8 },
  micLabel: { fontSize: 12, fontWeight: '500' },
  partialText: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 16, marginBottom: 4 },
  micBtnLarge: {
    width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 10, elevation: 5,
  },
  waveformStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, height: 36,
  },
  waveBar: { width: 4, height: 24, borderRadius: 2, backgroundColor: '#007AFF' },
  keyboardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputWrapper: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100 },
  input: { fontSize: 16, lineHeight: 20 },
  actionBtn2: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16, paddingHorizontal: 16 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  costIndicator: { paddingHorizontal: 16, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
  costIndicatorText: { fontSize: 11, fontWeight: '500' },
  pointsBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.05)',
  },
  pointsBannerText: { fontSize: 12, fontWeight: '600', flex: 1, marginLeft: 6 },
  pointsBannerBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pointsBannerBtnText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});
