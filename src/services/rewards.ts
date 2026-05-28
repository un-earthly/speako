import { doc, getDoc, updateDoc, onSnapshot, increment, runTransaction, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const POINTS = {
  TRANSLATION_COST: 5,
  WATCH_AD_BASE: 50,
  WATCH_AD_BONUS_PER_STREAK: 10,
  WATCH_AD_MAX_BONUS: 100,
  WELCOME_BONUS: 100,
  PREMIUM_DAILY_BONUS: 200,
  REFERRAL_BONUS: 200,
  REFERRAL_WELCOME: 50,
  DAILY_LOGIN: 10,
  STARTUP_AD: 25,
};

export async function getUserPoints(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return 0;
  return snap.data().points ?? 0;
}

export function subscribeToPoints(uid: string, callback: (points: number) => void) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (!snap.exists()) {
      callback(0);
      return;
    }
    callback(snap.data().points ?? 0);
  });
}

export async function addPoints(
  uid: string,
  amount: number,
  reason: string = 'unknown',
  relatedId: string | null = null,
): Promise<number> {
  const userRef = doc(db, 'users', uid);
  const historyRef = collection(db, 'users', uid, 'pointsHistory');

  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const current = snap.exists() ? (snap.data().points ?? 0) : 0;
    const newTotal = current + amount;

    transaction.update(userRef, { points: increment(amount) });
    transaction.set(doc(historyRef), {
      type: 'earned',
      amount,
      reason,
      relatedId,
      balanceAfter: newTotal,
      createdAt: serverTimestamp(),
    });

    return newTotal;
  });

  return result;
}

export async function deductPoints(
  uid: string,
  amount: number,
  reason: string = 'message',
  conversationId: string | null = null,
): Promise<boolean> {
  const userRef = doc(db, 'users', uid);
  const historyRef = collection(db, 'users', uid, 'pointsHistory');

  try {
    const result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) return { success: false, newTotal: 0 };

      const current = snap.data().points ?? 0;
      if (current < amount) return { success: false, newTotal: current };

      const newTotal = current - amount;
      transaction.update(userRef, { points: increment(-amount) });
      transaction.set(doc(historyRef), {
        type: 'spent',
        amount,
        reason,
        conversationId,
        balanceAfter: newTotal,
        createdAt: serverTimestamp(),
      });

      return { success: true, newTotal };
    });

    return result.success;
  } catch (err) {
    console.error('[Rewards] deductPoints transaction failed:', err);
    return false;
  }
}

export async function getAdStreak(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return 0;
  return snap.data().adStreak ?? 0;
}

export async function rewardAdWatch(uid: string): Promise<{ pointsEarned: number; newTotal: number; streak: number }> {
  const ref = doc(db, 'users', uid);
  const historyRef = collection(db, 'users', uid, 'pointsHistory');

  const result = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data() || {};
    const currentStreak = (data.adStreak ?? 0) + 1;
    const bonus = Math.min(
      (currentStreak - 1) * POINTS.WATCH_AD_BONUS_PER_STREAK,
      POINTS.WATCH_AD_MAX_BONUS
    );
    const pointsEarned = POINTS.WATCH_AD_BASE + bonus;
    const currentPoints = data.points ?? 0;
    const newTotal = currentPoints + pointsEarned;

    transaction.update(ref, {
      points: newTotal,
      adStreak: currentStreak,
      lastAdWatched: new Date().toISOString(),
    });
    transaction.set(doc(historyRef), {
      type: 'earned',
      amount: pointsEarned,
      reason: 'ad_watch',
      balanceAfter: newTotal,
      createdAt: serverTimestamp(),
    });

    return { pointsEarned, newTotal, streak: currentStreak };
  });

  return result;
}

export async function resetAdStreak(uid: string) {
  await updateDoc(doc(db, 'users', uid), { adStreak: 0 });
}

export async function unlockAIConversation(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { aiConversationUnlocked: true });
}

export async function awardDailyLogin(uid: string): Promise<{ awarded: boolean; points: number }> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const lastLogin = data?.lastLoginDate;
  const today = new Date().toISOString().split('T')[0];

  if (lastLogin === today) {
    return { awarded: false, points: 0 };
  }

  const newTotal = await addPoints(uid, POINTS.DAILY_LOGIN, 'daily_login');
  await updateDoc(ref, { lastLoginDate: today });

  return { awarded: true, points: POINTS.DAILY_LOGIN };
}
