import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Routes } from '../../constants/routes';

export function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const { resetPassword } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleSend = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Ionicons name="key" size={56} color="#007AFF" />
          <Text style={[styles.title, { color: colors.text }]}>Forgot Your Password?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the email associated with your account and we will send an email with instructions to reset your password.
          </Text>
        </View>

        <View style={styles.form}>
          {!sent ? (
            <>
              <Input label="Email Address" placeholder="Enter your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Button title="Send OTP Code" onPress={handleSend} loading={loading} />
            </>
          ) : (
            <View style={styles.successBox}>
              <Ionicons name="mail" size={56} color="#007AFF" />
              <Text style={[styles.successTitle, { color: colors.text }]}>Check Your Email</Text>
              <Text style={[styles.successText, { color: colors.textSecondary }]}>
                We have sent a password reset link to {email}
              </Text>
              <View style={{ height: 24 }} />
              <Button title="Back to Login" variant="outline" onPress={() => navigation.navigate(Routes.Login)} />
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  form: { width: '100%' },
  errorText: { color: '#FF3B30', marginBottom: 12, textAlign: 'center' },
  successBox: { alignItems: 'center', paddingVertical: 24 },
  successTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  successText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
