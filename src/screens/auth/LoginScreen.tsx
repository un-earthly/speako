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
import { getAuthErrorMessage } from '../../utils/firebaseErrors';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');

  const { sendOTP, verifyOTP, loginWithGoogle } = useAuth();
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

  const handleSendCode = async () => {
    if (!email.trim()) { showToast('Please enter your email', 'error'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { showToast('Please enter a valid email', 'error'); return; }
    setLoading(true);
    try {
      await sendOTP(email.trim().toLowerCase());
      navigation.navigate(Routes.OTP, { email: email.trim().toLowerCase() });
    } catch (err: any) {
      showToast(err.message || 'Failed to send code. Please try again.', 'error');
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
            Enter your email and we'll send you a sign-in code
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

          <Button
            title="Send Code"
            onPress={handleSendCode}
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

        <LoadingOverlay visible={loading || googleLoading} message="Sending code..." />

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
