import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AdUnitIds } from '../../constants/ads';

const adUnitId = AdUnitIds.BANNER;

export function AdBanner() {
  if (Platform.OS === 'web') return <View style={styles.fallback} />;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => console.log('[AdBanner] loaded')}
        onAdFailedToLoad={(e) => console.warn('[AdBanner] failed:', e.message)}
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
