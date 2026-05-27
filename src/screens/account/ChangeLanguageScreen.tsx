import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LANGUAGES } from '../../constants/languages';

export function ChangeLanguageScreen({ navigation }: any) {
  const { user, updateUserProfile } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currentLang = user?.preferredLanguage || 'en';

  const selectLanguage = async (code: string) => {
    await updateUserProfile({ preferredLanguage: code });
    navigation.goBack();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Change Language</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.list}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.item, { borderBottomColor: colors.border }]}
            onPress={() => selectLanguage(lang.code)}
          >
            <FlagEmoji countryCode={lang.countryCode} size={22} />
            <Text style={[styles.langName, { color: colors.text }]}>{lang.name}</Text>
            {currentLang === lang.code && (
              <Ionicons name="checkmark" size={20} color="#007AFF" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  list: { paddingHorizontal: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  langName: { flex: 1, fontSize: 16 },
});
