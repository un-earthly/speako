import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getLanguageByCode } from '../../constants/languages';
import { Routes } from '../../constants/routes';

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
  const { user, logout } = useAuth();
  const { theme, resolvedTheme, colors, isDark } = useTheme();
  const preferredLangName = getLanguageByCode(user?.preferredLanguage || '')?.name || user?.preferredLanguage || 'Not set';
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
        { label: 'Change Password', iconName: 'lock-closed-outline', screen: Routes.ChangePassword },
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
        { label: 'Logout', iconName: 'exit-outline', screen: '', danger: true },
      ],
    },
  ];

  const handleItemPress = (item: MenuItem) => {
    if (item.danger) {
      setShowLogoutModal(true);
    } else {
      navigation.navigate(item.screen);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Account</Text>
        </View>

        {/* Profile card */}
        <View style={[styles.profileCard, {
          backgroundColor: isDark ? colors.glass : colors.card,
          borderColor: isDark ? colors.glassBorder : colors.border,
        }]}>
          <View style={[styles.avatarCircle, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : colors.surfaceHighlight,
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
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <View style={[styles.card, {
              backgroundColor: isDark ? colors.glass : colors.card,
              borderColor: isDark ? colors.glassBorder : colors.border,
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
                    <View style={[styles.valueBadge, { backgroundColor: colors.surface }]}>
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

        <View style={{ height: 32 }} />
      </ScrollView>

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
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    paddingVertical: 3,
    borderRadius: 6,
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
});
