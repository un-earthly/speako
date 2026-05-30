import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AdUnitIds } from '../../constants/ads';

const adUnitId = AdUnitIds.BANNER;

export function AdBanner() {
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
