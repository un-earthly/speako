import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';

function SecureInput({
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
  const [visible, setVisible] = useState(false);

  return (
    <View
      style={[
        inputStyles.container,
        {
          borderColor: focused ? '#007AFF' : colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Ionicons
        name="lock-closed-outline"
        size={18}
        color={focused ? '#007AFF' : colors.textSecondary}
        style={inputStyles.leftIcon}
      />
      <View style={inputStyles.middle}>
        <Text style={[inputStyles.label, { color: colors.textSecondary }]}>{label}</Text>
        <TextInput
          style={[inputStyles.input, { color: focused ? '#007AFF' : colors.text }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={!visible}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <TouchableOpacity onPress={() => setVisible((v) => !v)} style={inputStyles.eyeBtn}>
        <Ionicons
          name={visible ? 'eye-outline' : 'eye-off-outline'}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: 14,
    gap: 10,
  },
  leftIcon: {
    flexShrink: 0,
    marginTop: 4,
  },
  middle: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    padding: 0,
  },
  eyeBtn: {
    flexShrink: 0,
    padding: 2,
    marginTop: 4,
  },
});

export function ChangePasswordScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.goBack();
    }, 1000);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Change Password</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SecureInput
          label="Old Password"
          value={oldPassword}
          onChangeText={setOldPassword}
          colors={colors}
        />
        <SecureInput
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          colors={colors}
        />
        <SecureInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          colors={colors}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="Change Password" onPress={handleChange} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: { width: 32, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  errorText: { color: '#FF3B30', marginTop: 4, fontSize: 13 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
