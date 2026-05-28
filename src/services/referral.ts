import { doc, getDoc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { POINTS, addPoints } from './rewards';

const REFERRAL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += REFERRAL_CHARS[Math.floor(Math.random() * REFERRAL_CHARS.length)];
  }
  return `SPEAKO-${code}`;
}

export async function ensureReferralCode(uid: string): Promise<string> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (data?.referralCode) return data.referralCode;

  const code = generateReferralCode();
  await updateDoc(ref, { referralCode: code });
  return code;
}

export async function processReferral(newUserUid: string, referralCode: string): Promise<void> {
  if (!referralCode || !newUserUid) return;

  // Find referrer by referral code
  const usersRef = doc(db, 'users', '_referralIndex');
  const indexSnap = await getDoc(usersRef);
  const index = indexSnap.data()?.codes ?? {};
  const referrerUid = index[referralCode.toUpperCase()];

  if (!referrerUid || referrerUid === newUserUid) return;

  // Verify the referrer exists
  const referrerSnap = await getDoc(doc(db, 'users', referrerUid));
  if (!referrerSnap.exists()) return;

  // Award bonuses
  await addPoints(referrerUid, POINTS.REFERRAL_BONUS, 'referral', newUserUid);
  await addPoints(newUserUid, POINTS.REFERRAL_WELCOME, 'referral_bonus', referrerUid);

  // Update referrer stats
  await updateDoc(doc(db, 'users', referrerUid), {
    referralCount: increment(1),
    referralPointsEarned: increment(POINTS.REFERRAL_BONUS),
  });

  // Mark referred user
  await updateDoc(doc(db, 'users', newUserUid), {
    referredBy: referrerUid,
  });
}

export async function registerReferralCode(uid: string, code: string): Promise<void> {
  const indexRef = doc(db, 'users', '_referralIndex');
  const snap = await getDoc(indexRef);
  if (snap.exists()) {
    await updateDoc(indexRef, {
      [`codes.${code.toUpperCase()}`]: uid,
    });
  } else {
    await setDoc(indexRef, {
      codes: { [code.toUpperCase()]: uid },
    });
  }
}
