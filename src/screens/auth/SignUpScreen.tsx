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

const STEPS = ['name', 'email', 'terms'] as const;
type Step = typeof STEPS[number];

const STEP_LABELS: Record<Step, string> = {
  name:  "What's your name?",
  email: "What's your email?",
  terms: 'Almost there!',
};

export function SignUpScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('name');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const { sendOTP } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { promptAsync, loading: googleLoading } = useGoogleAuth();
  const insets = useSafeAreaInsets();

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex + 1) / STEPS.length;

  const advance = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const handleNext = () => {
    if (step === 'name') {
      if (!displayName.trim()) { showToast('Please enter your name', 'error'); return; }
      advance();
    } else if (step === 'email') {
      if (!email.trim()) { showToast('Please enter your email', 'error'); return; }
      if (!/\S+@\S+\.\S+/.test(email)) { showToast('Please enter a valid email', 'error'); return; }
      advance();
    }
  };

  const handleSignUp = async () => {
    if (!agreed) { showToast('Please agree to the Terms & Conditions', 'error'); return; }
    setLoading(true);
    try {
      await sendOTP(email.trim().toLowerCase());
      navigation.navigate(Routes.OTP, {
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to send code. Please try again.', 'error');
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
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.back} onPress={() => setStep(STEPS[stepIndex - 1])}>
            <Text style={{ color: colors.textSecondary, fontSize: 15 }}>← Back</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.header}>
          <Image
            source={require('../../../assets/signin-banner.png')}
            style={styles.banner}
            resizeMode="contain"
          />
          <Text style={[styles.stepLabel, { color: colors.text }]}>{STEP_LABELS[step]}</Text>
        </View>

        <View style={styles.form}>
          {step === 'name' && (
            <>
              <Input
                label="Display Name"
                placeholder="Enter your name"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoFocus
              />
              <Button title="Next" onPress={handleNext} />
            </>
          )}

          {step === 'email' && (
            <>
              <Input
                label="Email Address"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus
              />
              <Button title="Next" onPress={handleNext} />
            </>
          )}

          {step === 'terms' && (
            <>
              <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(!agreed)}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border, backgroundColor: agreed ? '#007AFF' : 'transparent' },
                  ]}
                >
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
            </>
          )}
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
  back: { marginBottom: 8 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 28 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: '#007AFF' },
  header: { alignItems: 'center', marginBottom: 28 },
  banner: { width: 160, height: 120, marginBottom: 12 },
  stepLabel: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  form: { width: '100%' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10, marginTop: 2,
  },
  termsText: { flex: 1, fontSize: 13, lineHeight: 18 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 14 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
});
