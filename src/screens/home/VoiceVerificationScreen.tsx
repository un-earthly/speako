import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import { useTheme } from '../../contexts/ThemeContext';
import { getLanguageByCode } from '../../constants/languages';
import { getTestPhrase } from '../../constants/phrases';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.78;

// Per-bar height multipliers for a natural look
const BAR_MULTIPLIERS = [0.55, 0.85, 1.0, 0.80, 0.50];

export function VoiceVerificationScreen({ route, navigation }: any) {
  const { languageCode, onVerified } = route.params || {};
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lang = getLanguageByCode(languageCode);
  const phrase = getTestPhrase(languageCode);

  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);

  const glowAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef(BAR_MULTIPLIERS.map(() => new Animated.Value(4))).current;

  const resetWave = () => {
    glowAnim.setValue(1);
    waveAnims.forEach((a) =>
      Animated.timing(a, { toValue: 4, duration: 200, useNativeDriver: false }).start()
    );
  };

  useSpeechRecognitionEvent('volumechange', (e) => {
    const vol = Math.max(0, Math.min(e.value, 10));
    const normalized = vol / 10;

    Animated.timing(glowAnim, {
      toValue: 1 + normalized * 0.4,
      duration: 80,
      useNativeDriver: true,
    }).start();

    waveAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 4 + normalized * 28 * BAR_MULTIPLIERS[i],
        duration: 80,
        useNativeDriver: false,
      }).start();
    });
  });

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    console.log(`[VoiceVerification] ${e.isFinal ? 'FINAL' : 'partial'}:`, JSON.stringify(text));
    if (e.isFinal) {
      setHasRecorded(true);
      setIsRecording(false);
      resetWave();
    }
  });

  useSpeechRecognitionEvent('error', (e) => {
    console.log('[VoiceVerification] STT error:', e.error, e.message);
    setIsRecording(false);
    resetWave();
  });

  const handleMicPress = async () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
      setIsRecording(false);
      resetWave();
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission needed', 'Please allow microphone access in settings.');
      return;
    }
    const locale = lang ? `${lang.code}-${lang.countryCode}` : 'en-US';
    console.log('[VoiceVerification] Starting STT for locale:', locale);
    setIsRecording(true);
    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: true,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
    });
  };

  const handleContinue = () => {
    if (isRecording) {
      ExpoSpeechRecognitionModule.stop();
    }
    if (onVerified) onVerified();
    navigation.goBack();
  };

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} onPress={handleContinue} activeOpacity={1} />

      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>Select Your language</Text>

        <TouchableOpacity
          style={[styles.langRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          {lang ? (
            <FlagEmoji countryCode={lang.countryCode} size={22} />
          ) : (
            <View style={styles.sparkleBox}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            </View>
          )}
          <Text style={[styles.langRowText, { color: colors.text }]}>{lang?.name ?? 'Select Language'}</Text>
          <Ionicons name="chevron-up" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={[styles.asSelected, { color: colors.text }]}>As You have Selected</Text>

          {lang && (
            <View style={styles.bigFlagWrap}>
              <FlagEmoji countryCode={lang.countryCode} size={48} />
            </View>
          )}

          <Text style={[styles.langQuote, { color: colors.text }]}>"{lang?.name}"</Text>

          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            {'Tap the below Button &\nPlease Say the below Line\nin '}
            <Text style={{ fontStyle: 'italic' }}>"{lang?.name}"</Text>
            {' clearly'}
          </Text>

          <Text style={[styles.phraseText, { color: isRecording ? '#007AFF' : colors.text }]}>
            {phrase ? `"${phrase}"` : ''}
          </Text>

          <View style={styles.micContainer}>
            <Animated.View
              style={[
                styles.micGlow,
                { transform: [{ scale: glowAnim }], opacity: isRecording ? 0.3 : 0.15 },
              ]}
            />
            <TouchableOpacity style={styles.micButton} onPress={handleMicPress} activeOpacity={0.85}>
              {isRecording ? (
                <View style={styles.waveContainer}>
                  {waveAnims.map((anim, i) => (
                    <Animated.View key={i} style={[styles.waveBar, { height: anim }]} />
                  ))}
                </View>
              ) : (
                <Ionicons name="mic" size={28} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleContinue} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: hasRecorded ? '#007AFF' : colors.textSecondary }]}>
              {hasRecorded ? 'Continue' : 'Skip for now'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetTitle: { fontSize: 14, textAlign: 'center', marginBottom: 12 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    marginBottom: 4,
  },
  sparkleBox: {
    width: 40,
    height: 27,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langRowText: { flex: 1, fontSize: 16, fontWeight: '500' },
  content: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  asSelected: { fontSize: 15, fontWeight: '500', marginBottom: 12 },
  bigFlagWrap: { marginBottom: 8 },
  langQuote: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  phraseText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 28,
  },
  micContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  micGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 36,
  },
  waveBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  skipBtn: { paddingVertical: 8 },
  skipText: { fontSize: 15, fontWeight: '500' },
});
