import { useEffect, useRef, useCallback } from 'react';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { AdUnitIds } from '../constants/ads';
import { useAuth } from '../contexts/AuthContext';

export function useInterstitialAd() {
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const { isPremium } = useAuth();

  useEffect(() => {
    if (isPremium) return;

    const ad = InterstitialAd.createForAdRequest(AdUnitIds.INTERSTITIAL, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedSub = ad.addAdEventListener(AdEventType.LOADED, () => {
      // Ad is loaded and ready to show
    });

    const errorSub = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('Interstitial ad error:', error);
    });

    const closedSub = ad.addAdEventListener(AdEventType.CLOSED, () => {
      // Preload next ad after closing
      ad.load();
    });

    ad.load();
    interstitialRef.current = ad;

    return () => {
      loadedSub();
      errorSub();
      closedSub();
    };
  }, [isPremium]);

  const showAd = useCallback((): Promise<boolean> => {
    if (isPremium) return Promise.resolve(false);

    return new Promise((resolve) => {
      const ad = interstitialRef.current;
      if (!ad) {
        resolve(false);
        return;
      }

      if (ad.loaded) {
        ad.show();
        resolve(true);
      } else {
        // Try to load and show
        ad.load();
        resolve(false);
      }
    });
  }, [isPremium]);

  return { showAd };
}
