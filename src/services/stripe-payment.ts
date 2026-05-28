import { getFunctions, httpsCallable } from 'firebase/functions';

interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

/**
 * Creates a Stripe PaymentIntent via the Firebase callable function.
 * Never calls Stripe directly from the client — the secret key stays on the server.
 */
export async function createPaymentIntent(
  amount: number,
  currency: string,
): Promise<PaymentIntentResult | null> {
  try {
    const functions = getFunctions();
    const createPI = httpsCallable(functions, 'createPaymentIntent');
    const result = await createPI({ amount, currency: currency.toLowerCase() });
    const data = result.data as PaymentIntentResult;
    return data;
  } catch (err: any) {
    console.error('[Stripe] PaymentIntent creation failed:', err.message || err);
    return null;
  }
}
