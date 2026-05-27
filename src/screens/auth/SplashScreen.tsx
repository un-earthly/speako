import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export function SplashScreen({ onReady }: { onReady: () => void }) {
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(onReady, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, onReady]);

  return (
    <View style={[styles.container, { backgroundColor: '#007AFF' }]}>
      <View style={styles.logoContainer}>
        <View style={styles.logoBubble}>
          <Text style={styles.logoText}>🌐</Text>
        </View>
        <Text style={styles.title}>Translator</Text>
        <Text style={styles.subtitle}>Language is unbounded</Text>
      </View>
      <View style={[styles.loader, { bottom: insets.bottom + 40 }]}>
        <View style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 36,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  loader: {
    position: 'absolute',
    bottom: 60,
  },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    borderTopColor: '#FFFFFF',
  },
});
