import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();

const stripeSecretKey = functions.config().stripe?.secret_key;
if (!stripeSecretKey) {
  console.warn('[Stripe] Secret key not configured. Set via: firebase functions:config:set stripe.secret_key="sk_..."');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' as any }) : null;

/**
 * Creates a Stripe PaymentIntent for a one-time purchase.
 * Called from the client before presenting the PaymentSheet.
 */
export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to make a payment.');
  }

  if (!stripe) {
    throw new functions.https.HttpsError('failed-precondition', 'Stripe is not configured on the server.');
  }

  const { amount, currency } = data;
  if (!amount || typeof amount !== 'number' || amount < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid amount.');
  }
  if (!currency || typeof currency !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid currency.');
  }

  const uid = context.auth.uid;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        firebaseUserId: uid,
        app: 'speako',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (err: any) {
    console.error('[Stripe] PaymentIntent creation failed:', err.message);
    throw new functions.https.HttpsError('internal', err.message);
  }
});

/**
 * Webhook handler for Stripe events.
 * Updates the user's subscription status in Firestore when payment succeeds.
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (!stripe) {
    res.status(500).send('Stripe not configured');
    return;
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = functions.config().stripe?.webhook_secret;

  if (!webhookSecret) {
    res.status(500).send('Webhook secret not configured');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe] Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const uid = paymentIntent.metadata?.firebaseUserId;

    if (uid) {
      await admin.firestore().doc(`users/${uid}`).update({
        subscriptionTier: 'premium',
        subscriptionExpiry: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ),
        lastPaymentIntentId: paymentIntent.id,
        lastPaymentAmount: paymentIntent.amount,
        lastPaymentCurrency: paymentIntent.currency,
      });
    }
  }

  res.json({ received: true });
});
