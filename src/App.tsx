import React, { useState, useCallback, useEffect } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar, StyleSheet, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useAppOpenAd } from './hooks/useAppOpenAd';
import { SplashScreen as CustomSplash } from './screens/auth/SplashScreen';
import { AuthNavigator } from './navigation/AuthNavigator';
import { AppNavigator } from './navigation/AppNavigator';
import { Routes } from './constants/routes';

SplashScreen.preventAutoHideAsync();

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

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
  const { isAuthenticated, isLoading } = useAuth();
  const { resolvedTheme } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  useAppOpenAd();

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
        // For now, we can show a toast or alert when they land on Subscribe screen
      }
    });
    return () => sub.remove();
  }, []);

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
    <GestureHandlerRootView style={styles.gestureRoot}>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <SafeAreaProvider>
          <AuthProvider>
            <ThemeProvider>
              <RootNavigator />
            </ThemeProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
