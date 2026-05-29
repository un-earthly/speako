import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { detectScript } from '../../services/language-detect';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import * as Speech from 'expo-speech';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Routes } from '../../constants/routes';
import { getLanguageByCode } from '../../constants/languages';
import {
  sendMessage,
  subscribeToMessages,
  subscribeToConversation,
  type Message,
  type Conversation,
} from '../../services/firestore';
import { translateText } from '../../services/translation';
import { checkSpelling, applyCorrection, type SpellMatch } from '../../services/spellcheck';
import { sendPushNotification } from '../../services/notifications';
import { isSameDay, formatDateLabel } from '../../utils/date';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import { AdBanner } from '../../components/common/AdBanner';
import { useToast } from '../../contexts/ToastContext';
import { POINTS, getUserPoints, deductPoints, rewardAdWatch } from '../../services/rewards';
import { getMessageCost } from '../../utils/points';

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

export function ConversationScreen({ route, navigation }: any) {
  const { conversationId } = route.params || {};
  const { user } = useAuth();

  const { colors, isDark } = useTheme();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [translationPreview, setTranslationPreview] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [spellMatches, setSpellMatches] = useState<SpellMatch[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voicePartial, setVoicePartial] = useState('');
  const [langMismatch, setLangMismatch] = useState(false);

  const [userPoints, setUserPoints] = useState(0);
  const [showPointsBanner, setShowPointsBanner] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const spellTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const myLanguageRef = useRef('en');
  const sessionMsgCountRef = useRef(0);
  const insets = useSafeAreaInsets();
  const { showAd: showInterstitial } = useInterstitialAd();
  const { showAd: showRewardedAd } = useRewardedAd();
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) return;
    getUserPoints(user.uid).then(setUserPoints);
  }, [user?.uid]);

  // Derive languages from conversation document
  const otherUid = conversation?.participants.find((p) => p !== user?.uid);
  const myLanguage = (user?.uid && conversation?.participantLanguages[user.uid]) || 'en';
  const otherLanguage = (otherUid && conversation?.participantLanguages[otherUid]) || conversation?.expectedOtherLanguage || 'en';
  const myLang = getLanguageByCode(myLanguage);
  const otherLang = getLanguageByCode(otherLanguage);

  useEffect(() => {
    if (!conversationId || !user) return;
    const unsubConvo = subscribeToConversation(conversationId, setConversation);
    const unsubMsgs = subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });
    return () => {
      unsubConvo();
      unsubMsgs();
    };
  }, [conversationId, user?.uid]);

  useEffect(() => {
    return () => {
      if (spellTimer.current) clearTimeout(spellTimer.current);
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  useEffect(() => { myLanguageRef.current = myLanguage; }, [myLanguage]);

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      if (text) {
        setInputText(text);
        handleTextChange(text);
        const detected = detectScript(text);
        const base = myLanguageRef.current.split('-')[0].split('_')[0];
        if (detected && detected !== base && detected !== 'en') {
          setLangMismatch(true);
          setTimeout(() => setLangMismatch(false), 3500);
        }
      }
      setIsRecording(false);
      setVoicePartial('');
    } else {
      setVoicePartial(text);
    }
  });

  useSpeechRecognitionEvent('volumechange', (e) => {
    const vol = e.value;
    const scale = vol < 0 ? 1 : 1 + Math.min(vol / 10, 1) * 0.45;
    Animated.timing(pulseAnim, { toValue: scale, duration: 80, useNativeDriver: true }).start();
  });

  useSpeechRecognitionEvent('error', () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    setIsRecording(false);
    setVoicePartial('');
  });

  const startRecording = async () => {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      setVoicePartial('');
      setIsRecording(true);
      const lang = getLanguageByCode(myLanguageRef.current);
      const locale = lang ? `${lang.code}-${lang.countryCode}` : 'en-US';
      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
    } catch {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    setIsRecording(false);
    setVoicePartial('');
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
  };

  const canTranslate = userPoints >= getMessageCost(conversation?.messageCount ?? 0);

  const handleTextChange = (text: string) => {
    setInputText(text);
    setShowPointsBanner(userPoints < getMessageCost(conversation?.messageCount ?? 0));

    clearTimeout(spellTimer.current);
    clearTimeout(previewTimer.current);

    if (!text.trim()) {
      setSpellMatches([]);
      setTranslationPreview('');
      setIsPreviewLoading(false);
      return;
    }

    if (!canTranslate) return;

    spellTimer.current = setTimeout(async () => {
      const matches = await checkSpelling(text, myLanguage);
      setSpellMatches(matches);
    }, 600);

    setIsPreviewLoading(true);
    previewTimer.current = setTimeout(async () => {
      const preview = await translateText(text, myLanguage, otherLanguage);
      setTranslationPreview(preview !== text ? preview : '');
      setIsPreviewLoading(false);
    }, 900);
  };

  const handleApplyCorrection = (match: SpellMatch, replacement: string) => {
    const corrected = applyCorrection(inputText, match, replacement);
    setInputText(corrected);
    setSpellMatches([]);
    showToast('Correction applied', 'success');
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user || !conversationId || conversation?.status !== 'active') return;

    const msgCount = conversation?.messageCount ?? 0;
    const cost = getMessageCost(msgCount);

    if (userPoints < cost) {
      setShowPointsBanner(true);
      return;
    }

    setInputText('');
    setSpellMatches([]);
    setTranslationPreview('');
    setIsPreviewLoading(false);
    clearTimeout(spellTimer.current);
    clearTimeout(previewTimer.current);
    setSending(true);
    try {
      const translated = await translateText(text, myLanguage, otherLanguage);

      const ok = await deductPoints(user.uid, cost, 'message', conversationId);
      if (ok) {
        setUserPoints((p) => Math.max(0, p - cost));
      }

      await sendMessage(conversationId, user.uid, text, translated, myLanguage, otherLanguage);
      sessionMsgCountRef.current += 1;
      if (sessionMsgCountRef.current % 10 === 0) {
        showInterstitial();
      }
      if (otherUid) {
        sendPushNotification(otherUid, user.displayName || 'Someone', text, conversationId);
      }
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const prev = messages[index - 1];
    const showDate = index === 0 || !isSameDay(prev?.createdAt ?? null, item.createdAt);
    const isMe = item.senderId === user?.uid;
    const primaryText = item.translatedText;
    const secondaryText = item.originalText;
    const speakText = isMe ? item.translatedText : item.originalText;
    const speakLang = isMe ? item.targetLanguage : item.sourceLanguage;
    const avatarCountryCode = isMe
      ? (myLang?.countryCode ?? 'US')
      : (otherLang?.countryCode ?? 'US');

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {formatDateLabel(item.createdAt)}
            </Text>
            <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <View style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}>
        {!isMe && (
          <View style={[styles.avatarSmall, {
            backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
            borderColor: isDark ? colors.glassBorder : colors.border,
          }]}>
            <FlagEmoji countryCode={avatarCountryCode} size={18} />
          </View>
        )}
        <View style={styles.messageContent}>
          <View
            style={[
              styles.bubble,
              isMe
                ? [styles.bubbleRight, { backgroundColor: '#007AFF', shadowColor: '#007AFF' }]
                : [styles.bubbleLeft, {
                    backgroundColor: isDark ? colors.glass : colors.surface,
                    borderColor: isDark ? colors.glassBorder : colors.border,
                    shadowColor: colors.shadow,
                  }],
            ]}
          >
            <Text style={[styles.primaryText, { color: isMe ? '#FFF' : colors.text }]}>
              {primaryText}
            </Text>
            {secondaryText !== primaryText && (
              <Text
                style={[
                  styles.secondaryText,
                  { color: isMe ? 'rgba(255,255,255,0.75)' : colors.textSecondary },
                ]}
              >
                {secondaryText}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.messageActions,
              isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
            ]}
          >
            <TouchableOpacity
              style={[styles.actionBtn, {
                borderColor: isDark ? colors.glassBorder : colors.border,
                backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
              }]}
              onPress={() => Speech.speak(speakText, { language: speakLang })}
            >
              <Ionicons name="play-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, {
                borderColor: isDark ? colors.glassBorder : colors.border,
                backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
              }]}
              onPress={() => {
                Clipboard.setString(speakText);
                showToast('Copied to clipboard', 'success');
              }}
            >
              <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        {isMe && (
          <View style={[styles.avatarSmall, {
            backgroundColor: isDark ? colors.glass : colors.surfaceHighlight,
            borderColor: isDark ? colors.glassBorder : colors.border,
          }]}>
            <FlagEmoji countryCode={avatarCountryCode} size={18} />
          </View>
        )}
      </View>
      </View>
    );
  };

  // Loading state while conversation doc hasn't arrived yet
  if (!conversation) {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Waiting state — shouldn't normally be reached (WaitingScreen handles this),
  // but shown as a fallback if the second person hasn't joined yet
  if (conversation.status === 'waiting') {
    return (
      <View style={[styles.centerState, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtnAbs} onPress={async () => { await showInterstitial(); navigation.goBack(); }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.waitingTitle, { color: colors.text }]}>Waiting for other person</Text>
        <Text style={[styles.waitingCode, { color: colors.textSecondary }]}>
          Invite code:{' '}
          <Text style={{ fontWeight: '800', color: colors.text, letterSpacing: 4 }}>
            {conversation.inviteCode}
          </Text>
        </Text>
        <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 8 }} />
      </View>
    );
  }

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
          <TouchableOpacity onPress={async () => { await showInterstitial(); navigation.goBack(); }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.langIndicators}>
            <View style={[styles.langChip, { backgroundColor: colors.surface }]}>
              <FlagEmoji countryCode={myLang?.countryCode ?? 'US'} size={14} />
              <Text style={[styles.langChipText, { color: colors.text }]}>{myLang?.name}</Text>
            </View>
            <View style={[styles.langChip, { backgroundColor: colors.surface }]}>
              <FlagEmoji countryCode={otherLang?.countryCode ?? 'US'} size={14} />
              <Text style={[styles.langChipText, { color: colors.text }]}>{otherLang?.name}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.profileBtn, { backgroundColor: colors.surface }]}
            onPress={() => navigation.navigate(Routes.Account)}
          >
            <Ionicons name="person" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <AdBanner />

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Say hello! Your messages are translated automatically.
              </Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Translation preview strip */}
        {(translationPreview || isPreviewLoading) && conversation?.status === 'active' && (
          <View style={[styles.previewStrip, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={{ alignSelf: 'flex-start', marginTop: 2 }}>
              <FlagEmoji countryCode={otherLang?.countryCode ?? 'US'} size={13} />
            </View>
            {isPreviewLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginLeft: 6 }} />
            ) : (
              <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                  {translationPreview}
                </Text>
              </ScrollView>
            )}
          </View>
        )}

        {/* Spell check suggestions */}
        {spellMatches.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.suggestionsRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
            contentContainerStyle={styles.suggestionsContent}
          >
            {spellMatches.flatMap((match, i) =>
              match.replacements.map((rep, j) => (
                <TouchableOpacity
                  key={`${i}-${j}`}
                  style={[styles.suggestionChip, { backgroundColor: colors.surfaceHighlight }]}
                  onPress={() => handleApplyCorrection(match, rep)}
                >
                  <Text style={[styles.suggestionOld, { color: colors.textSecondary }]}>{match.word}</Text>
                  <Ionicons name="arrow-forward" size={10} color={colors.textSecondary} />
                  <Text style={[styles.suggestionNew, { color: colors.text }]}>{rep}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}

        {/* Lang mismatch warning */}
        {langMismatch && (
          <View style={styles.mismatchBanner}>
            <Ionicons name="warning-outline" size={14} color="#FFF" />
            <Text style={styles.mismatchText}>Detected different language — check your selection</Text>
          </View>
        )}

        {/* Message cost indicator */}
        {conversation?.status === 'active' && (
          <View style={[styles.costIndicator, { borderTopColor: colors.border }]}>
            <Text style={[styles.costIndicatorText, { color: colors.textSecondary }]}>
              {`This message costs ${getMessageCost(conversation?.messageCount ?? 0)} points`}
            </Text>
          </View>
        )}

        {/* Insufficient points banner */}
        {showPointsBanner && (
          <View style={[styles.pointsBanner, { backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : '#FFEBEE' }]}>
            <Ionicons name="flash" size={14} color="#FF3B30" />
            <Text style={[styles.pointsBannerText, { color: '#FF3B30' }]}>
              Need {getMessageCost(conversation?.messageCount ?? 0)} points
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
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 10,
            },
          ]}
        >
          {isRecording ? (
            <TouchableOpacity
              style={[styles.inputWrapper, styles.recordingArea, { backgroundColor: colors.inputBackground }]}
              onPress={stopRecording}
              activeOpacity={0.85}
            >
              <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
              {voicePartial ? (
                <WordHighlight
                  text={voicePartial}
                  baseStyle={[styles.recordingText, { color: colors.text }]}
                />
              ) : (
                <Text style={[styles.recordingText, { color: colors.textSecondary }]} numberOfLines={2}>
                  Listening...
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={`Type in ${myLang?.name || 'your language'}...`}
                placeholderTextColor={colors.textSecondary}
                value={inputText}
                onChangeText={handleTextChange}
                multiline
                onSubmitEditing={handleSend}
              />
            </View>
          )}
          {inputText.trim() && !isRecording ? (
            <TouchableOpacity onPress={handleSend} disabled={sending}>
              <View style={[styles.actionBtn2, { backgroundColor: sending ? colors.surface : '#007AFF' }]}>
                {sending ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : (
                  <Ionicons name="send" size={16} color="#FFF" />
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={isRecording ? stopRecording : startRecording}>
              <View style={[styles.actionBtn2, { backgroundColor: isRecording ? '#FF3B30' : colors.surface }]}>
                <Ionicons name={isRecording ? 'stop' : 'mic'} size={20} color={isRecording ? '#FFF' : colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  backBtnAbs: {
    position: 'absolute',
    top: 56,
    left: 16,
    padding: 8,
  },
  waitingTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  waitingCode: { fontSize: 15, textAlign: 'center' },
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
    gap: 12,
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
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: { padding: 16, flexGrow: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
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
  secondaryText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    fontStyle: 'italic',
  },
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
  recordingArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  recordingText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  mismatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FF9500',
  },
  mismatchText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
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
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
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
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 120,
  },
  previewScroll: {
    flex: 1,
  },
  previewText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  suggestionsRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: 48,
  },
  suggestionsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  suggestionOld: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  suggestionNew: {
    fontSize: 13,
    fontWeight: '600',
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
});
