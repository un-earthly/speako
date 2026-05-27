import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguagePickerModal } from '../../components/common/LanguagePickerModal';
import { getLanguageByCode, type Language } from '../../constants/languages';
import { Routes } from '../../constants/routes';
import { createConversation, createFaceToFaceConversation, subscribeToConversations, type Conversation } from '../../services/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function HomeScreen({ navigation }: any) {
  const { user, updateUserProfile } = useAuth();
  const { theme, resolvedTheme, colors } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const iconColor = isDark ? '#FFFFFF' : '#1a1a1a';
  const iconColorMuted = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)';
  const [myLanguage, setMyLanguage] = useState(user?.preferredLanguage || '');
  const [theirLanguage, setTheirLanguage] = useState(user?.lastTheirLanguage || '');
  const [showMyLangPicker, setShowMyLangPicker] = useState(false);
  const [showTheirLangPicker, setShowTheirLangPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recentConvos, setRecentConvos] = useState<Conversation[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(user.uid, (convos) => {
      setRecentConvos(convos.slice(0, 5));
    });
  }, [user?.uid]);

  const myLang = getLanguageByCode(myLanguage);
  const theirLang = getLanguageByCode(theirLanguage);

  const handleMyLanguageSelect = useCallback(
    (lang: Language) => {
      setMyLanguage(lang.code);
      updateUserProfile({ preferredLanguage: lang.code }).catch(() => { });
      navigation.navigate('VoiceVerification', { languageCode: lang.code, onVerified: () => { } });
    },
    [navigation, updateUserProfile],
  );

  const handleTheirLanguageSelect = useCallback(
    (lang: Language) => {
      setTheirLanguage(lang.code);
      updateUserProfile({ lastTheirLanguage: lang.code }).catch(() => { });
      navigation.navigate('VoiceVerification', { languageCode: lang.code, onVerified: () => { } });
    },
    [navigation, updateUserProfile],
  );

  const swapLanguages = () => {
    setMyLanguage(theirLanguage);
    setTheirLanguage(myLanguage);
  };

  const startFaceToFace = async () => {
    if (!user || !myLanguage || !theirLanguage) return;
    setStarting(true);
    try {
      const conversationId = await createFaceToFaceConversation(user.uid, myLanguage, theirLanguage);
      navigation.navigate(Routes.FaceToFace, { conversationId, langA: myLanguage, langB: theirLanguage });
    } catch (err) {
      console.error('Failed to create face-to-face conversation:', err);
    } finally {
      setStarting(false);
    }
  };

  const startNewConversation = async () => {
    if (!user) return;
    setStarting(true);
    try {
      const lang = myLanguage || 'en';
      const { conversationId, inviteCode } = await createConversation(user.uid, lang, theirLanguage || undefined);
      navigation.navigate(Routes.Waiting, { conversationId, inviteCode, myLanguage: lang });
    } catch (err) {
      console.error('Failed to create conversation:', err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 80 }]}>
      {/* Full-screen background map */}
      <Image
        source={require('../../../assets/home.png')}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '30%', objectFit: 'cover' }]}
        resizeMode="cover"
      />

      {/* Overlay — dark in dark mode, light-transparent in light mode so bg image shows */}
      <View style={[styles.overlay, { backgroundColor: resolvedTheme === 'dark' ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.40)' }]} />

      {/* Header — top 30% of screen */}
      <View style={[styles.headerArea, { height: SCREEN_HEIGHT * 0.30, paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity
            style={[
              styles.avatar,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
                borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)',
              },
            ]}
            onPress={() => navigation.navigate(Routes.Account)}
          >
            <Ionicons name="person" size={20} color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Glassmorphism language card */}
      <View style={styles.cardWrap}>
        <View style={[styles.glassCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.72)', borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)' }]}>
          {/* My language */}
          <Text style={[styles.cardLabel, { color: colors.text }]}>Select Your Language</Text>
          <TouchableOpacity
            style={[
              styles.pickerRow,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.10)',
              },
            ]}
            onPress={() => setShowMyLangPicker(true)}
            activeOpacity={0.8}
          >
            {myLang ? (
              <FlagEmoji countryCode={myLang.countryCode} size={20} />
            ) : (
              <View style={styles.sparkleBox}>
                <Ionicons name="sparkles" size={14} color={iconColor} />
              </View>
            )}
            <Text style={[styles.pickerText, { color: colors.text }, !myLang && { color: colors.textSecondary }]}>
              {myLang ? myLang.name : 'Select Language'}
            </Text>
            <Ionicons name="chevron-down" size={15} color={iconColorMuted} />
          </TouchableOpacity>

          {/* Swap — line runs full width, button masks the centre */}
          <View style={styles.swapRow}>
            <View style={[styles.swapLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
            <TouchableOpacity
              style={[
                styles.swapBtn,
                {
                  backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)',
                  borderColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.15)',
                },
              ]}
              onPress={swapLanguages}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-vertical" size={15} color={iconColor} />
            </TouchableOpacity>
            <View style={[styles.swapLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
          </View>

          {/* Their language */}
          <Text style={[styles.cardLabel, { color: colors.text }]}>Select Next Person's Language</Text>
          <TouchableOpacity
            style={[
              styles.pickerRow,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
                borderColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.10)',
              },
            ]}
            onPress={() => setShowTheirLangPicker(true)}
            activeOpacity={0.8}
          >
            {theirLang ? (
              <FlagEmoji countryCode={theirLang.countryCode} size={20} />
            ) : (
              <View style={styles.sparkleBox}>
                <Ionicons name="sparkles" size={14} color={iconColor} />
              </View>
            )}
            <Text style={[styles.pickerText, { color: colors.text }, !theirLang && { color: colors.textSecondary }]}>
              {theirLang ? theirLang.name : 'Select Language'}
            </Text>
            <Ionicons name="chevron-down" size={15} color={iconColorMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Action area — flex, vertically centered between card and ad */}
      <View style={styles.actionArea}>
        {!showActions ? (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => setShowActions(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="mic-outline" size={18} color="#FFFFFF" />
            <Text style={styles.startBtnText}>Start Conversation</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Row of 3 primary actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: '#007AFF' }]}
                onPress={startNewConversation}
                activeOpacity={0.85}
                disabled={starting}
              >
                <Ionicons name="add-circle-outline" size={22} color="#FFFFFF" />
                <Text style={styles.actionChipText}>{starting ? '...' : 'New'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionChip,
                  { backgroundColor: '#34C759' },
                  (!myLanguage || !theirLanguage || starting) && styles.startBtnDisabled,
                ]}
                onPress={startFaceToFace}
                activeOpacity={0.85}
                disabled={!myLanguage || !theirLanguage || starting}
              >
                <Ionicons name="people" size={22} color="#FFFFFF" />
                <Text style={styles.actionChipText}>Talk</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionChip,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.04)',
                    borderWidth: 1.5,
                    borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)',
                  },
                ]}
                onPress={() => navigation.navigate(Routes.FindPerson)}
                activeOpacity={0.85}
              >
                <Ionicons name="search-outline" size={22} color={iconColor} />
                <Text style={[styles.actionChipText, { color: iconColor }]}>Find</Text>
              </TouchableOpacity>
            </View>

            {/* Join action — wider, below the row */}
            <TouchableOpacity
              style={[
                styles.actionChipWide,
                {
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
                },
              ]}
              onPress={() => navigation.navigate(Routes.Join)}
              activeOpacity={0.85}
            >
              <Ionicons name="enter-outline" size={18} color={iconColor} />
              <Text style={[styles.actionChipWideText, { color: iconColor }]}>Join with Invite Code</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowActions(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: iconColorMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Recent conversations — hidden while action buttons are expanded to avoid layout overflow */}
      {recentConvos.length > 0 && !showActions && (
        <View style={styles.recentSection}>
          <Text style={[styles.recentLabel, { color: colors.textSecondary }]}>Recent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentList}>
            {recentConvos.map((convo) => {
              const otherUid = convo.participants.find((p) => p !== user?.uid);
              const myLangCode = (user?.uid && convo.participantLanguages[user.uid]) || 'en';
              const otherLangCode = (otherUid && convo.participantLanguages[otherUid]) || convo.expectedOtherLanguage || 'en';
              const myL = getLanguageByCode(myLangCode);
              const otherL = getLanguageByCode(otherLangCode);
              const isWaiting = convo.status === 'waiting';
              return (
                <TouchableOpacity
                  key={convo.id}
                  style={[
                    styles.recentChip,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : colors.surface,
                      borderColor: isDark ? 'rgba(255,255,255,0.20)' : colors.border,
                    },
                    isWaiting && styles.recentChipWaiting,
                    convo.mode === 'faceToFace' && styles.recentChipFaceToFace,
                  ]}
                  onPress={() => {
                    if (convo.mode === 'faceToFace') {
                      navigation.navigate(Routes.FaceToFace, {
                        conversationId: convo.id,
                        langA: myLangCode,
                        langB: otherLangCode,
                      });
                    } else {
                      navigation.navigate(
                        isWaiting ? Routes.Waiting : Routes.Conversation,
                        isWaiting
                          ? { conversationId: convo.id, inviteCode: convo.inviteCode, myLanguage: myLangCode }
                          : { conversationId: convo.id },
                      );
                    }
                  }}
                >
                  <FlagEmoji countryCode={myL?.countryCode ?? 'US'} size={15} />
                  <Ionicons
                    name={convo.mode === 'faceToFace' ? 'people' : isWaiting ? 'time-outline' : 'arrow-forward'}
                    size={11}
                    color={iconColorMuted}
                  />
                  <FlagEmoji countryCode={otherL?.countryCode ?? 'US'} size={15} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Ad banner — pinned above tab bar */}
      <View style={[styles.adBanner, { backgroundColor: isDark ? 'rgba(37, 37, 37, 0.5)' : colors.surface, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border }]}>
        <Text style={[styles.adText, { color: colors.textSecondary }]}>Test Ad</Text>
      </View>

      <LanguagePickerModal
        visible={showMyLangPicker}
        onClose={() => setShowMyLangPicker(false)}
        onSelect={handleMyLanguageSelect}
        selectedCode={myLanguage}
        title="Select your language"
      />
      <LanguagePickerModal
        visible={showTheirLangPicker}
        onClose={() => setShowTheirLangPicker(false)}
        onSelect={handleTheirLanguageSelect}
        selectedCode={theirLanguage}
        title="Select next person's language"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  /* ── Header ── */
  headerArea: {
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { height: 32, width: 120 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  /* ── Glass card ── */
  cardWrap: {
    paddingHorizontal: 20,
  },
  glassCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 20,
  },
  sparkleBox: {
    width: 32,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  pickerPlaceholder: {
    opacity: 0.5,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Action area ── */
  actionArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },

  startBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '84%',
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  startBtnDisabled: { opacity: 0.45 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '92%',
  },
  actionChip: {
    flex: 1,
    height: 72,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  actionChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionChipWide: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    width: '92%',
    gap: 8,
  },
  actionChipWideText: {
    fontSize: 14,
    fontWeight: '600',
  },

  cancelBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  cancelText: { fontSize: 13, fontWeight: '500' },

  /* ── Recent conversations ── */
  recentSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  recentList: {
    gap: 8,
    flexDirection: 'row',
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  recentChipWaiting: {
    borderColor: 'rgba(255,165,0,0.5)',
    backgroundColor: 'rgba(255,165,0,0.15)',
  },
  recentChipFaceToFace: {
    borderColor: 'rgba(52,199,89,0.5)',
    backgroundColor: 'rgba(52,199,89,0.15)',
  },

  /* ── Ad banner ── */
  adBanner: {
    height: 60,
    borderTopWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  adText: { fontSize: 14, fontWeight: '700' },
});
