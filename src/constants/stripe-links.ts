/**
 * Stripe Payment Link URLs.
 *
 * ═══════════════════════════════════════════════════════════════
 * SETUP INSTRUCTIONS:
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. Deploy the redirect pages:
 *    npx firebase deploy --only hosting --project speako-b701f
 *
 * 2. Go to https://dashboard.stripe.com/payment-links
 * 3. Create a product for each plan (Monthly, Yearly)
 *    - Name: "Speako Premium - Monthly"
 *    - Price: 19.99 AED (or equivalent in SAR/USD)
 * 4. For each Payment Link, set the redirect URLs to:
 *    - After payment  → https://speako-b701f.web.app/payment/success
 *    - If cancelled   → https://speako-b701f.web.app/payment/cancel
 * 5. Copy the Payment Link URL and paste it below
 *
 * When users pay, Stripe handles everything on their hosted page.
 * After payment, users are redirected back to the app.
 *
 * ═══════════════════════════════════════════════════════════════
 * PREMIUM ACTIVATION:
 * ═══════════════════════════════════════════════════════════════
 *
 * Without a backend webhook, premium activation is manual:
 * - Check Stripe Dashboard for successful payments
 * - Match payments to users via the client_reference_id (Firebase UID)
 * - Update the user's Firestore doc: subscriptionTier = 'premium'
 */

export const STRIPE_PAYMENT_LINKS: Record<string, string> = {
  // Monthly plans
  'monthly-aed': 'https://buy.stripe.com/test_aFa9AT0Tj0nr83w3M58ww00',
  'monthly-sar': 'https://buy.stripe.com/test_8x200j7hH9Y1dnQ96p8ww01',
  'monthly-usd': 'https://buy.stripe.com/test_fZu8wP31rfil0B4aat8ww02',

  // Yearly plans (add later)
  'yearly-aed': '',
  'yearly-sar': '',
  'yearly-usd': '',
};

/**
 * Build a Payment Link URL with the user's Firebase UID attached.
 * Stripe stores this in the payment metadata so you can match payments to users.
 */
export function buildPaymentLinkUrl(planKey: string, uid: string): string | null {
  const base = STRIPE_PAYMENT_LINKS[planKey];
  if (!base) return null;

  const url = new URL(base);
  url.searchParams.set('client_reference_id', uid);
  return url.toString();
}
