import React, { useState, useCallback } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { SplashScreen as CustomSplash } from './screens/auth/SplashScreen';
import { AuthNavigator } from './navigation/AuthNavigator';
import { AppNavigator } from './navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
});

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { resolvedTheme } = useTheme();
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashReady = useCallback(() => {
    setShowSplash(false);
    SplashScreen.hideAsync();
  }, []);

  if (showSplash || isLoading) {
    return <CustomSplash onReady={handleSplashReady} />;
  }

  return (
    <NavigationContainer theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

export function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
