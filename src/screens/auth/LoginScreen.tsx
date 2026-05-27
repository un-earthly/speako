import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Routes } from '../../constants/routes';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

export function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const { colors } = useTheme();
  const { promptAsync, loading: googleLoading, error: googleError } = useGoogleAuth();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.illustration}>
            <Text style={{ fontSize: 64 }}>🗣️</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Welcome Back 👋</Text>
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

          {(error || googleError) ? <Text style={styles.errorText}>{error || googleError}</Text> : null}

          <TouchableOpacity onPress={() => navigation.navigate(Routes.ForgotPassword)} style={styles.forgotLink}>
            <Text style={{ color: '#007AFF', fontWeight: '500' }}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button title="Log In" onPress={handleLogin} loading={loading} />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>Or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Button title="Continue with Google" variant="secondary" onPress={() => promptAsync()} loading={googleLoading} />
        </View>

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
  illustration: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  form: {
    width: '100%',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
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
