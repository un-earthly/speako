import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Platform } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
} from 'react-native-google-mobile-ads';
import { AdUnitIds } from '../../constants/ads';

interface NativeAdCardProps {
  style?: any;
}

export function NativeAdCard({ style }: NativeAdCardProps) {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setError(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    NativeAd.createForAdRequest(AdUnitIds.NATIVE, {
      requestNonPersonalizedAdsOnly: true,
    })
      .then((ad) => {
        if (!cancelled) {
          setNativeAd(ad);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (Platform.OS === 'web') return null;
  if (error || !nativeAd) return null;

  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
      <NativeAdView nativeAd={nativeAd} style={[styles.adView, loading && styles.hidden]}>
        <View style={styles.row}>
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image style={styles.icon} />
          </NativeAsset>
          <View style={styles.textCol}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} />
            </NativeAsset>
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.body} />
            </NativeAsset>
          </View>
        </View>
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <View style={styles.cta}>
            <Text style={styles.ctaText} />
          </View>
        </NativeAsset>
      </NativeAdView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 100,
  },
  adView: {
    width: '100%',
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  hidden: {
    opacity: 0,
    position: 'absolute',
  },
  loader: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  headline: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  body: {
    fontSize: 13,
    color: '#666',
  },
  cta: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
