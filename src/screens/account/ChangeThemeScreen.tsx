import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { AdBanner } from '../../components/common/AdBanner';
import { useToast } from '../../contexts/ToastContext';

export function ChangeThemeScreen({ navigation }: any) {
  const { theme, resolvedTheme, setTheme, colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const options = [
    { key: 'system' as const, label: 'System Default', description: 'Automatically matches your device settings' },
    { key: 'light' as const, label: 'Light Mode', description: 'Standard color display with white background' },
    { key: 'dark' as const, label: 'Dark Mode', description: 'Standard color display with dark background' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Theme</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.list}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.item, { borderBottomColor: colors.border }]}
            onPress={() => {
              setTheme(option.key);
              showToast('Theme updated', 'success');
            }}
          >
            <View style={styles.textCol}>
              <Text style={[styles.label, { color: colors.text }]}>{option.label}</Text>
              <Text style={[styles.desc, { color: colors.textSecondary }]}>{option.description}</Text>
            </View>
            <View style={[styles.radio, { borderColor: theme === option.key ? '#007AFF' : colors.border }]}>
              {theme === option.key && <View style={styles.radioDot} />}
            </View>
            {option.key === 'system' && (
              <Text style={[styles.preview, { color: colors.textSecondary }]}>
                Preview: {resolvedTheme === 'dark' ? 'Dark' : 'Light'}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: insets.bottom + 8 }} />
    </ScrollView>

    <View style={{ paddingBottom: insets.bottom + 72 }}>
      <AdBanner />
    </View>
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
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  textCol: { flex: 1 },
  label: { fontSize: 16, fontWeight: '500' },
  desc: { fontSize: 13, marginTop: 4 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  preview: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
});
