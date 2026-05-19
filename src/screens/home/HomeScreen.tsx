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
import { createConversation, subscribeToConversations, type Conversation } from '../../services/firestore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function HomeScreen({ navigation }: any) {
  const { user, updateUserProfile } = useAuth();
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';
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
    },
    [updateUserProfile],
  );

  const swapLanguages = () => {
    setMyLanguage(theirLanguage);
    setTheirLanguage(myLanguage);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Full-screen background map */}
      <Image
        source={require('../../../assets/home.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Overlay — dark in dark mode, light-white in light mode */}
      <View style={[styles.overlay, { backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.72)' }]} />

      {/* Header — top 30% of screen */}
      <View style={[styles.headerArea, { height: SCREEN_HEIGHT * 0.30, paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate(Routes.Account)}
          >
            <Ionicons name="person" size={20} color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Glassmorphism language card */}
      <View style={styles.cardWrap}>
        <View style={[styles.glassCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}>
          {/* My language */}
          <Text style={[styles.cardLabel, { color: colors.text }]}>Select Your Language</Text>
          <TouchableOpacity
            style={styles.pickerRow}
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
            <TouchableOpacity style={styles.swapBtn} onPress={swapLanguages} activeOpacity={0.7}>
              <Ionicons name="swap-vertical" size={15} color={iconColor} />
            </TouchableOpacity>
            <View style={[styles.swapLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
          </View>

          {/* Their language */}
          <Text style={[styles.cardLabel, { color: colors.text }]}>Select Next Person's Language</Text>
          <TouchableOpacity
            style={styles.pickerRow}
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
            <TouchableOpacity
              style={[styles.startBtn, starting && styles.startBtnDisabled]}
              onPress={startNewConversation}
              activeOpacity={0.85}
              disabled={starting}
            >
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.startBtnText}>{starting ? 'Creating...' : 'New Conversation'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate(Routes.FindPerson)}
              activeOpacity={0.85}
            >
              <Ionicons name="search-outline" size={18} color="#FFFFFF" />
              <Text style={styles.secondaryBtnText}>Find Someone</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate(Routes.Join)}
              activeOpacity={0.85}
            >
              <Ionicons name="enter-outline" size={18} color="#FFFFFF" />
              <Text style={styles.secondaryBtnText}>Join with Invite Code</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowActions(false)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: iconColorMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Recent conversations */}
      {recentConvos.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={[styles.recentLabel, { color: colors.text }]}>Recent</Text>
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
                  style={[styles.recentChip, isWaiting && styles.recentChipWaiting]}
                  onPress={() =>
                    navigation.navigate(
                      isWaiting ? Routes.Waiting : Routes.Conversation,
                      isWaiting
                        ? { conversationId: convo.id, inviteCode: convo.inviteCode, myLanguage: myLangCode }
                        : { conversationId: convo.id },
                    )
                  }
                >
                  <FlagEmoji countryCode={myL?.countryCode ?? 'US'} size={15} />
                  <Ionicons name={isWaiting ? 'time-outline' : 'arrow-forward'} size={11} color={iconColorMuted} />
                  <FlagEmoji countryCode={otherL?.countryCode ?? 'US'} size={15} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Ad banner — pinned above tab bar */}
      <View style={styles.adBanner}>
        <Text style={styles.adText}>Test Ad</Text>
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  /* ── Glass card ── */
  cardWrap: {
    paddingHorizontal: 20,
  },
  glassCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
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
    backgroundColor: 'rgba(0,0,0,0.18)',
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
  startBtnDisabled: { opacity: 0.7 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  secondaryBtn: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '84%',
    gap: 8,
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  cancelBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  cancelText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500' },

  /* ── Recent conversations ── */
  recentSection: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  recentLabel: {
    color: 'rgba(255,255,255,0.5)',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  recentChipWaiting: {
    borderColor: 'rgba(255,165,0,0.5)',
    backgroundColor: 'rgba(255,165,0,0.15)',
  },

  /* ── Ad banner ── */
  adBanner: {
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700' },
});
