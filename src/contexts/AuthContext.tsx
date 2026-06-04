import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { registerForPushNotifications } from '../services/notifications';
import {
  onAuthStateChanged,
  signOut,
  signInWithCredential,
  signInWithCustomToken,
  updateProfile,
  type User,
  type UserCredential,
  type OAuthCredential,
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { POINTS, addPoints, awardDailyLogin } from '../services/rewards';
import { generateReferralCode, ensureReferralCode, registerReferralCode } from '../services/referral';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  preferredLanguage: string;
  lastTheirLanguage?: string;
  phone?: string | null;
  isDiscoverable?: boolean;
  points?: number;
  aiConversationEnabled?: boolean;
  aiConversationUnlocked?: boolean;
  referralCode?: string;
  referredBy?: string | null;
  referralCount?: number;
  referralPointsEarned?: number;
  lastLoginDate?: string;
}

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  justSignedIn: boolean;
  points: number;
  sendOTP: (email: string) => Promise<void>;
  verifyOTP: (email: string, otp: string, displayName?: string) => Promise<void>;
  loginWithGoogle: (credential: OAuthCredential) => Promise<UserCredential>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<AppUser>) => Promise<void>;
  clearJustSignedIn: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [justSignedIn, setJustSignedIn] = useState(false);

  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log('[Auth] onAuthStateChanged fired. User:', fbUser?.uid ?? 'null');
      setFirebaseUser(fbUser);

      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        userDocUnsub = onSnapshot(
          userRef,
          async (snap) => {
            try {
              if (snap.exists()) {
                const data = snap.data() as AppUser;
                if (!data.uid) return;
                if (data.isDiscoverable === undefined) {
                  await updateDoc(userRef, { isDiscoverable: true });
                  data.isDiscoverable = true;
                }
                setUser(data);
              } else {
                const referralCode = await ensureReferralCode(fbUser.uid);
                await registerReferralCode(fbUser.uid, referralCode).catch((e) =>
                  console.warn('[Auth] registerReferralCode failed:', e?.code),
                );

                const newUser: AppUser = {
                  uid: fbUser.uid,
                  email: fbUser.email,
                  displayName: fbUser.displayName,
                  photoURL: fbUser.photoURL,
                  preferredLanguage: 'en',
                  phone: null,
                  isDiscoverable: true,
                  points: 0,
                  referralCode,
                };
                await setDoc(userRef, newUser);
                await addPoints(fbUser.uid, POINTS.WELCOME_BONUS, 'welcome');
                newUser.points = POINTS.WELCOME_BONUS;
                setUser(newUser);
                console.log('[Auth] Created new user doc with welcome bonus');
              }
            } catch (e) {
              console.error('[Auth] onSnapshot handler error:', e);
            } finally {
              setIsLoading(false);
            }
          },
          (err) => {
            console.error('[Auth] Firestore onSnapshot failed:', err.message);
            const fallbackUser: AppUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              preferredLanguage: 'en',
              phone: null,
              isDiscoverable: true,
              points: 0,
            };
            setUser(fallbackUser);
            setIsLoading(false);
          }
        );
        registerForPushNotifications(fbUser.uid).catch(() => {});
        awardDailyLogin(fbUser.uid).catch(() => {});
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (userDocUnsub) userDocUnsub();
    };
  }, []);

  const sendOTP = async (email: string): Promise<void> => {
    const fn = httpsCallable(getFunctions(), 'sendOTP');
    await fn({ email });
  };

  const verifyOTP = async (email: string, otp: string, displayName?: string): Promise<void> => {
    const fn = httpsCallable(getFunctions(), 'verifyOTP');
    const result = await fn({ email, otp, displayName }) as any;
    setJustSignedIn(true);
    await signInWithCustomToken(auth, result.data.token);
    if (displayName && auth.currentUser && !auth.currentUser.displayName) {
      await updateProfile(auth.currentUser, { displayName });
    }
  };

  const loginWithGoogle = async (credential: OAuthCredential): Promise<UserCredential> => {
    setJustSignedIn(true);
    return signInWithCredential(auth, credential);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setJustSignedIn(false);
  };

  const updateUserProfile = async (data: Partial<AppUser>) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    await updateDoc(ref, data);
    setUser((prev) => {
      if (!prev) return null;
      return { ...prev, ...data };
    });
  };

  const clearJustSignedIn = () => setJustSignedIn(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAuthenticated: !!user,
        justSignedIn,
        points: user?.points ?? 0,
        sendOTP,
        verifyOTP,
        loginWithGoogle,
        logout,
        updateUserProfile,
        clearJustSignedIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
