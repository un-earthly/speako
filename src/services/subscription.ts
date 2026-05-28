import { doc, getDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface SubscriptionStatus {
  tier: 'free' | 'premium';
  expiry: Timestamp | null;
  isActive: boolean;
}

export function getSubscriptionStatus(
  subscriptionTier?: string,
  subscriptionExpiry?: Timestamp | null,
): SubscriptionStatus {
  const tier = subscriptionTier === 'premium' ? 'premium' : 'free';
  const now = Timestamp.now();
  const isActive =
    tier === 'premium' &&
    subscriptionExpiry instanceof Timestamp &&
    subscriptionExpiry.toMillis() > now.toMillis();

  return { tier, expiry: subscriptionExpiry || null, isActive };
}

export async function checkSubscriptionStatus(uid: string): Promise<SubscriptionStatus> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return { tier: 'free', expiry: null, isActive: false };
  const data = snap.data();
  return getSubscriptionStatus(data.subscriptionTier, data.subscriptionExpiry);
}

export function subscribeToSubscription(
  uid: string,
  callback: (status: SubscriptionStatus) => void,
) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) {
      callback({ tier: 'free', expiry: null, isActive: false });
      return;
    }
    const data = snap.data();
    callback(getSubscriptionStatus(data.subscriptionTier, data.subscriptionExpiry));
  });
}

export async function activatePremium(uid: string, months: number = 1) {
  const now = Timestamp.now();
  const expiry = Timestamp.fromMillis(now.toMillis() + months * 30 * 24 * 60 * 60 * 1000);
  await updateDoc(doc(db, 'users', uid), {
    subscriptionTier: 'premium',
    subscriptionExpiry: expiry,
  });
}

export async function downgradeToFree(uid: string) {
  await updateDoc(doc(db, 'users', uid), {
    subscriptionTier: 'free',
    subscriptionExpiry: null,
  });
}
