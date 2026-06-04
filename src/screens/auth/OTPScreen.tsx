import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/common/Button';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';

const OTP_LENGTH = 6;

export function OTPScreen({ route, navigation }: any) {
  const { email, displayName } = route.params ?? {};
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputs = useRef<Array<TextInput | null>>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { verifyOTP, sendOTP } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    startCooldown();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timer.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleDigit = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (digit && index === OTP_LENGTH - 1) handleVerify(next.join(''));
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otp = code ?? digits.join('');
    if (otp.length < OTP_LENGTH) {
      showToast('Please enter the complete 6-digit code', 'error');
      return;
    }
    setLoading(true);
    try {
      await verifyOTP(email, otp, displayName);
    } catch (err: any) {
      showToast(err.message || 'Invalid code. Please try again.', 'error');
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await sendOTP(email);
      showToast('New code sent!', 'success');
      startCooldown();
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputs.current[0]?.focus(), 100);
    } catch (err: any) {
      showToast(err.message || 'Failed to resend code.', 'error');
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We sent a 6-digit code to{'\n'}
            <Text style={{ color: colors.text, fontWeight: '600' }}>{email}</Text>
          </Text>
        </View>

        <View style={styles.otpRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputs.current[i] = ref; }}
              style={[
                styles.otpBox,
                {
                  borderColor: digit ? '#007AFF' : colors.border,
                  backgroundColor: colors.background,
                  color: colors.text,
                },
              ]}
              value={digit}
              onChangeText={text => handleDigit(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              autoFocus={i === 0}
            />
          ))}
        </View>

        <Button title="Verify" onPress={() => handleVerify()} disabled={loading} loading={false} />

        <TouchableOpacity
          onPress={handleResend}
          style={styles.resendBtn}
          disabled={cooldown > 0 || loading}
        >
          <Text style={{ color: cooldown > 0 ? colors.textSecondary : '#007AFF', fontSize: 14 }}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>

        <LoadingOverlay visible={loading} message="Verifying..." />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  back: { position: 'absolute', top: 24, left: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 36,
  },
  otpBox: {
    width: 48,
    height: 58,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: '700',
  },
  resendBtn: {
    alignItems: 'center',
    marginTop: 20,
    padding: 8,
  },
});
