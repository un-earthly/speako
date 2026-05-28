import { useEffect, useRef, useCallback } from 'react';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import { AdUnitIds } from '../constants/ads';

export function useRewardedAd() {
  const rewardedRef = useRef<RewardedAd | null>(null);
  const rewardCallbackRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const ad = RewardedAd.createForAdRequest(AdUnitIds.REWARDED, {
      requestNonPersonalizedAdsOnly: true,
    });

    const loadedSub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      // Ad is loaded
    });

    const earnedSub = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      rewardCallbackRef.current?.();
      rewardCallbackRef.current = null;
    });

    const closedSub = ad.addAdEventListener(AdEventType.CLOSED, () => {
      // Preload next ad
      ad.load();
    });

    const errorSub = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('Rewarded ad error:', error);
    });

    ad.load();
    rewardedRef.current = ad;

    return () => {
      loadedSub();
      earnedSub();
      closedSub();
      errorSub();
    };
  }, []);

  const showAd = useCallback((onReward: () => void): Promise<boolean> => {
    return new Promise((resolve) => {
      const ad = rewardedRef.current;
      if (!ad) {
        resolve(false);
        return;
      }

      if (ad.loaded) {
        rewardCallbackRef.current = onReward;
        ad.show();
        resolve(true);
      } else {
        ad.load();
        resolve(false);
      }
    });
  }, []);

  return { showAd };
}
