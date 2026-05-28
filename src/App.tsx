import React, { useState, useCallback, useEffect } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar, StyleSheet, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { useAppOpenAd } from './hooks/useAppOpenAd';
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

function RootNavigator() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
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

  if (showSplash || isLoading) {
    return <CustomSplash onReady={handleSplashReady} />;
  }

  return (
    <NavigationContainer linking={linking} theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export function App() {
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
