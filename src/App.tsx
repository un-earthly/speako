import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar, StyleSheet, Linking, View, Text, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { useAppOpenAd } from './hooks/useAppOpenAd';
import { useBiometrics } from './hooks/useBiometrics';
import { MobileAds } from 'react-native-google-mobile-ads';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SplashScreen as CustomSplash } from './screens/auth/SplashScreen';
import { AuthNavigator } from './navigation/AuthNavigator';
import { AppNavigator } from './navigation/AppNavigator';
import { Routes } from './constants/routes';

SplashScreen.preventAutoHideAsync();



const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
});

const linking = {
  prefixes: ['speako://'],
  config: {
    screens: {
      [Routes.Subscribe]: 'payment/:status',
    },
  },
};

function BiometricGate({ onUnlock, onUseEmail }: { onUnlock: () => void; onUseEmail: () => void }) {
  const { colors } = useTheme();
  const { authenticate, getBiometricLabel } = useBiometrics();
  const [label, setLabel] = useState('Biometrics');

  useEffect(() => {
    getBiometricLabel().then(setLabel);
    triggerAuth();
  }, []);

  const triggerAuth = async () => {
    const success = await authenticate('Sign in to Speako');
    if (success) onUnlock();
  };

  return (
    <View style={[gateStyles.root, { backgroundColor: colors.background }]}>
      <Ionicons name="finger-print-outline" size={72} color="#007AFF" />
      <Text style={[gateStyles.title, { color: colors.text }]}>Welcome back</Text>
      <Text style={[gateStyles.sub, { color: colors.textSecondary }]}>
        Authenticate to continue
      </Text>
      <TouchableOpacity style={gateStyles.btn} onPress={triggerAuth}>
        <Text style={gateStyles.btnText}>Use {label}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onUseEmail} style={gateStyles.link}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Sign in with email instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const gateStyles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 16 },
  sub: { fontSize: 15, marginBottom: 8 },
  btn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 16, padding: 8 },
});

function RootNavigator() {
  const { isAuthenticated, isLoading, user, justSignedIn, clearJustSignedIn, logout } = useAuth();
  const { resolvedTheme, colors } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const biometricChecked = useRef(false);
  const { isAvailable, isEnabled } = useBiometrics();
  useAppOpenAd(user?.uid);

  const handleSplashReady = useCallback(() => {
    setShowSplash(false);
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener('url', (event) => {
      const url = event.url;
      if (url?.includes('payment/success')) {
        // User returned from successful Stripe payment
        // Premium activation happens via webhook or manual admin action
      }
      // Process referral codes from deep links: speako://?ref=SPEAKO-XXXXXX
      if (url) {
        try {
          const parsed = new URL(url);
          const refCode = parsed.searchParams.get('ref');
          if (refCode && user?.uid) {
            import('./services/referral').then(({ processReferral }) => {
              processReferral(user.uid, refCode).catch(() => {});
            });
          }
        } catch {
          // ignore invalid URLs
        }
      }
    });
    return () => sub.remove();
  }, [user?.uid]);

  // Check biometric gate once per session when user is restored from storage
  useEffect(() => {
    if (!isAuthenticated || isLoading || biometricChecked.current) return;
    biometricChecked.current = true;

    if (justSignedIn) {
      clearJustSignedIn();
      return;
    }

    (async () => {
      const available = await isAvailable();
      const enabled = await isEnabled();
      if (available && enabled) setBiometricLocked(true);
    })();
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      biometricChecked.current = false;
      setBiometricLocked(false);
    }
  }, [isAuthenticated]);

  if (showSplash || isLoading) {
    return <CustomSplash onReady={handleSplashReady} />;
  }

  if (isAuthenticated && biometricLocked) {
    return (
      <BiometricGate
        onUnlock={() => setBiometricLocked(false)}
        onUseEmail={async () => { await logout(); setBiometricLocked(false); }}
      />
    );
  }

  return (
    <NavigationContainer linking={linking} theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

// Add test device IDs here for release-build testing.
// Your device: D113027F52E2730998D29DE1A46489DA
const TEST_DEVICE_IDS: string[] = ['D113027F52E2730998D29DE1A46489DA'];

export function App() {
  useEffect(() => {
    MobileAds()
      .setRequestConfiguration({
        testDeviceIdentifiers: TEST_DEVICE_IDS,
      })
      .then(() => MobileAds().initialize())
      .catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
