import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from './FlagEmoji';
import { useTheme } from '../../contexts/ThemeContext';
import { LANGUAGES, getLanguageByCode, type Language } from '../../constants/languages';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.78;

interface LanguagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (lang: Language) => void;
  selectedCode?: string;
  title?: string;
}

export function LanguagePickerModal({
  visible,
  onClose,
  onSelect,
  selectedCode,
  title = 'Select Your language',
}: LanguagePickerModalProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const selectedLang = selectedCode ? getLanguageByCode(selectedCode) : undefined;

  const filteredLanguages = LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(search.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (visible) {
      setSearch('');
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: MODAL_HEIGHT, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (lang: Language) => {
    onSelect(lang);
    onClose();
  };

  const renderItem = ({ item }: { item: Language }) => (
    <TouchableOpacity
      style={[styles.langItem, { borderBottomColor: colors.border }]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <FlagEmoji countryCode={item.countryCode} size={28} />
      <Text style={[styles.langName, { color: colors.text }]}>{item.name}</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.background, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handleBar}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        {/* Title */}
        <Text style={[styles.sheetTitle, { color: colors.textSecondary }]}>{title}</Text>

        {/* Selected language / trigger row */}
        <TouchableOpacity
          style={[styles.triggerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          {selectedLang ? (
            <FlagEmoji countryCode={selectedLang.countryCode} size={22} />
          ) : (
            <View style={styles.sparkleBox}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            </View>
          )}
          <Text style={[styles.triggerText, { color: selectedLang ? colors.text : colors.textSecondary }]}>
            {selectedLang ? selectedLang.name : 'Select Language'}
          </Text>
          <Ionicons name="chevron-up" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Search */}
        <View style={[styles.searchBox, { borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search language"
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filteredLanguages}
          keyExtractor={(item) => item.code}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  handleBar: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2 },

  sheetTitle: { fontSize: 14, textAlign: 'center', marginBottom: 12 },

  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    marginBottom: 16,
  },
  sparkleBox: {
    width: 40,
    height: 27,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerText: { flex: 1, fontSize: 16, fontWeight: '500' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 16, height: '100%' },

  listContent: { paddingBottom: 40 },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  langName: { flex: 1, fontSize: 16, fontWeight: '600' },
});
