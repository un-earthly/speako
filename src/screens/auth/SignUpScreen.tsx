import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Routes } from '../../constants/routes';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';



type TabKey = 'personal' | 'security';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'security', label: 'Security' },
];

export function SignUpScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<TabKey>('personal');

  // Personal tab state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  // Security tab state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();
  const { colors } = useTheme();
  const { promptAsync, loading: googleLoading, error: googleError } = useGoogleAuth();
  const insets = useSafeAreaInsets();

  const validatePersonal = () => {
    if (!displayName.trim() || !email.trim()) {
      setError('Please fill in all fields');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (activeTab === 'personal' && validatePersonal()) {
      setActiveTab('security');
    }
  };

  const handleSignUp = async () => {
    if (!password || !confirmPassword) {
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

  const handleTabPress = (tab: TabKey) => {
    if (tab === 'security' && !validatePersonal()) return;
    setActiveTab(tab);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.header}>
          <Image source={require('../../../assets/signin-banner.png')} style={styles.banner} resizeMode="contain" />
          <Text style={[styles.title, { color: colors.text }]}>Join Translator Today</Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                activeOpacity={0.8}
                style={[styles.tab, isActive && { backgroundColor: colors.card }]}
              >
                <Text style={[styles.tabLabel, { color: isActive ? colors.text : colors.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'personal' && (
            <View style={styles.form}>
              <Input label="Display Name" placeholder="Enter your name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" />
              <Input label="Email Address" placeholder="Enter your email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

              {(error || googleError) ? <Text style={styles.errorText}>{error || googleError}</Text> : null}

              <Button title="Next" onPress={handleNext} />
            </View>
          )}

          {activeTab === 'security' && (
            <View style={styles.form}>
              <Input label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry />
              <Input label="Confirm Password" placeholder="Confirm your password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

              <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(!agreed)}>
                <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: agreed ? '#007AFF' : 'transparent' }]}>
                  {agreed && <Text style={{ color: '#FFF', fontSize: 12 }}>✓</Text>}
                </View>
                <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                  I agree to Translator <Text style={{ color: '#007AFF' }}>Terms & Conditions</Text>
                </Text>
              </TouchableOpacity>

              {(error || googleError) ? <Text style={styles.errorText}>{error || googleError}</Text> : null}

              <Button title="Sign Up" onPress={handleSignUp} loading={false} disabled={loading || googleLoading} />

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>Or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <Button title="Continue with Google" variant="secondary" onPress={() => promptAsync()} loading={false} disabled={loading || googleLoading} />
              <View style={{ height: 12 }} />
              <Button title="Continue with Apple" variant="secondary" onPress={() => {}} />
            </View>
          )}
        </View>

        <LoadingOverlay visible={loading || googleLoading} message={googleLoading ? 'Signing up...' : 'Signing up...'} />

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
    marginBottom: 24,
    marginTop: 20,
  },
  banner: {
    width: 200,
    height: 160,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    width: '100%',
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
