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
import { AdBanner } from '../../components/common/AdBanner';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LanguagePickerModal } from '../../components/common/LanguagePickerModal';
import { getLanguageByCode, type Language } from '../../constants/languages';
import { Routes } from '../../constants/routes';
import { createConversation, createFaceToFaceConversation, subscribeToConversations, type Conversation } from '../../services/firestore';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';

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
  const [starting, setStarting] = useState(false);
  const [recentConvos, setRecentConvos] = useState<Conversation[]>([]);
  const insets = useSafeAreaInsets();
  const { showAd: showInterstitial } = useInterstitialAd();

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
    },
    [updateUserProfile],
  );

  const handleTheirLanguageSelect = useCallback(
    (lang: Language) => {
      setTheirLanguage(lang.code);
      updateUserProfile({ lastTheirLanguage: lang.code }).catch(() => { });
    },
    [updateUserProfile],
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
      await showInterstitial();
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
      await showInterstitial();
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
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.avatar,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
                  borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)',
                },
              ]}
              onPress={() => navigation.navigate(Routes.FindPerson)}
            >
              <Ionicons name="search" size={20} color={iconColor} />
            </TouchableOpacity>
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
        <TouchableOpacity
          style={[
            styles.actionChip,
            { backgroundColor: '#34C759', alignSelf: 'center', width: '84%' },
            (!myLanguage || !theirLanguage || starting) && styles.startBtnDisabled,
          ]}
          onPress={startFaceToFace}
          activeOpacity={0.85}
          disabled={!myLanguage || !theirLanguage || starting}
        >
          <Ionicons name="people" size={22} color="#FFFFFF" />
          <Text style={styles.actionChipText}>{starting ? '...' : 'Talk'}</Text>
        </TouchableOpacity>
      </View>

      {recentConvos.length > 0 && (
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
                  onPress={async () => {
                    if (convo.mode === 'faceToFace') {
                      await showInterstitial();
                      navigation.navigate(Routes.FaceToFace, {
                        conversationId: convo.id,
                        langA: myLangCode,
                        langB: otherLangCode,
                      });
                    } else {
                      await showInterstitial();
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
      <AdBanner />

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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
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

  startBtnDisabled: { opacity: 0.45 },

  actionChip: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
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
