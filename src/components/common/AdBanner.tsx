import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useAuth } from '../../contexts/AuthContext';

const PRODUCTION_BANNER_ID = 'ca-app-pub-6826771706478909/7195640912';

const adUnitId = __DEV__ ? TestIds.BANNER : PRODUCTION_BANNER_ID;

export function AdBanner() {
  const { isPremium } = useAuth();

  if (isPremium) return null;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallback}>
        {/* No ads on web */}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  fallback: {
    height: 0,
  },
});
