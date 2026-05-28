import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { downgradeToFree } from '../../services/subscription';

export function SubscriptionManageScreen({ navigation }: any) {
  const { user, subscription, points, isPremium, updateUserProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [cancelling, setCancelling] = useState(false);

  const expiryDate = subscription.expiry?.toDate
    ? subscription.expiry.toDate().toLocaleDateString()
    : subscription.expiry
    ? new Date(subscription.expiry.toMillis()).toLocaleDateString()
    : 'N/A';

  const handleCancel = () => {
    if (!user) return;
    Alert.alert(
      'Cancel Premium?',
      'You will lose AI translations, ads will return, and your points will remain. You can resubscribe anytime.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await downgradeToFree(user.uid);
              Alert.alert('Subscription cancelled', 'You have been downgraded to Free.');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel subscription');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Subscription</Text>
        </View>

        {/* Status Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusRow}>
            <View style={[styles.badge, { backgroundColor: isPremium ? '#34C759' : '#8E8E93' }]}>
              <Text style={styles.badgeText}>{isPremium ? 'ACTIVE' : 'FREE'}</Text>
            </View>
            <Ionicons name={isPremium ? 'diamond' : 'diamond-outline'} size={28} color={isPremium ? '#007AFF' : colors.textSecondary} />
          </View>

          <Text style={[styles.planName, { color: colors.text }]}>
            {isPremium ? 'Speako Premium' : 'Speako Free'}
          </Text>

          {isPremium && (
            <Text style={[styles.expiry, { color: colors.textSecondary }]}>
              Renews on {expiryDate}
            </Text>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points Balance</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{points}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Translation Cost</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{isPremium ? 'Free' : '5 pts'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>AI Translation</Text>
            <Text style={[styles.statValue, { color: isPremium ? '#34C759' : colors.text }]}>
              {isPremium ? 'Included' : 'Premium only'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.statRow}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ads</Text>
            <Text style={[styles.statValue, { color: isPremium ? '#34C759' : colors.text }]}>
              {isPremium ? 'Removed' : 'Shown'}
            </Text>
          </View>
        </View>

        {/* Features list */}
        {isPremium && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Included Features</Text>
            {[
              'AI-powered translations',
              'Unlimited conversations',
              'No ads',
              'Priority support',
              'All languages unlocked',
            ].map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#34C759" />
                <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Cancel button */}
      {isPremium && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelBtnText}>
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </Text>
          </TouchableOpacity>
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
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  expiry: {
    fontSize: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  cancelBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
