import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Routes } from '../../constants/routes';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { useToast } from '../../contexts/ToastContext';
import { useBiometrics } from '../../hooks/useBiometrics';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');

  const { loginWithPassword, sendOTP } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { promptAsync, loading: googleLoading } = useGoogleAuth();
  const { isAvailable, isEnabled, authenticate, getBiometricLabel } = useBiometrics();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const available = await isAvailable();
      const enabled = await isEnabled();
      if (available && enabled) {
        setBiometricAvailable(true);
        setBiometricLabel(await getBiometricLabel());
      }
    })();
  }, []);

  const handleSignIn = async () => {
    if (!email.trim()) { showToast('Please enter your email', 'error'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { showToast('Please enter a valid email', 'error'); return; }
    if (!password) { showToast('Please enter your password', 'error'); return; }
    setLoading(true);
    try {
      await loginWithPassword(email.trim().toLowerCase(), password);
    } catch (err: any) {
      const code = err?.code ?? '';
      let msg = 'Sign in failed. Please try again.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        msg = 'Incorrect email or password.';
      } else if (code === 'auth/too-many-requests') {
        msg = 'Too many attempts. Please try again later.';
      } else if (err.message) {
        msg = err.message;
      }
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { showToast('Please enter your email first', 'error'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { showToast('Please enter a valid email', 'error'); return; }
    setLoading(true);
    try {
      await sendOTP(email.trim().toLowerCase());
      navigation.navigate(Routes.OTP, {
        email: email.trim().toLowerCase(),
        mode: 'forgotPassword',
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

  const handleBiometric = async () => {
    const success = await authenticate('Sign in to Speako');
    if (!success) showToast('Biometric authentication failed', 'error');
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
          <Image source={require('../../../assets/login-banner.png')} style={styles.banner} resizeMode="contain" />
          <Text style={[styles.title, { color: colors.text }]}>Welcome Back 👋</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in with your email and password
          </Text>
        </View>

        <View style={styles.form}>
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
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword} disabled={loading || googleLoading}>
            <Text style={{ color: '#007AFF', fontSize: 13, fontWeight: '500' }}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleSignIn}
            loading={false}
            disabled={loading || googleLoading}
          />

          {biometricAvailable && (
            <TouchableOpacity
              style={[styles.biometricBtn, { borderColor: colors.border }]}
              onPress={handleBiometric}
              disabled={loading || googleLoading}
            >
              <Ionicons name="finger-print-outline" size={20} color="#007AFF" />
              <Text style={[styles.biometricText, { color: colors.text }]}>
                Sign in with {biometricLabel}
              </Text>
            </TouchableOpacity>
          )}

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

        <LoadingOverlay visible={loading || googleLoading} message={loading ? 'Signing in...' : 'Connecting...'} />

        <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
          <Text style={{ color: colors.textSecondary }}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate(Routes.SignUp)}>
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 32, marginTop: 40 },
  banner: { width: 200, height: 160, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  form: { width: '100%', marginTop: 8 },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    marginTop: -4,
    paddingVertical: 4,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  biometricText: { fontSize: 15, fontWeight: '500' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 14 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
});
