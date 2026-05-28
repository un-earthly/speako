import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { registerForPushNotifications } from '../services/notifications';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  signInWithCredential,
  type User,
  type UserCredential,
  type OAuthCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { getSubscriptionStatus, type SubscriptionStatus } from '../services/subscription';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  preferredLanguage: string;
  lastTheirLanguage?: string;
  phone?: string | null;
  isDiscoverable?: boolean;
  subscriptionTier?: string;
  subscriptionExpiry?: Timestamp | null;
  points?: number;
  aiConversationEnabled?: boolean;
  aiConversationUnlocked?: boolean;
}

interface AuthContextValue {
  user: AppUser | null;
  firebaseUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPremium: boolean;
  subscription: SubscriptionStatus;
  points: number;
  login: (email: string, password: string) => Promise<UserCredential>;
  loginWithGoogle: (credential: OAuthCredential) => Promise<UserCredential>;
  register: (email: string, password: string, displayName: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<AppUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    tier: 'free',
    expiry: null,
    isActive: false,
  });

  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      console.log('[Auth] onAuthStateChanged fired. User:', fbUser?.uid ?? 'null');
      setFirebaseUser(fbUser);

      // Clean up previous user doc listener
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (fbUser) {
        // Set up real-time listener for user document
        const userRef = doc(db, 'users', fbUser.uid);
        userDocUnsub = onSnapshot(
          userRef,
          async (snap) => {
            if (snap.exists()) {
              const data = snap.data() as AppUser;
              if (data.isDiscoverable === undefined) {
                await updateDoc(userRef, { isDiscoverable: true });
                data.isDiscoverable = true;
              }
              setUser(data);
              setSubscription(getSubscriptionStatus(data.subscriptionTier, data.subscriptionExpiry));
            } else {
              // Create new user doc if missing
              const newUser: AppUser = {
                uid: fbUser.uid,
                email: fbUser.email,
                displayName: fbUser.displayName,
                photoURL: fbUser.photoURL,
                preferredLanguage: 'en',
                phone: null,
                isDiscoverable: true,
                points: 0,
                subscriptionTier: 'free',
                subscriptionExpiry: null,
              };
              await setDoc(userRef, newUser);
              setUser(newUser);
              setSubscription(getSubscriptionStatus('free', null));
              console.log('[Auth] Created new user doc in Firestore');
            }
            setIsLoading(false);
          },
          (err) => {
            console.error('[Auth] Firestore onSnapshot failed:', err.message);
            // Fallback: create a minimal user object from Firebase auth so the app
            // doesn't hang even if Firestore is unreachable
            const fallbackUser: AppUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              preferredLanguage: 'en',
              phone: null,
              isDiscoverable: true,
              subscriptionTier: 'free',
              subscriptionExpiry: null,
              points: 0,
            };
            setUser(fallbackUser);
            setSubscription(getSubscriptionStatus('free', null));
            setIsLoading(false);
          }
        );
        registerForPushNotifications(fbUser.uid).catch(() => {});
      } else {
        setUser(null);
        setSubscription(getSubscriptionStatus('free', null));
        setIsLoading(false);
        console.log('[Auth] isLoading set to false. user: null');
      }
    });

    return () => {
      unsubscribe();
      if (userDocUnsub) userDocUnsub();
    };
  }, []);

  const login = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async (credential: OAuthCredential) => {
    return signInWithCredential(auth, credential);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const newUser: AppUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName,
      photoURL: null,
      preferredLanguage: 'en',
      phone: null,
      isDiscoverable: true,
    };
    await setDoc(doc(db, 'users', cred.user.uid), newUser);
    setUser(newUser);
    setSubscription(getSubscriptionStatus('free', null));
    return cred;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (data: Partial<AppUser>) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    await updateDoc(ref, data);
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...data };
      setSubscription(getSubscriptionStatus(next.subscriptionTier, next.subscriptionExpiry));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAuthenticated: !!user,
        isPremium: subscription.isActive,
        subscription,
        points: user?.points ?? 0,
        login,
        loginWithGoogle,
        register,
        logout,
        resetPassword,
        updateUserProfile,
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
