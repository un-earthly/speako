import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';

function FloatingInput({
  label,
  value,
  onChangeText,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  colors: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        floatingStyles.container,
        {
          borderColor: focused ? '#007AFF' : colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Text style={[floatingStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[floatingStyles.input, { color: focused ? '#007AFF' : colors.text }]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.textSecondary}
      />
    </View>
  );
}

const floatingStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    padding: 0,
  },
});

export function PersonalInfoScreen({ navigation }: any) {
  const { user, updateUserProfile } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState(user?.displayName?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.displayName?.split(' ').slice(1).join(' ') || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [isDiscoverable, setIsDiscoverable] = useState(user?.isDiscoverable ?? true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    await updateUserProfile({
      displayName: `${firstName} ${lastName}`.trim(),
      phone: phone.trim() || null,
      isDiscoverable,
    });
    setLoading(false);
    navigation.goBack();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Personal Information</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Email */}
        <View style={styles.emailSection}>
          <Text style={[styles.emailLabel, { color: colors.textSecondary }]}>Your Email</Text>
          <Text style={[styles.emailValue, { color: colors.text }]}>{user?.email}</Text>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        </View>

        {/* Profile photo */}
        <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>Profile Photo</Text>
        <TouchableOpacity onPress={pickPhoto} style={styles.avatarWrapper} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
              <Ionicons name="person" size={32} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={11} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Inputs */}
        <View style={styles.fields}>
          <FloatingInput
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            colors={colors}
          />
          <FloatingInput
            label="Last Name (optional)"
            value={lastName}
            onChangeText={setLastName}
            colors={colors}
          />
          <FloatingInput
            label="Phone Number (optional, for discovery)"
            value={phone}
            onChangeText={setPhone}
            colors={colors}
          />
        </View>

        {/* Discovery toggle */}
        <View style={[styles.discoverRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.discoverText}>
            <Text style={[styles.discoverTitle, { color: colors.text }]}>Make me discoverable</Text>
            <Text style={[styles.discoverSub, { color: colors.textSecondary }]}>
              Allow others to find your profile by email or phone
            </Text>
          </View>
          <Switch
            value={isDiscoverable}
            onValueChange={setIsDiscoverable}
            trackColor={{ false: colors.border, true: '#007AFF' }}
            thumbColor="#FFF"
          />
        </View>
      </ScrollView>

      {/* Fixed save button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="Save Information" onPress={handleSave} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 32,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  emailSection: {
    marginBottom: 24,
  },
  emailLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  emailValue: {
    fontSize: 16,
    marginBottom: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  photoLabel: {
    fontSize: 13,
    marginBottom: 12,
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    marginBottom: 28,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fields: {
    gap: 0,
  },
  discoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  discoverText: { flex: 1, gap: 2 },
  discoverTitle: { fontSize: 15, fontWeight: '600' },
  discoverSub: { fontSize: 12, lineHeight: 17 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
