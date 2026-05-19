import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getLanguageByCode } from '../../constants/languages';
import { Routes } from '../../constants/routes';
import {
  isModelDownloaded,
  isModelLoaded,
  downloadModel,
  loadModel,
  deleteModel,
  MODEL_SIZE_MB,
} from '../../services/local-llm';

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
  const { theme, colors } = useTheme();
  const preferredLangName = getLanguageByCode(user?.preferredLanguage || '')?.name || user?.preferredLanguage || 'Not set';
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // AI model state
  const [modelDownloaded, setModelDownloaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [modelError, setModelError] = useState('');

  useEffect(() => {
    isModelDownloaded().then(setModelDownloaded);
    setModelLoaded(isModelLoaded());
  }, []);

  const handleDownloadModel = async () => {
    setDownloading(true);
    setModelError('');
    try {
      await downloadModel((p) => setDownloadProgress(p));
      setModelDownloaded(true);
      await loadModel();
      setModelLoaded(isModelLoaded());
    } catch (e: any) {
      setModelError('Download failed. Check connection and try again.');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleDeleteModel = async () => {
    await deleteModel();
    setModelDownloaded(false);
    setModelLoaded(false);
  };

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
        { label: 'Theme', iconName: 'sunny-outline', value: theme === 'dark' ? 'Dark' : 'Light', screen: Routes.ChangeTheme },
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
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.surface }]}>
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

        {/* AI Translation Model */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ON-DEVICE SPELL CHECK</Text>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.modelHeader}>
              <View style={styles.modelInfo}>
                <Text style={[styles.modelName, { color: colors.text }]}>Qwen 2.5 · 0.5B</Text>
                <Text style={[styles.modelMeta, { color: colors.textSecondary }]}>
                  On-device spell check · {MODEL_SIZE_MB} MB
                </Text>
              </View>
              <View style={[
                styles.modelBadge,
                { backgroundColor: modelLoaded ? '#34C75920' : modelDownloaded ? '#007AFF20' : colors.surface },
              ]}>
                <Text style={[
                  styles.modelBadgeText,
                  { color: modelLoaded ? '#34C759' : modelDownloaded ? '#007AFF' : colors.textSecondary },
                ]}>
                  {modelLoaded ? 'Active' : modelDownloaded ? 'Ready' : 'Not installed'}
                </Text>
              </View>
            </View>

            {modelError ? (
              <Text style={styles.modelError}>{modelError}</Text>
            ) : null}

            {downloading ? (
              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
                  <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
                </View>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                  {Math.round(downloadProgress * 100)}% · {Math.round(downloadProgress * MODEL_SIZE_MB)} / {MODEL_SIZE_MB} MB
                </Text>
              </View>
            ) : modelDownloaded ? (
              <View style={styles.modelActions}>
                {!modelLoaded && (
                  <TouchableOpacity
                    style={[styles.modelBtn, { backgroundColor: '#007AFF' }]}
                    onPress={async () => { await loadModel(); setModelLoaded(isModelLoaded()); }}
                  >
                    <Text style={styles.modelBtnText}>Load into memory</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.modelBtn, { backgroundColor: colors.surface }]}
                  onPress={handleDeleteModel}
                >
                  <Text style={[styles.modelBtnText, { color: '#FF3B30' }]}>Remove model</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.modelBtn, { backgroundColor: '#007AFF', marginTop: 12 }]}
                onPress={handleDownloadModel}
              >
                <Ionicons name="download-outline" size={15} color="#FFF" />
                <Text style={styles.modelBtnText}>Download ({MODEL_SIZE_MB} MB)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {section.title}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
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
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 14,
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
    borderRadius: 14,
    overflow: 'hidden',
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
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  modelInfo: { flex: 1 },
  modelName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  modelMeta: { fontSize: 12 },
  modelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modelBadgeText: { fontSize: 12, fontWeight: '600' },
  modelError: { color: '#FF3B30', fontSize: 13, paddingHorizontal: 16, paddingBottom: 10 },
  progressWrap: { paddingHorizontal: 16, paddingBottom: 14, gap: 6 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  progressLabel: { fontSize: 12 },
  modelActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  modelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modelBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
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
