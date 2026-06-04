import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useBiometrics } from '../../hooks/useBiometrics';

export function ChangePasswordScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { isAvailable, isEnabled, setEnabled, authenticate, getBiometricLabel } = useBiometrics();

  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [label, setLabel] = useState('Biometrics');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const avail = await isAvailable();
      setAvailable(avail);
      if (avail) {
        setEnabledState(await isEnabled());
        setLabel(await getBiometricLabel());
      }
    })();
  }, []);

  const handleToggle = async (value: boolean) => {
    if (loading) return;
    if (value) {
      setLoading(true);
      const success = await authenticate(`Enable ${label} for Speako`);
      setLoading(false);
      if (!success) {
        showToast('Authentication failed. Biometrics not enabled.', 'error');
        return;
      }
    }
    await setEnabled(value);
    setEnabledState(value);
    showToast(value ? `${label} login enabled` : `${label} login disabled`, 'success');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Security</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {available ? (
          <View style={[styles.card, { backgroundColor: colors.surface ?? colors.background, borderColor: colors.border }]}>
            <View style={styles.cardLeft}>
              <Ionicons name="finger-print-outline" size={24} color="#007AFF" />
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{label} Login</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                  Sign in with {label} instead of email
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              disabled={loading}
              trackColor={{ false: colors.border, true: '#007AFF' }}
              thumbColor="#fff"
            />
          </View>
        ) : (
          <View style={[styles.infoBox, { backgroundColor: colors.surface ?? colors.background, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={22} color="#007AFF" />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              No biometric hardware found or no biometrics enrolled on this device. You can set up Face ID or fingerprint in your device settings.
            </Text>
          </View>
        )}

        <View style={[styles.infoBox, { backgroundColor: colors.surface ?? colors.background, borderColor: colors.border, marginTop: 12 }]}>
          <Ionicons name="lock-closed-outline" size={22} color="#007AFF" />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Speako uses passwordless sign-in. Your account is secured by email verification codes — no password needed.
          </Text>
        </View>
      </ScrollView>
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
  scroll: { padding: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
