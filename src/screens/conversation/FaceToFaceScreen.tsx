import React, { useState, useRef, useEffect } from 'react';
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
import { getLanguageByCode } from '../../constants/languages';
import { sendMessage, subscribeToMessages, type Message } from '../../services/firestore';
import { translateText } from '../../services/translation';

function WordHighlight({ text, baseStyle }: { text: string; baseStyle: any }) {
  const words = text.trim().split(/(\s+)/);
  if (words.length < 2) {
    return <Text style={[baseStyle, { color: '#007AFF', fontWeight: '700' }]}>{text}</Text>;
  }
  // Last non-empty token is the newest word
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
  const { user } = useAuth();
  const { colors } = useTheme();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voicePartial, setVoicePartial] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('voice');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [translationPreview, setTranslationPreview] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [cannotDetect, setCannotDetect] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const langAInfo = getLanguageByCode(langA);
  const langBInfo = getLanguageByCode(langB);
  const langABase = langA.split('-')[0].split('_')[0];
  const langBBase = langB.split('-')[0].split('_')[0];

  useEffect(() => {
    return subscribeToMessages(conversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    });
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, []);

  function detectSpeaker(text: string): { sourceLang: string; targetLang: string } {
    const detected = detectScript(text.trim());
    // If script clearly matches langB, person B is speaking
    if (detected && detected === langBBase) return { sourceLang: langB, targetLang: langA };
    // Everything else (langA match, unknown Latin, null) → STT is set to langA so it's person A
    return { sourceLang: langA, targetLang: langB };
  }

  useSpeechRecognitionEvent('result', async (e) => {
    const text = e.results[0]?.transcript ?? '';

    if (!e.isFinal) {
      setVoicePartial(text);
      const detected = detectScript(text);
      if (detected === langABase) setDetectedLang(langA);
      else if (detected === langBBase) setDetectedLang(langB);
      return;
    }

    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    setIsRecording(false);
    setVoicePartial('');

    if (!text || !user) return;

    const pair = detectSpeaker(text);
    if (!pair) {
      setCannotDetect(true);
      setTimeout(() => setCannotDetect(false), 3000);
      setDetectedLang(null);
      return;
    }

    setSending(true);
    try {
      const translated = await translateText(text, pair.sourceLang, pair.targetLang);
      await sendMessage(conversationId, user.uid, text, translated, pair.sourceLang, pair.targetLang, 'voice');
    } catch (err) {
      console.error('FaceToFace send failed:', err);
    } finally {
      setSending(false);
      setDetectedLang(null);
    }
  });

  useSpeechRecognitionEvent('volumechange', (e) => {
    const vol = e.value; // -2 to 10; below 0 is inaudible
    const scale = vol < 0 ? 1 : 1 + Math.min(vol / 10, 1) * 0.45;
    Animated.timing(pulseAnim, { toValue: scale, duration: 80, useNativeDriver: true }).start();
  });

  useSpeechRecognitionEvent('error', () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    setIsRecording(false);
    setVoicePartial('');
    setDetectedLang(null);
  });

  const startRecording = async () => {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) return;
      setVoicePartial('');
      setDetectedLang(null);
      setCannotDetect(false);
      setIsRecording(true);
      // Use langA as STT base; detectScript identifies the actual language from the transcript
      ExpoSpeechRecognitionModule.start({
        lang: langA,
        interimResults: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
    } catch {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
    setIsRecording(false);
    setVoicePartial('');
    setDetectedLang(null);
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* ignore */ }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    clearTimeout(previewTimer.current);

    if (!text.trim()) {
      setTranslationPreview('');
      setIsPreviewLoading(false);
      return;
    }

    const pair = detectSpeaker(text);
    if (!pair) return;

    setIsPreviewLoading(true);
    previewTimer.current = setTimeout(async () => {
      const preview = await translateText(text, pair.sourceLang, pair.targetLang);
      setTranslationPreview(preview !== text ? preview : '');
      setIsPreviewLoading(false);
    }, 900);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user || sending) return;

    const pair = detectSpeaker(text);
    if (!pair) {
      setCannotDetect(true);
      setTimeout(() => setCannotDetect(false), 3000);
      return;
    }

    setInputText('');
    setTranslationPreview('');
    setIsPreviewLoading(false);
    clearTimeout(previewTimer.current);
    setSending(true);
    try {
      const translated = await translateText(text, pair.sourceLang, pair.targetLang);
      await sendMessage(conversationId, user.uid, text, translated, pair.sourceLang, pair.targetLang);
    } catch (err) {
      console.error('FaceToFace send failed:', err);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const itemBase = item.sourceLanguage.split('-')[0].split('_')[0];
    const isPersonA = itemBase === langABase;
    const speakerInfo = isPersonA ? langAInfo : langBInfo;

    return (
      <View style={[styles.messageRow, isPersonA ? styles.rowRight : styles.rowLeft]}>
        {!isPersonA && (
          <View style={[styles.avatarSmall, { backgroundColor: colors.surface }]}>
            <FlagEmoji countryCode={langBInfo?.countryCode ?? 'US'} size={18} />
          </View>
        )}
        <View style={styles.messageContent}>
          <View
            style={[
              styles.bubble,
              isPersonA
                ? [styles.bubbleRight, { backgroundColor: '#007AFF' }]
                : [styles.bubbleLeft, { backgroundColor: colors.surface }],
            ]}
          >
            <Text style={[styles.primaryText, { color: isPersonA ? '#FFF' : colors.text }]}>
              {item.originalText}
            </Text>
            {item.translatedText !== item.originalText && (
              <Text style={[styles.secondaryText, { color: isPersonA ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
                {item.translatedText}
              </Text>
            )}
          </View>
          <View style={[styles.messageActions, isPersonA ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={() => Speech.speak(item.translatedText, { language: item.targetLanguage })}
            >
              <Ionicons name="play-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={() => Clipboard.setString(item.translatedText)}
            >
              <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        {isPersonA && (
          <View style={[styles.avatarSmall, { backgroundColor: colors.surface }]}>
            <FlagEmoji countryCode={speakerInfo?.countryCode ?? 'US'} size={18} />
          </View>
        )}
      </View>
    );
  };

  const detectedLangInfo = detectedLang === langA ? langAInfo : detectedLang === langB ? langBInfo : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        {/* Header */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
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
              <FlagEmoji countryCode={langBInfo?.countryCode ?? 'US'} size={14} />
              <Text style={[styles.langChipText, { color: colors.text }]}>{langBInfo?.name}</Text>
            </View>
          </View>
          <View style={{ width: 34 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={44} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Tap the mic and speak in either language.{'\n'}Translation happens automatically.
              </Text>
            </View>
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Cannot detect warning */}
        {cannotDetect && (
          <View style={styles.warnBanner}>
            <Ionicons name="warning-outline" size={14} color="#FFF" />
            <Text style={styles.warnText}>Could not detect language — speak more clearly</Text>
          </View>
        )}

        {/* Translation preview (keyboard mode) */}
        {inputMode === 'keyboard' && (translationPreview || isPreviewLoading) && (
          <View style={[styles.previewStrip, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            {isPreviewLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={[styles.previewText, { color: colors.textSecondary }]}>{translationPreview}</Text>
            )}
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
          {inputMode === 'voice' ? (
            <View style={styles.voiceRow}>
              {/* Keyboard toggle */}
              <TouchableOpacity
                style={styles.modeToggle}
                onPress={() => { stopRecording(); setInputMode('keyboard'); }}
              >
                <Ionicons name="keypad-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Central mic area */}
              <View style={styles.voiceCenter}>
                {isRecording ? (
                  <TouchableOpacity onPress={stopRecording} activeOpacity={0.85} style={styles.recordingWrapper}>
                    <Animated.View style={[styles.micBtnLarge, styles.micBtnRecording, { transform: [{ scale: pulseAnim }] }]}>
                      <Ionicons name="stop" size={28} color="#FFF" />
                    </Animated.View>
                    {voicePartial ? (
                      <WordHighlight
                        text={voicePartial}
                        baseStyle={[styles.listeningLabel, { color: colors.text }]}
                      />
                    ) : (
                      <Text style={[styles.listeningLabel, { color: colors.textSecondary }]}>Listening...</Text>
                    )}
                    {detectedLangInfo && (
                      <View style={styles.speakerIndicator}>
                        <FlagEmoji countryCode={detectedLangInfo.countryCode} size={14} />
                        <Text style={[styles.speakerLabel, { color: colors.textSecondary }]}>{detectedLangInfo.name}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={startRecording} activeOpacity={0.85} style={styles.recordingWrapper}>
                    <View style={[styles.micBtnLarge, { backgroundColor: '#007AFF' }]}>
                      {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Ionicons name="mic" size={28} color="#FFF" />
                      )}
                    </View>
                    <Text style={[styles.tapLabel, { color: colors.textSecondary }]}>Tap to speak</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Spacer to balance layout */}
              <View style={styles.modeToggle} />
            </View>
          ) : (
            <View style={styles.keyboardRow}>
              <TouchableOpacity onPress={() => { setInputText(''); setTranslationPreview(''); setInputMode('voice'); }}>
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
                <View style={[
                  styles.actionBtn2,
                  { backgroundColor: (sending || !inputText.trim()) ? colors.surface : '#007AFF' },
                ]}>
                  {sending ? (
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  ) : (
                    <Ionicons name="send" size={16} color={inputText.trim() ? '#FFF' : colors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>
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
  },
  messageContent: { maxWidth: '75%' },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FF9500',
  },
  warnText: { color: '#FFF', fontSize: 13, fontWeight: '500', flex: 1 },
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
  voiceCenter: {
    flex: 1,
    alignItems: 'center',
  },
  recordingWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  micBtnLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  micBtnRecording: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  listeningLabel: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 200,
  },
  tapLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  speakerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  speakerLabel: { fontSize: 12 },
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
});
