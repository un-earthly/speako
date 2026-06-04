import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Switch, Share, Clipboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getLanguageByCode } from '../../constants/languages';
import { Routes } from '../../constants/routes';
import { useRewardedAd } from '../../hooks/useRewardedAd';
import { RewardModal } from '../../components/common/RewardModal';
import { rewardAdWatch, POINTS, unlockAIConversation } from '../../services/rewards';
import { sendPushNotification } from '../../services/notifications';
import { AdBanner } from '../../components/common/AdBanner';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  label: string;
  iconName: IoniconName;
  value?: string;
  screen: string;
  danger?: boolean;
}

interface Section {
  title: string;
  items: MenuItem[];
}

export function AccountScreen({ navigation }: any) {
  const { user, logout, updateUserProfile } = useAuth();
  const { theme, resolvedTheme, colors, isDark } = useTheme();
  const { showToast } = useToast();
  const referralCode = user?.referralCode || '';
  const referralCount = user?.referralCount ?? 0;
  const referralPoints = user?.referralPointsEarned ?? 0;
  const preferredLangName = getLanguageByCode(user?.preferredLanguage || '')?.name || user?.preferredLanguage || 'Not set';
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardInfo, setRewardInfo] = useState({ points: POINTS.WATCH_AD_BASE, streak: 1 });
  const { showAd: showRewardedAd } = useRewardedAd();
  const aiUnlocked = user?.aiConversationUnlocked ?? false;
  const aiEnabled = user?.aiConversationEnabled ?? false;

  const sections: Section[] = [
    {
      title: 'ACCOUNT INFORMATION',
      items: [
        { label: 'Personal Information', iconName: 'person-circle-outline', screen: Routes.PersonalInfo },
      ],
    },
    {
      title: 'ACCOUNT SECURITY',
      items: [
        { label: 'Security & Biometrics', iconName: 'finger-print-outline', screen: Routes.BiometricSecurity },
      ],
    },
    {
      title: 'APPLICATION SETTING',
      items: [
        { label: 'Preferred Language', iconName: 'language-outline', value: preferredLangName, screen: Routes.ChangeLanguage },
        { label: 'Theme', iconName: 'sunny-outline', value: theme === 'system' ? 'System' : (resolvedTheme === 'dark' ? 'Dark' : 'Light'), screen: Routes.ChangeTheme },
      ],
    },
    {
      title: 'OTHER',
      items: [
        { label: 'Watch Ad for Points', iconName: 'videocam-outline', screen: '', danger: false },
        { label: 'Logout', iconName: 'exit-outline', screen: '', danger: true },
      ],
    },
  ];

  const handleItemPress = (item: MenuItem) => {
    if (item.label === 'Watch Ad for Points') {
      showRewardedAd(async () => {
        if (user) {
          const result = await rewardAdWatch(user.uid);
          setRewardInfo({ points: result.pointsEarned, streak: result.streak });
          setShowRewardModal(true);
        }
      });
      return;
    }
    if (item.danger) {
      setShowLogoutModal(true);
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, {
          backgroundColor: colors.card,
          borderColor: colors.border,
        }]}>
          <View style={[styles.avatarCircle, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#E5E5EA',
          }]}>
            <Ionicons name="person" size={28} color={colors.textSecondary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {user?.displayName || 'User'}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
          <View style={[styles.pointsBadge, { backgroundColor: isDark ? 'rgba(255,149,0,0.20)' : '#FFF8E1' }]}>
            <Ionicons name="flash" size={14} color="#FF9500" />
            <Text style={styles.pointsBadgeText}>{user?.points ?? 0}</Text>
          </View>
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <View style={[styles.card, {
              backgroundColor: colors.card,
              borderColor: colors.border,
            }]}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < section.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={item.iconName}
                    size={20}
                    color={item.danger ? '#FF3B30' : colors.textSecondary}
                    style={styles.rowIcon}
                  />
                  <Text style={[styles.rowLabel, { color: item.danger ? '#FF3B30' : colors.text }]}>
                    {item.label}
                  </Text>
                  {item.value ? (
                    <View style={[styles.valueBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#F2F2F7' }]}>
                      <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                        {item.value}
                      </Text>
                    </View>
                  ) : null}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={item.danger ? '#FF3B30' : colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Refer & Earn */}
        {referralCode ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              REFER & EARN
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Ionicons name="people-outline" size={20} color="#34C759" style={styles.rowIcon} />
                  <View>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>
                      Invite Friends
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      {referralCount} invited · {referralPoints} pts earned
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.referralCodeRow, { borderTopColor: colors.border }]}>
                <View style={[styles.referralCodeBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F2F2F7' }]}>
                  <Text style={[styles.referralCodeText, { color: colors.text }]}>{referralCode}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.referralAction, { backgroundColor: '#007AFF' }]}
                  onPress={() => {
                    Clipboard.setString(referralCode);
                    showToast('Referral code copied', 'success');
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.referralAction, { backgroundColor: '#34C759' }]}
                  onPress={() => {
                    Share.share({
                      message: `Join me on Speako! Use my referral code ${referralCode} to get ${POINTS.REFERRAL_WELCOME} bonus points. Download the app here: https://speako.app`,
                    });
                  }}
                >
                  <Ionicons name="share-outline" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* AI Conversation Mode */}
        {/* <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            AI FEATURES
          </Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons
                  name="sparkles"
                  size={20}
                  color={aiUnlocked ? '#007AFF' : colors.textSecondary}
                  style={styles.rowIcon}
                />
                <View>
                  <Text style={[styles.rowLabel, { color: aiUnlocked ? colors.text : colors.textSecondary }]}>
                    AI Conversation Mode
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {aiUnlocked
                      ? (aiEnabled ? 'AI-enhanced replies active' : 'Tap to enable AI suggestions')
                      : 'Watch an ad to unlock'}
                  </Text>
                </View>
              </View>
              {aiUnlocked ? (
                <Switch
                  value={aiEnabled}
                  onValueChange={(v) => updateUserProfile({ aiConversationEnabled: v })}
                  trackColor={{ false: '#C7C7CC', true: '#007AFF' }}
                  thumbColor="#FFF"
                  ios_backgroundColor="#C7C7CC"
                />
              ) : (
                <TouchableOpacity
                  style={styles.unlockBtn}
                  onPress={() => {
                    showRewardedAd(async () => {
                      if (user) {
                        await unlockAIConversation(user.uid);
                        await updateUserProfile({ aiConversationEnabled: true });
                      }
                    });
                  }}
                >
                  <Ionicons name="videocam-outline" size={14} color="#FFF" />
                  <Text style={styles.unlockBtnText}>Watch Ad</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View> */}

      </ScrollView>

      <View style={{ paddingBottom: insets.bottom + 72 }}>
        <AdBanner />
      </View>

      <RewardModal
        visible={showRewardModal}
        points={rewardInfo.points}
        streak={rewardInfo.streak}
        message="Thanks for supporting Speako!"
        onClose={() => setShowRewardModal(false)}
      />

      {/* Logout confirm modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Are you sure you want to leave?</Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              You must log in again if you want to use this application.
            </Text>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Log Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowLogoutModal(false)}>
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>No, Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
  },
  header: {
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pointsBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FF9500',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  rowIcon: {
    width: 22,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 4,
  },
  valueText: {
    fontSize: 13,
    fontWeight: '400',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  logoutBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C7C7CC',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  unlockBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  referralCodeBox: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  referralCodeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  referralAction: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
