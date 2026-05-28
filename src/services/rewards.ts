import { doc, getDoc, updateDoc, onSnapshot, increment } from 'firebase/firestore';
import { db } from '../config/firebase';

export const POINTS = {
  TRANSLATION_COST: 5,
  WATCH_AD_BASE: 50,
  WATCH_AD_BONUS_PER_STREAK: 10,
  WATCH_AD_MAX_BONUS: 100,
  WELCOME_BONUS: 100,
  PREMIUM_DAILY_BONUS: 200,
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

export async function addPoints(uid: string, amount: number): Promise<number> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { points: increment(amount) });
  const snap = await getDoc(ref);
  return snap.data()?.points ?? 0;
}

export async function deductPoints(uid: string, amount: number): Promise<boolean> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const current = snap.data()?.points ?? 0;
  if (current < amount) return false;
  await updateDoc(ref, { points: increment(-amount) });
  return true;
}

export async function getAdStreak(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return 0;
  return snap.data().adStreak ?? 0;
}

export async function rewardAdWatch(uid: string): Promise<{ pointsEarned: number; newTotal: number; streak: number }> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  const currentStreak = (data?.adStreak ?? 0) + 1;
  const bonus = Math.min(
    (currentStreak - 1) * POINTS.WATCH_AD_BONUS_PER_STREAK,
    POINTS.WATCH_AD_MAX_BONUS
  );
  const pointsEarned = POINTS.WATCH_AD_BASE + bonus;
  const currentPoints = data?.points ?? 0;
  const newTotal = currentPoints + pointsEarned;

  await updateDoc(ref, {
    points: newTotal,
    adStreak: currentStreak,
    lastAdWatched: new Date().toISOString(),
  });

  return { pointsEarned, newTotal, streak: currentStreak };
}

export async function resetAdStreak(uid: string) {
  await updateDoc(doc(db, 'users', uid), { adStreak: 0 });
}

export async function unlockAIConversation(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { aiConversationUnlocked: true });
}
