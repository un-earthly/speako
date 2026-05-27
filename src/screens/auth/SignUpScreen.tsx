import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Routes } from '../../constants/routes';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export function SignUpScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const { colors } = useTheme();
  const { promptAsync, loading: googleLoading, error: googleError } = useGoogleAuth();
  const insets = useSafeAreaInsets();

  const handleSignUp = async () => {
    if (!email || !password || !displayName) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!agreed) {
      setError('Please agree to the Terms & Conditions');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email, password, displayName);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={{ fontSize: 64 }}>🗣️</Text>
          <Text style={[styles.title, { color: colors.text }]}>Join Translator Today</Text>
        </View>

        <View style={styles.form}>
          <Input label="Display Name" placeholder="Enter your name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
          <Input label="Email Address" placeholder="Enter your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Input label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry />
          <Input label="Confirm Password" placeholder="Confirm your password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          {(error || googleError) ? <Text style={styles.errorText}>{error || googleError}</Text> : null}

          <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(!agreed)}>
            <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: agreed ? '#007AFF' : 'transparent' }]}>
              {agreed && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
            </View>
            <Text style={[styles.termsText, { color: colors.textSecondary }]}>
              I agree to Translator <Text style={{ color: '#007AFF' }}>Terms & Conditions</Text> and have an account? <Text style={{ color: '#007AFF' }}>Login</Text>
            </Text>
          </TouchableOpacity>

          <Button title="Sign Up" onPress={handleSignUp} loading={loading} />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>Or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Button title="Continue with Google" variant="secondary" onPress={() => promptAsync()} loading={googleLoading} />
          <View style={{ height: 12 }} />
          <Button title="Continue with Apple" variant="secondary" onPress={() => {}} />
        </View>

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
    marginTop: 12,
  },
  form: {
    width: '100%',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
});
