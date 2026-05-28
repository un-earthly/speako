const STRIPE_SECRET_KEY = process.env.EXPO_PUBLIC_STRIPE_SECRET_KEY || '';

interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export async function createPaymentIntent(
  amount: number,
  currency: string,
): Promise<PaymentIntentResult | null> {
  if (!STRIPE_SECRET_KEY) {
    console.warn('[Stripe] No secret key configured');
    return null;
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: Math.round(amount * 100).toString(), // cents
        currency: currency.toLowerCase(),
        'automatic_payment_methods[enabled]': 'true',
      }).toString(),
    });

    const json = await response.json();

    if (json.error) {
      console.error('[Stripe] PaymentIntent error:', json.error);
      return null;
    }

    return {
      clientSecret: json.client_secret,
      paymentIntentId: json.id,
    };
  } catch (err) {
    console.error('[Stripe] Failed to create PaymentIntent:', err);
    return null;
  }
}
