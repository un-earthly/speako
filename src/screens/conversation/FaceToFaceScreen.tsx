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
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { transcribeAudio } from '../../services/whisper';
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
import { translateAutoDetect } from '../../services/translation';
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
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('voice');
  const [translationPreview, setTranslationPreview] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [userPoints, setUserPoints] = useState(authPoints);
  const [showPointsBanner, setShowPointsBanner] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessionMsgCountRef = useRef(0);
  const insets = useSafeAreaInsets();

  const langAInfo = getLanguageByCode(langA);
  const langBInfo = getLanguageByCode(langB);
  const langABase = langA.split('-')[0].split('_')[0];

  const phaseRef = useRef<Phase>('idle');
  const recordingStartedAt = useRef(0);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const waveformBars = useRef(
    Array(5).fill(null).map(() => new Animated.Value(0.25))
  ).current;
  const waveformTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pre-warm mic permission
  useEffect(() => {
    AudioModule.requestRecordingPermissionsAsync().catch(() => {});
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

  // ── Waveform helpers ───────────────────────────────────────────────────────

  const startWaveform = useCallback(() => {
    if (waveformTimer.current) clearInterval(waveformTimer.current);
    waveformTimer.current = setInterval(() => {
      waveformBars.forEach((bar) => {
        Animated.timing(bar, {
          toValue: 0.15 + Math.random() * 0.85,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    }, 180);
  }, [waveformBars]);

  const stopWaveform = useCallback(() => {
    if (waveformTimer.current) { clearInterval(waveformTimer.current); waveformTimer.current = null; }
    waveformBars.forEach((bar) =>
      Animated.timing(bar, { toValue: 0.25, duration: 120, useNativeDriver: true }).start()
    );
  }, [waveformBars]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetRecordingState = useCallback(() => {
    stopWaveform();
    setPhase('idle');
    phaseRef.current = 'idle';
  }, [stopWaveform]);

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

  const startRecording = async () => {
    if (phaseRef.current !== 'idle') return;
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) { showToast('Microphone permission required', 'error'); return; }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
      phaseRef.current = 'recording';
      recordingStartedAt.current = Date.now();
      startWaveform();
    } catch (err) {
      console.error('[Recorder] start failed:', err);
      resetRecordingState();
    }
  };

  const stopAndTranscribe = async () => {
    const elapsed = Date.now() - recordingStartedAt.current;
    stopWaveform();
    setPhase('processing');
    phaseRef.current = 'processing';

    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (!uri || elapsed < 500) {
        resetRecordingState();
        return;
      }

      const transcript = await transcribeAudio(uri);
      if (!transcript) { resetRecordingState(); return; }

      const msgCount = conversation?.messageCount ?? messages.length;
      const cost = getMessageCost(msgCount);
      if (userPoints < cost) {
        setShowPointsBanner(true);
        resetRecordingState();
        return;
      }

      setSending(true);
      const { translated, sourceLang, targetLang } = await translateAutoDetect(transcript, langA, langB);

      const ok = await deductPoints(user!.uid, cost, 'message', conversationId);
      if (ok) setUserPoints((p) => Math.max(0, p - cost));

      addOptimisticMessage(transcript, translated, sourceLang, targetLang, 'voice');
      sendMessage(conversationId, user!.uid, transcript, translated, sourceLang, targetLang, 'voice')
        .catch((err) => console.error('Firestore send failed:', err));

      sessionMsgCountRef.current += 1;
      if (sessionMsgCountRef.current % 10 === 0) showInterstitial();
    } catch (err: any) {
      console.error('[Whisper] transcription failed:', err);
      showToast(err.message || 'Transcription failed', 'error');
    } finally {
      setSending(false);
      resetRecordingState();
    }
  };

  const handleTap = () => {
    if (phase === 'processing') return;
    if (phase === 'idle') { startRecording(); return; }
    stopAndTranscribe();
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
  const { showAd: showInterstitial } = useInterstitialAd();
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
      sessionMsgCountRef.current += 1;
      if (sessionMsgCountRef.current % 10 === 0) {
        showInterstitial();
      }
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
                Tap the mic to speak in either language.{'\n'}Tap again to stop and translate.
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
              <TouchableOpacity
                style={styles.modeToggle}
                onPress={() => {
                  if (phaseRef.current === 'recording') {
                    recorder.stop().catch(() => {});
                    resetRecordingState();
                  }
                  setInputMode('keyboard');
                }}
              >
                <Ionicons name="keypad-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.micCenter}>
                <TouchableOpacity onPress={handleTap} disabled={phase === 'processing'} activeOpacity={0.8}>
                  <Animated.View
                    style={[
                      styles.micBtnLarge,
                      {
                        transform: [{ scale: pulseAnim }],
                        backgroundColor: phase === 'recording' ? '#FF3B30' : '#007AFF',
                        opacity: phase === 'processing' ? 0.6 : 1,
                      },
                    ]}
                  >
                    {phase === 'processing' ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name={phase === 'recording' ? 'stop' : 'mic'} size={28} color="#FFF" />
                    )}
                  </Animated.View>
                </TouchableOpacity>
                <Text style={[styles.micLabel, { color: colors.textSecondary }]}>
                  {phase === 'idle' ? 'Tap to speak' : phase === 'recording' ? 'Tap to stop' : 'Translating…'}
                </Text>
              </View>

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

          {/* Live waveform while recording */}
          {phase === 'recording' && (
            <View style={styles.waveformStrip}>
              {waveformBars.map((bar, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    { transform: [{ scaleY: bar }] },
                  ]}
                />
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
  micCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  micLabel: {
    fontSize: 12,
    fontWeight: '500',
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
  waveformStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    height: 36,
  },
  waveBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: '#FF3B30',
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
