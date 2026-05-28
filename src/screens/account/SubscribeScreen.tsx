import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { buildPaymentLinkUrl, STRIPE_PAYMENT_LINKS } from '../../constants/stripe-links';

type PlanType = 'monthly' | 'yearly';
type Currency = 'AED' | 'SAR' | 'USD';

const PRICES: Record<Currency, Record<PlanType, { amount: number; label: string; per: string }>> = {
  AED: {
    monthly: { amount: 19.99, label: 'AED 19.99', per: '/ month' },
    yearly: { amount: 199.99, label: 'AED 199.99', per: '/ year' },
  },
  SAR: {
    monthly: { amount: 20.99, label: 'SAR 20.99', per: '/ month' },
    yearly: { amount: 209.99, label: 'SAR 209.99', per: '/ year' },
  },
  USD: {
    monthly: { amount: 5.99, label: '$5.99', per: '/ month' },
    yearly: { amount: 59.99, label: '$59.99', per: '/ year' },
  },
};

function hasConfiguredLinks(): boolean {
  return Object.values(STRIPE_PAYMENT_LINKS).some((url) => url && url.startsWith('https://'));
}

export function SubscribeScreen({ navigation, route }: any) {
  const { user, isPremium } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanType>('monthly');
  const [currency, setCurrency] = useState<Currency>('AED');
  const [processing, setProcessing] = useState(false);

  // Handle return from Stripe Payment Link
  const paymentStatus = route.params?.status;
  useEffect(() => {
    if (paymentStatus === 'success') {
      Alert.alert(
        'Payment Successful',
        'Thank you! Your premium access will be activated shortly. If it does not appear within a few minutes, please restart the app.',
        [{ text: 'OK' }]
      );
    } else if (paymentStatus === 'cancel') {
      Alert.alert('Payment Cancelled', 'You can try again anytime.');
    }
  }, [paymentStatus]);

  const openStripeCheckout = useCallback(async () => {
    if (!user) return;

    if (!hasConfiguredLinks()) {
      Alert.alert(
        'Payment Links Not Configured',
        'Stripe Payment Links need to be set up in the dashboard. See instructions in stripe-links.ts'
      );
      return;
    }

    const planKey = `${plan}-${currency.toLowerCase()}`;
    const url = buildPaymentLinkUrl(planKey, user.uid);

    if (!url) {
      Alert.alert('Error', 'Payment link not available for this plan.');
      return;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Error', 'Cannot open payment page.');
      return;
    }

    setProcessing(true);
    await Linking.openURL(url);
    setProcessing(false);
  }, [user, plan, currency]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Upgrade to Premium</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#007AFF' }]}>
            <Ionicons name="diamond" size={32} color="#FFF" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {isPremium ? 'You are Premium!' : 'Unlock the Full Experience'}
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            {isPremium
              ? 'Enjoy AI translations, unlimited conversations, and priority support.'
              : 'Get AI-powered translations, unlimited conversations, and remove ads.'}
          </Text>
        </View>

        {/* Currency Selector */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Currency</Text>
        <View style={styles.currencyRow}>
          {(['AED', 'SAR', 'USD'] as Currency[]).map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCurrency(c)}
              activeOpacity={0.8}
              style={[
                styles.currencyChip,
                {
                  backgroundColor: currency === c ? '#007AFF' : isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceHighlight,
                  borderColor: currency === c ? '#007AFF' : colors.border,
                },
              ]}
            >
              <Text style={{ color: currency === c ? '#FFF' : colors.text, fontWeight: '600' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Plans */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Select Plan</Text>
        <View style={styles.plans}>
          {(['monthly', 'yearly'] as PlanType[]).map((p) => {
            const price = PRICES[currency][p];
            const isSelected = plan === p;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPlan(p)}
                activeOpacity={0.8}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? '#007AFF' : colors.border,
                    borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View style={styles.planTop}>
                  <Text style={[styles.planName, { color: colors.text }]}>
                    {p === 'monthly' ? 'Monthly' : 'Yearly'}
                  </Text>
                  {p === 'yearly' && (
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveText}>Save 17%</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.planPrice, { color: colors.text }]}>
                  {price.label}
                  <Text style={[styles.planPer, { color: colors.textSecondary }]}> {price.per}</Text>
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Features */}
        <View style={styles.features}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Premium Features</Text>
          {[
            { icon: 'sparkles', text: 'AI-powered translations' },
            { icon: 'infinite', text: 'Unlimited conversations' },
            { icon: 'remove-circle', text: 'Remove all ads' },
            { icon: 'flash', text: 'Priority support' },
            { icon: 'language', text: 'All languages unlocked' },
          ].map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <Ionicons name={f.icon as any} size={18} color="#007AFF" />
              <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        {!isPremium && (
          <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F2F2F7' }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              You will be redirected to Stripe's secure checkout page. After payment, return to the app and your premium access will be activated shortly.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      {!isPremium && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.subscribeBtn, processing && { opacity: 0.6 }]}
            onPress={openStripeCheckout}
            disabled={processing}
            activeOpacity={0.85}
          >
            <Text style={styles.subscribeBtnText}>
              {processing ? 'Opening...' : `Subscribe — ${PRICES[currency][plan].label}`}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.termsText, { color: colors.textSecondary }]}>
            Secured by Stripe. You can cancel anytime from your account.
          </Text>
        </View>
      )}
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
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  heroSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 10,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  plans: { gap: 10, paddingHorizontal: 24, marginBottom: 24 },
  planCard: {
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  planTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: { fontSize: 15, fontWeight: '600' },
  saveBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  saveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  planPrice: { fontSize: 24, fontWeight: '700' },
  planPer: { fontSize: 14, fontWeight: '400' },
  features: { paddingHorizontal: 24, marginBottom: 16 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  featureText: { fontSize: 15, fontWeight: '500' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  subscribeBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscribeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  termsText: { fontSize: 12, textAlign: 'center' },
});
