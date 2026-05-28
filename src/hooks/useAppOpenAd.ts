import { useEffect, useRef } from 'react';
import { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { AdUnitIds } from '../constants/ads';

let appOpenAd: AppOpenAd | null = null;

export function useAppOpenAd() {
  const showedRef = useRef(false);

  useEffect(() => {
    if (!appOpenAd) {
      appOpenAd = AppOpenAd.createForAdRequest(AdUnitIds.APP_OPEN, {
        requestNonPersonalizedAdsOnly: true,
      });

      appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
        if (!showedRef.current) {
          appOpenAd?.show();
          showedRef.current = true;
        }
      });

      appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        appOpenAd?.load();
      });

      appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
        appOpenAd?.load();
      });

      appOpenAd.load();
    }

    return () => {
      // AppOpenAd is a singleton, don't destroy it
    };
  }, []);
}
