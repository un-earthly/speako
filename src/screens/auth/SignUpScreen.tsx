import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Routes } from '../../constants/routes';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export function SignUpScreen({ navigation }: any) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const { sendOTP } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { promptAsync, loading: googleLoading } = useGoogleAuth();
  const insets = useSafeAreaInsets();

  const handleSignUp = async () => {
    if (!displayName.trim()) { showToast('Please enter your name', 'error'); return; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { showToast('Please enter a valid email', 'error'); return; }
    if (!password || password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    if (!agreed) { showToast('Please agree to the Terms & Conditions', 'error'); return; }

    setLoading(true);
    try {
      await sendOTP(email.trim().toLowerCase());
      navigation.navigate(Routes.OTP, {
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        password,
        mode: 'register',
      });
    } catch (err: any) {
      const code = err?.code ?? '';
      const msg = code.includes('not-found') || code.includes('unavailable')
        ? 'Service not available yet. Please try again later.'
        : err.message || 'Failed to send code. Please try again.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, paddingTop: insets.top }}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require('../../../assets/signin-banner.png')}
            style={styles.banner}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign up to start translating conversations
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Display Name"
            placeholder="Enter your name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
          <Input
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="Password"
            placeholder="Create a password (min. 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(!agreed)}>
            <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: agreed ? '#007AFF' : 'transparent' }]}>
              {agreed && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
            </View>
            <Text style={[styles.termsText, { color: colors.textSecondary }]}>
              I agree to Speako's{' '}
              <Text style={{ color: '#007AFF' }}>Terms & Conditions</Text>
            </Text>
          </TouchableOpacity>

          <Button
            title="Send Verification Code"
            onPress={handleSignUp}
            loading={false}
            disabled={loading || googleLoading}
          />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>Or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Button
            title="Continue with Google"
            variant="secondary"
            onPress={() => promptAsync()}
            loading={false}
            disabled={loading || googleLoading}
          />
        </View>

        <LoadingOverlay visible={loading || googleLoading} message="Sending code..." />

        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <Text style={{ color: colors.textSecondary }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate(Routes.Login)}>
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 28, marginTop: 20 },
  banner: { width: 160, height: 120, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  form: { width: '100%', marginTop: 8 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, marginTop: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10, marginTop: 2,
  },
  termsText: { flex: 1, fontSize: 13, lineHeight: 18 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32, marginBottom: 16 },
});
