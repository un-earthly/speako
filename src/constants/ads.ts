import { TestIds } from 'react-native-google-mobile-ads';

// Set EXPO_PUBLIC_FORCE_TEST_ADS=true in .env for internal test builds
// Everyone gets test ads — safe for WhatsApp sharing with testers
const FORCE_TEST_ADS = process.env.EXPO_PUBLIC_FORCE_TEST_ADS === 'true';

const PRODUCTION = {
  BANNER: 'ca-app-pub-6826771706478909/7195640912',
  INTERSTITIAL: 'ca-app-pub-6826771706478909/9602616326',
  REWARDED: 'ca-app-pub-6826771706478909/3228779663',
  APP_OPEN: 'ca-app-pub-6826771706478909/7148373603',
  NATIVE: 'ca-app-pub-6826771706478909/6715678664',
};

export const AdUnitIds = {
  BANNER: __DEV__ || FORCE_TEST_ADS ? TestIds.BANNER : PRODUCTION.BANNER,
  INTERSTITIAL: __DEV__ || FORCE_TEST_ADS ? TestIds.INTERSTITIAL : PRODUCTION.INTERSTITIAL,
  REWARDED: __DEV__ || FORCE_TEST_ADS ? TestIds.REWARDED : PRODUCTION.REWARDED,
  APP_OPEN: __DEV__ || FORCE_TEST_ADS ? TestIds.APP_OPEN : PRODUCTION.APP_OPEN,
  NATIVE: __DEV__ || FORCE_TEST_ADS ? TestIds.NATIVE : PRODUCTION.NATIVE,
};
