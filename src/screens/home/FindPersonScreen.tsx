import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlagEmoji } from '../../components/common/FlagEmoji';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getLanguageByCode, type Language } from '../../constants/languages';
import { LanguagePickerModal } from '../../components/common/LanguagePickerModal';
import {
  searchUserByEmail,
  searchUserByPhone,
  createDirectConversation,
  type PublicUserProfile,
} from '../../services/firestore';
import { Routes } from '../../constants/routes';

type SearchMode = 'email' | 'phone';

export function FindPersonScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<SearchMode>('email');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [foundUser, setFoundUser] = useState<PublicUserProfile | null>(null);
  const [selectedOtherLanguage, setSelectedOtherLanguage] = useState('en');
  const [showOtherLangPicker, setShowOtherLangPicker] = useState(false);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(false);
    setFoundUser(null);
    try {
      const result =
        mode === 'email' ? await searchUserByEmail(q) : await searchUserByPhone(q);
      setFoundUser(result);
      setSelectedOtherLanguage(result?.preferredLanguage || 'en');
      setSearched(true);
    } catch (err) {
      Alert.alert('Search failed', 'Something went wrong. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleStartChat = async () => {
    if (!user || !foundUser) return;
    if (foundUser.uid === user.uid) {
      Alert.alert("That's you!", 'You cannot start a conversation with yourself.');
      return;
    }
    setStarting(true);
    try {
      const myLanguage = user.preferredLanguage || 'en';
      const conversationId = await createDirectConversation(
        user.uid,
        myLanguage,
        foundUser.uid,
        selectedOtherLanguage,
      );
      navigation.navigate(Routes.Conversation, { conversationId });
    } catch {
      Alert.alert('Error', 'Could not start the conversation. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const otherLang = getLanguageByCode(selectedOtherLanguage);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Find Someone</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Mode toggle */}
          <View style={[styles.modeToggle, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'email' && { backgroundColor: '#007AFF' }]}
              onPress={() => { setMode('email'); setQuery(''); setSearched(false); setFoundUser(null); }}
            >
              <Ionicons name="mail-outline" size={16} color={mode === 'email' ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.modeBtnText, { color: mode === 'email' ? '#FFF' : colors.textSecondary }]}>
                Email
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'phone' && { backgroundColor: '#007AFF' }]}
              onPress={() => { setMode('phone'); setQuery(''); setSearched(false); setFoundUser(null); }}
            >
              <Ionicons name="call-outline" size={16} color={mode === 'phone' ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.modeBtnText, { color: mode === 'phone' ? '#FFF' : colors.textSecondary }]}>
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={[styles.inputRow, { backgroundColor: colors.surface }]}>
            <Ionicons
              name={mode === 'email' ? 'mail-outline' : 'call-outline'}
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={query}
              onChangeText={(t) => { setQuery(t); setSearched(false); setFoundUser(null); }}
              placeholder={mode === 'email' ? 'Enter email address' : 'Enter phone number'}
              placeholderTextColor={colors.textSecondary}
              keyboardType={mode === 'email' ? 'email-address' : 'phone-pad'}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setSearched(false); setFoundUser(null); }}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {mode === 'phone' && (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Include country code (e.g. +8801712345678)
            </Text>
          )}

          {/* Search button */}
          <TouchableOpacity
            style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!query.trim() || searching}
          >
            {searching ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#FFF" />
                <Text style={styles.searchBtnText}>Search</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Result */}
          {searched && !foundUser && !searching && (
            <View style={[styles.notFound, { backgroundColor: colors.surface }]}>
              <Ionicons name="person-outline" size={36} color={colors.textSecondary} />
              <Text style={[styles.notFoundTitle, { color: colors.text }]}>No one found</Text>
              <Text style={[styles.notFoundSub, { color: colors.textSecondary }]}>
                Either no account matches this {mode}, or that person hasn't enabled discovery in their profile.
              </Text>
            </View>
          )}

          {foundUser && (
            <View style={[styles.resultCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.resultAvatar, { backgroundColor: colors.surfaceHighlight }]}>
                <Ionicons name="person" size={28} color={colors.text} />
              </View>
              <View style={styles.resultInfo}>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {foundUser.displayName || 'Unnamed User'}
                </Text>
                <TouchableOpacity
                  style={styles.resultLang}
                  onPress={() => setShowOtherLangPicker(true)}
                  activeOpacity={0.7}
                >
                  {otherLang && <FlagEmoji countryCode={otherLang.countryCode} size={14} />}
                  <Text style={[styles.resultLangText, { color: colors.textSecondary }]}>
                    {otherLang?.name || selectedOtherLanguage}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.chatBtn, starting && { opacity: 0.6 }]}
                onPress={handleStartChat}
                disabled={starting}
              >
                {starting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="chatbubble-outline" size={16} color="#FFF" />
                    <Text style={styles.chatBtnText}>Chat</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      <LanguagePickerModal
        visible={showOtherLangPicker}
        onClose={() => setShowOtherLangPicker(false)}
        onSelect={(lang: Language) => setSelectedOtherLanguage(lang.code)}
        selectedCode={selectedOtherLanguage}
        title="Their language"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 14 },

  modeToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnText: { fontSize: 14, fontWeight: '600' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 16 },

  hint: { fontSize: 12, marginTop: -6 },

  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 28,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBtnDisabled: { opacity: 0.45 },
  searchBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },

  notFound: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  notFoundTitle: { fontSize: 17, fontWeight: '700' },
  notFoundSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
  },
  resultAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: { flex: 1, gap: 4 },
  resultName: { fontSize: 16, fontWeight: '700' },
  resultLang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultLangText: { fontSize: 13 },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chatBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
