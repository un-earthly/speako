import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
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
  const { firebaseUser, changePassword, resetPassword } = useAuth();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const hasPasswordProvider = firebaseUser?.providerData?.some((p) => p.providerId === 'password') ?? false;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async () => {
    if (hasPasswordProvider) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        setError('Please fill in all fields');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
        return;
      }
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      setError('');
      setLoading(true);
      try {
        await changePassword(oldPassword, newPassword);
        showToast('Password changed successfully', 'success');
        navigation.goBack();
      } catch (err: any) {
        const msg = err.code === 'auth/wrong-password'
          ? 'Current password is incorrect'
          : err.message || 'Failed to change password';
        setError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      // Google user — send reset link
      setError('');
      setLoading(true);
      try {
        if (firebaseUser?.email) {
          await resetPassword(firebaseUser.email);
          showToast('Password reset link sent to your email', 'success');
          navigation.goBack();
        } else {
          setError('No email found on account');
          showToast('No email found on account', 'error');
        }
      } catch (err: any) {
        const msg = err.message || 'Failed to send reset link';
        setError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {hasPasswordProvider ? 'Change Password' : 'Set Password'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!hasPasswordProvider && (
          <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={22} color="#007AFF" />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              You signed in with Google. We will send a password reset link to your email so you can set a password and log in with email too.
            </Text>
          </View>
        )}

        {hasPasswordProvider && (
          <SecureInput
            label="Current Password"
            value={oldPassword}
            onChangeText={setOldPassword}
            colors={colors}
          />
        )}

        <SecureInput
          label={hasPasswordProvider ? 'New Password' : 'Create Password'}
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
        <Button
          title={hasPasswordProvider ? 'Change Password' : 'Send Reset Link'}
          onPress={handleChange}
          loading={loading}
        />
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: { color: '#FF3B30', marginTop: 4, fontSize: 13 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
