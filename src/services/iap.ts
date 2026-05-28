// In-App Purchase service using react-native-iap
// Handles subscriptions via Apple App Store / Google Play Store
// No server needed — validation is done via OS + Firestore sync

import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Subscription,
  type Purchase,
} from 'react-native-iap';

// Product IDs configured in App Store Connect + Google Play Console
export const IAP_SKUS = {
  monthly: 'speako_premium_monthly',
  yearly: 'speako_premium_yearly',
};

const SKU_LIST = [IAP_SKUS.monthly, IAP_SKUS.yearly];

let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

/**
 * Initialize IAP connection. Call once on app start.
 */
export async function initIAP() {
  try {
    const connected = await initConnection();
    console.log('[IAP] Connection initialized:', connected);
    return true;
  } catch (err: any) {
    console.error('[IAP] Init failed:', err.message);
    return false;
  }
}

/**
 * Clean up IAP connection.
 */
export async function disconnectIAP() {
  try {
    if (purchaseUpdateSubscription) {
      purchaseUpdateSubscription.remove();
      purchaseUpdateSubscription = null;
    }
    if (purchaseErrorSubscription) {
      purchaseErrorSubscription.remove();
      purchaseErrorSubscription = null;
    }
    await endConnection();
  } catch (err: any) {
    console.error('[IAP] Disconnect error:', err.message);
  }
}

/**
 * Fetch available subscription products from the store.
 */
export async function fetchSubscriptions(): Promise<Subscription[]> {
  try {
    const subs = await getSubscriptions({ skus: SKU_LIST });
    console.log('[IAP] Subscriptions fetched:', subs.length);
    return subs;
  } catch (err: any) {
    console.error('[IAP] Fetch subscriptions failed:', err.message);
    return [];
  }
}

/**
 * Start a subscription purchase.
 * @param sku - Product ID (e.g., 'speako_premium_monthly')
 * @param onSuccess - Called with purchase data on success
 * @param onError - Called with error on failure
 */
export async function startSubscription(
  sku: string,
  onSuccess: (purchase: Purchase) => void,
  onError: (error: any) => void,
) {
  try {
    // Set up listeners before requesting
    purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
      console.log('[IAP] Purchase updated:', purchase.productId, purchase.transactionId);

      // Acknowledge/finish the transaction
      const receipt = purchase.transactionReceipt;
      if (receipt) {
        try {
          await finishTransaction({ purchase, isConsumable: false });
          console.log('[IAP] Transaction finished');
          onSuccess(purchase);
        } catch (finishErr: any) {
          console.error('[IAP] Finish transaction failed:', finishErr.message);
          onError(finishErr);
        }
      }
    });

    purchaseErrorSubscription = purchaseErrorListener((error: any) => {
      console.error('[IAP] Purchase error:', error.message);
      onError(error);
    });

    await requestSubscription({ sku });
  } catch (err: any) {
    console.error('[IAP] Request subscription failed:', err.message);
    onError(err);
  }
}

/**
 * Check if user has an active premium subscription.
 * Call this on app start to sync subscription status.
 */
export async function checkActiveSubscription(): Promise<Purchase | null> {
  try {
    const purchases = await getAvailablePurchases();
    console.log('[IAP] Available purchases:', purchases.length);

    // Find a premium subscription purchase
    const premiumPurchase = purchases.find((p) =>
      SKU_LIST.includes(p.productId),
    );

    if (premiumPurchase) {
      console.log('[IAP] Active premium found:', premiumPurchase.productId);
      return premiumPurchase;
    }

    return null;
  } catch (err: any) {
    console.error('[IAP] Check active subscription failed:', err.message);
    return null;
  }
}

/**
 * Format IAP subscription price for display.
 */
export function formatIAPPrice(subscription?: Subscription): string {
  if (!subscription) return '';
  const price = subscription.localizedPrice || subscription.price;
  const period = subscription.subscriptionPeriodAndroid || subscription.subscriptionPeriodUnitIOS;
  if (period === 'P1M' || period === 'MONTH') return `${price} / month`;
  if (period === 'P1Y' || period === 'YEAR') return `${price} / year`;
  return price;
}
