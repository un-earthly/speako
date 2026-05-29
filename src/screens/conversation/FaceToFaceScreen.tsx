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
  PanResponder,
  Alert,
} from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import * as Speech from 'expo-speech';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { getLanguageByCode } from '../../constants/languages';
import {
  sendMessage,
  subscribeToMessages,
  subscribeToConversation,
  deleteMessage,
  deleteAllMessagesInConversation,
  type Message,
  type Conversation,
} from '../../services/firestore';
import { translateText, translateAutoDetect } from '../../services/translation';
import { isSameDay, formatDateLabel } from '../../utils/date';
import { getMessageCost } from '../../utils/points';
import { POINTS, deductPoints, getUserPoints, rewardAdWatch } from '../../services/rewards';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import { AdBanner } from '../../components/common/AdBanner';
import { Timestamp } from 'firebase/firestore';

const ACTIVATION_THRESHOLD = 60;
const MAX_DRAG = 100;
const SNAP_BACK_DURATION = 200;

type Phase = 'idle' | 'recording' | 'processing';

function WordHighlight({ text, baseStyle }: { text: string; baseStyle: any }) {
  const words = text.trim().split(/(\s+)/);
  if (words.length < 2) {
    return <Text style={[baseStyle, { color: '#007AFF', fontWeight: '700' }]}>{text}</Text>;
  }
  let lastIdx = words.length - 1;
  while (lastIdx > 0 && !words[lastIdx].trim()) lastIdx--;
  const stable = words.slice(0, lastIdx).join('');
  const latest = words.slice(lastIdx).join('');
  return (
    <Text style={baseStyle}>
      {stable}
      <Text style={{ color: '#007AFF', fontWeight: '700' }}>{latest}</Text>
    </Text>
  );
}

export function FaceToFaceScreen({ route, navigation }: any) {
  const { conversationId, langA, langB } = route.params;
  const { user, points: authPoints } = useAuth();
  const { colors, isDark } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [voicePartial, setVoicePartial] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('voice');
  const [translationPreview, setTranslationPreview] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'langA' | 'langB' | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [userPoints, setUserPoints] = useState(authPoints);
  const [showPointsBanner, setShowPointsBanner] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const panX = useRef(new Animated.Value(0)).current;
  const isDraggingRef = useRef(false);

  const langAInfo = getLanguageByCode(langA);
  const langBInfo = getLanguageByCode(langB);
  const langABase = langA.split('-')[0].split('_')[0];

  const phaseRef = useRef<Phase>('idle');
  const recordingStartedAt = useRef(0);
  const canRecordAfter = useRef(0);
  const transcriptRef = useRef('');
  const finalizedTranscriptRef = useRef('');
  const shouldFinalizeOnEndRef = useRef(false);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Pre-warm permissions so we don't async-block during the gesture
  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => { });
  }, []);

  // Subscribe to Firestore messages and conversation
  useEffect(() => {
    const unsubMsgs = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const unsubConvo = subscribeToConversation(conversationId, (convo) => {
      setConversation(convo);
    });
    return () => {
      unsubMsgs();
      unsubConvo();
    };
  }, [conversationId]);

  // Sync points from auth
  useEffect(() => {
    setUserPoints(authPoints);
  }, [authPoints]);

  // (Optimistic deduplication moved into allMessages useMemo to avoid render flicker)

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  // Pulse animation while recording
  useEffect(() => {
    if (phase === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      pulseLoop.current?.stop();
    };
  }, [phase, pulseAnim]);

  // Side label opacity animations based on drag position
  const leftOpacity = panX.interpolate({
    inputRange: [-MAX_DRAG, -ACTIVATION_THRESHOLD, 0],
    outputRange: [1, 1, 0.4],
    extrapolate: 'clamp',
  });
  const rightOpacity = panX.interpolate({
    inputRange: [0, ACTIVATION_THRESHOLD, MAX_DRAG],
    outputRange: [0.4, 1, 1],
    extrapolate: 'clamp',
  });

  // ── Speech recognition events ──────────────────────────────────────────────

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    console.log('[STT result]', { isFinal: e.isFinal, resultsCount: e.results.length, text, allResults: e.results.map((r: any) => r.transcript) });

    if (e.isFinal) {
      // Append finalized segment so continuous mode doesn't lose prior sentences
      finalizedTranscriptRef.current = (finalizedTranscriptRef.current + ' ' + text).trim();
      transcriptRef.current = finalizedTranscriptRef.current;
    } else {
      // Show accumulated finals + current partial
      transcriptRef.current = (finalizedTranscriptRef.current + ' ' + text).trim();
    }

    setVoicePartial(transcriptRef.current);
  });

  useSpeechRecognitionEvent('end', async () => {
    if (!shouldFinalizeOnEndRef.current) return;
    shouldFinalizeOnEndRef.current = false;

    const text = transcriptRef.current.trim();
    console.log('[STT end] finalize text:', JSON.stringify(text));
    transcriptRef.current = '';
    setVoicePartial('');

    if (!text) {
      resetRecordingState();
      return;
    }

    const msgCount = conversation?.messageCount ?? messages.length;
    const cost = getMessageCost(msgCount);

    if (userPoints < cost) {
      setShowPointsBanner(true);
      setSending(false);
      resetRecordingState();
      return;
    }

    setPhase('processing');
    setSending(true);

    try {
      // Voice mode: always trust the side the user dragged to.
      // The STT engine is already configured for that language.
      const sourceLang = activeSpeaker === 'langB' ? langB : langA;
      const targetLang = activeSpeaker === 'langB' ? langA : langB;
      console.log('[Translate] sending to translateText:', JSON.stringify(text), sourceLang, targetLang);
      const translated = await translateText(text, sourceLang, targetLang);
      console.log('[Translate] result:', JSON.stringify(translated), 'source:', sourceLang, 'target:', targetLang);

      const ok = await deductPoints(user!.uid, cost, 'message', conversationId);
      if (ok) setUserPoints((p) => Math.max(0, p - cost));

      addOptimisticMessage(text, translated, sourceLang, targetLang, 'voice');
      sendMessage(conversationId, user!.uid, text, translated, sourceLang, targetLang, 'voice').catch(
        (err) => console.error('Firestore send failed:', err),
      );
    } catch (err) {
      console.error('Finalize failed:', err);
    } finally {
      setSending(false);
      resetRecordingState();
    }
  });

  useSpeechRecognitionEvent('volumechange', (e) => {
    const vol = e.value;
    const scale = vol < 0 ? 1 : 1 + Math.min(vol / 10, 1) * 0.45;
    Animated.timing(pulseAnim, { toValue: scale, duration: 80, useNativeDriver: true }).start();
  });

  useSpeechRecognitionEvent('error', (e) => {
    // 'aborted' is expected on quick taps — ignore it
    if (e.error === 'aborted') return;

    if (
      e.error === 'network' ||
      e.error === 'no-speech' ||
      e.error === 'language-not-supported'
    ) {
      console.warn('STT warning:', e.error, e.message);
    } else {
      console.error('STT error:', e.error, e.message);
    }

    // Cooldown to avoid rapid retry loops after a failure
    canRecordAfter.current = Date.now() + 600;
    shouldFinalizeOnEndRef.current = false;
    resetRecordingState();
  });

  // ── PanResponder for walkie-talkie slider ──────────────────────────────────

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        panX.stopAnimation();
        setShowMenu(false);
      },
      onPanResponderMove: (_, gs) => {
        if (!isDraggingRef.current) return;
        const clampedDx = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, gs.dx));
        panX.setValue(clampedDx);

        if (gs.dx > ACTIVATION_THRESHOLD && phaseRef.current === 'idle') {
          startRecording(langA, 'langA');
        } else if (gs.dx < -ACTIVATION_THRESHOLD && phaseRef.current === 'idle') {
          startRecording(langB, 'langB');
        }
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        if (phaseRef.current === 'recording') {
          const elapsed = Date.now() - recordingStartedAt.current;
          if (elapsed < 400) {
            // Too quick — abort to avoid confusing the STT engine
            try {
              ExpoSpeechRecognitionModule.abort();
            } catch {
              /* ignore */
            }
            canRecordAfter.current = Date.now() + 200;
            resetRecordingState();
          } else {
            shouldFinalizeOnEndRef.current = true;
            ExpoSpeechRecognitionModule.stop();
          }
        }
        Animated.timing(panX, {
          toValue: 0,
          duration: SNAP_BACK_DURATION,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        if (phaseRef.current === 'recording') {
          try {
            ExpoSpeechRecognitionModule.abort();
          } catch {
            /* ignore */
          }
          canRecordAfter.current = Date.now() + 200;
          shouldFinalizeOnEndRef.current = false;
          resetRecordingState();
        }
        Animated.timing(panX, {
          toValue: 0,
          duration: SNAP_BACK_DURATION,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetRecordingState = useCallback(() => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    setPhase('idle');
    phaseRef.current = 'idle';
    setVoicePartial('');
    setActiveSpeaker(null);
  }, [pulseAnim]);

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
    console.log('[Optimistic] adding message:', JSON.stringify(originalText), '→', JSON.stringify(translatedText));
    setOptimisticMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const startRecording = (sttLang: string, speaker: 'langA' | 'langB') => {
    if (phaseRef.current !== 'idle') return;
    if (Date.now() < canRecordAfter.current) return;

    transcriptRef.current = '';
    finalizedTranscriptRef.current = '';
    setVoicePartial('');
    setActiveSpeaker(speaker);
    setPhase('recording');
    phaseRef.current = 'recording';
    recordingStartedAt.current = Date.now();

    ExpoSpeechRecognitionModule.start({
      lang: sttLang,
      interimResults: true,
      continuous: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      addsPunctuation: true,
      recordingOptions: { persist: true },
    })
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

  // ── Keyboard mode ──────────────────────────────────────────────────────────

  const handleTextChange = (text: string) => {
    setInputText(text);
    clearTimeout(previewTimer.current);

    if (!text.trim()) {
      setTranslationPreview('');
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    previewTimer.current = setTimeout(async () => {
      const { translated } = await translateAutoDetect(text, langA, langB);
      setTranslationPreview(translated !== text ? translated : '');
      setIsPreviewLoading(false);
    }, 900);
  };

  const { showAd: showRewardedAd } = useRewardedAd();
  const { showToast } = useToast();

  const handleWatchAdForPoints = async () => {
    if (!user) return;
    showRewardedAd(async () => {
      const result = await rewardAdWatch(user.uid);
      setUserPoints(result.newTotal);
      setShowPointsBanner(false);
    });
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user || sending) return;

    const msgCount = conversation?.messageCount ?? messages.length;
    const cost = getMessageCost(msgCount);

    if (userPoints < cost) {
      setShowPointsBanner(true);
      return;
    }

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
      sendMessage(conversationId, user.uid, text, translated, sourceLang, targetLang, 'text').catch(
        (err) => console.error('FaceToFace send failed:', err),
      );
    } catch (err) {
      console.error('FaceToFace send failed:', err);
    } finally {
      setSending(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const allMessages = useMemo(() => {
    const dedupedOptimistic = optimisticMessages.filter((om) => {
      return !messages.some((fm) => {
        const timeMatch =
          !fm.createdAt ||
          !om.createdAt ||
          Math.abs(fm.createdAt.toMillis() - om.createdAt.toMillis()) < 15000;
        return (
          timeMatch &&
          fm.originalText === om.originalText &&
          fm.senderId === om.senderId &&
          fm.sourceLanguage === om.sourceLanguage
        );
      });
    });

    const sorted = [...messages, ...dedupedOptimistic].sort((a, b) => {

      const aTime = a.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.id.localeCompare(b.id);
    });
    console.log('[Render] message count:', sorted.length, 'ids:', sorted.map((m) => m.id.slice(0, 8)));

    return sorted;
  }, [messages, optimisticMessages]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const prev = allMessages[index - 1];
    const showDate = index === 0 || !isSameDay(prev?.createdAt ?? null, item.createdAt);
    const itemBase = item.sourceLanguage.split('-')[0].split('_')[0];
    const isPersonA = itemBase === langABase;
    const speakerInfo = isPersonA ? langAInfo : langBInfo;

    const bubble = (
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
          <View
            style={[
              styles.bubble,
              isPersonA
                ? [styles.bubbleRight, { backgroundColor: '#007AFF', shadowColor: '#007AFF' }]
                : [styles.bubbleLeft, {
                    backgroundColor: isDark ? colors.glass : colors.surface,
                    borderColor: isDark ? colors.glassBorder : colors.border,
                    shadowColor: colors.shadow,
                  }],
            ]}
          >
            <Text style={[styles.primaryText, { color: isPersonA ? '#FFF' : colors.text }]}>
              {item.translatedText}
            </Text>
            {item.translatedText !== item.originalText && (
              <Text
                style={[
                  styles.secondaryText,
                  { color: isPersonA ? 'rgba(255,255,255,0.75)' : colors.textSecondary },
                ]}
              >
                {item.originalText}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.messageActions,
              isPersonA ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
            ]}
          >
            <TouchableOpacity
              style={[styles.actionBtn, {
                borderColor: isDark ? colors.glassBorder : colors.border,
                backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
              }]}
              onPress={() => Speech.speak(item.translatedText, { language: item.targetLanguage })}
            >
              <Ionicons name="play-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, {
                borderColor: isDark ? colors.glassBorder : colors.border,
                backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
              }]}
              onPress={() => {
                Clipboard.setString(item.translatedText);
                showToast('Copied to clipboard', 'success');
              }}
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
            <FlagEmoji countryCode={speakerInfo?.countryCode ?? 'US'} size={18} />
          </View>
        )}
      </View>
    );

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
        {bubble}
      </View>
    );
  };

  const micBackgroundColor =
    activeSpeaker === 'langB'
      ? '#34C759'
      : activeSpeaker === 'langA'
        ? '#007AFF'
        : '#007AFF';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + 8, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.langIndicators}>
            <View style={[styles.langChip, { backgroundColor: colors.surface }]}>
              <FlagEmoji countryCode={langAInfo?.countryCode ?? 'US'} size={14} />
              <Text style={[styles.langChipText, { color: colors.text }]}>{langAInfo?.name}</Text>
            </View>
            <Ionicons name="repeat" size={14} color={colors.textSecondary} />
            <View style={[styles.langChip, { backgroundColor: colors.surface }]}>
              <FlagEmoji countryCode={langBInfo?.countryCode ?? 'BD'} size={14} />
              <Text style={[styles.langChipText, { color: colors.text }]}>{langBInfo?.name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowMenu((v) => !v)}>
            <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Menu dropdown */}
        {showMenu && (
          <>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setShowMenu(false)}
            />
            <View
              style={[
                styles.menuDropdown,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleClearConversation();
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Clear conversation</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

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
                Drag the mic toward your language and hold to speak.{'\n'}Release to send.
              </Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Translation preview (keyboard mode) */}
        {inputMode === 'keyboard' && (translationPreview || isPreviewLoading) && (
          <View
            style={[
              styles.previewStrip,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            {isPreviewLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                {translationPreview}
              </Text>
            )}
          </View>
        )}

        <AdBanner />

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
              Need {getMessageCost(conversation?.messageCount ?? messages.length)} points to translate
            </Text>
            <TouchableOpacity onPress={handleWatchAdForPoints} style={styles.pointsBannerBtn}>
              <Text style={styles.pointsBannerBtnText}>Watch Ad +{POINTS.WATCH_AD_BASE}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 },
          ]}
        >
          {inputMode === 'voice' ? (
            <View style={styles.voiceRow}>
              {/* Keyboard toggle */}
              <TouchableOpacity
                style={styles.modeToggle}
                onPress={() => {
                  if (phaseRef.current === 'recording') {
                    shouldFinalizeOnEndRef.current = false;
                    try {
                      ExpoSpeechRecognitionModule.stop();
                    } catch {
                      /* ignore */
                    }
                    resetRecordingState();
                  }
                  setInputMode('keyboard');
                }}
              >
                <Ionicons name="keypad-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Walkie-talkie slider */}
              <View style={styles.sliderContainer}>
                {/* Left label */}
                <Animated.View style={[styles.sliderSide, { opacity: leftOpacity }]}>
                  <FlagEmoji countryCode={langBInfo?.countryCode ?? 'BD'} size={22} />
                  <Text style={[styles.sliderSideText, { color: colors.text }]}>
                    {langBInfo?.nativeName || langBInfo?.name}
                  </Text>
                </Animated.View>

                {/* Track + Draggable Mic */}
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderTrackLine, { backgroundColor: colors.border }]} />

                  <Animated.View
                    style={[
                      styles.micBtnLarge,
                      {
                        transform: [{ translateX: panX }, { scale: pulseAnim }],
                        backgroundColor: phase === 'recording' ? '#FF3B30' : micBackgroundColor,
                      },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    {phase === 'processing' ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="mic" size={28} color="#FFF" />
                    )}
                  </Animated.View>
                </View>

                {/* Right label */}
                <Animated.View style={[styles.sliderSide, { opacity: rightOpacity }]}>
                  <FlagEmoji countryCode={langAInfo?.countryCode ?? 'US'} size={22} />
                  <Text style={[styles.sliderSideText, { color: colors.text }]}>
                    {langAInfo?.nativeName || langAInfo?.name}
                  </Text>
                </Animated.View>
              </View>

              {/* Spacer to balance layout */}
              <View style={styles.modeToggle} />
            </View>
          ) : (
            <View style={styles.keyboardRow}>
              <TouchableOpacity
                onPress={() => {
                  setInputText('');
                  setTranslationPreview('');
                  setInputMode('voice');
                }}
              >
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
                <View
                  style={[
                    styles.actionBtn2,
                    {
                      backgroundColor: sending || !inputText.trim() ? colors.surface : '#007AFF',
                    },
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Ionicons
                      name="send"
                      size={16}
                      color={inputText.trim() ? '#FFF' : colors.textSecondary}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Partial transcript hint */}
          {phase === 'recording' && voicePartial ? (
            <View style={styles.partialStrip}>
              <WordHighlight
                text={voicePartial}
                baseStyle={[styles.partialText, { color: colors.text }]}
              />
            </View>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  langIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  langChipText: { fontSize: 13, fontWeight: '500' },
  menuDropdown: {
    position: 'absolute',
    top: 50,
    right: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  messagesList: { padding: 16, flexGrow: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  messageContent: { maxWidth: '75%' },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  bubbleLeft: { borderBottomLeftRadius: 4 },
  bubbleRight: { borderBottomRightRadius: 4 },
  primaryText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  secondaryText: { fontSize: 14, lineHeight: 20, marginTop: 6, fontStyle: 'italic' },
  messageActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    alignItems: 'center',
    gap: 2,
  },
  deleteText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewText: { fontSize: 13, fontStyle: 'italic', lineHeight: 18, flex: 1 },
  inputBar: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  modeToggle: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  sliderSide: {
    alignItems: 'center',
    gap: 4,
    width: 70,
  },
  sliderSideText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  sliderTrack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
  sliderTrackLine: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  micBtnLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  partialStrip: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  partialText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
  keyboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  input: { fontSize: 16, lineHeight: 20 },
  actionBtn2: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  costIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  costIndicatorText: {
    fontSize: 11,
    fontWeight: '500',
  },
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  pointsBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginLeft: 6,
  },
  pointsBannerBtn: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pointsBannerBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
