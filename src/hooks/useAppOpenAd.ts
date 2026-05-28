import { useEffect, useRef } from 'react';
import { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { AdUnitIds } from '../constants/ads';
import { addPoints, POINTS } from '../services/rewards';

let appOpenAd: AppOpenAd | null = null;

export function useAppOpenAd(userId?: string) {
  const showedRef = useRef(false);
  const rewardedRef = useRef(false);

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
        // Award points for watching the startup ad (once per session)
        if (userId && !rewardedRef.current) {
          rewardedRef.current = true;
          addPoints(userId, POINTS.STARTUP_AD, 'startup_ad').catch(() => {});
        }
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
  }, [userId]);
}
