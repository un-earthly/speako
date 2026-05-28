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
 * Handles Payment Links (checkout.session.completed) and PaymentIntents.
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

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.client_reference_id;
      const plan = extractPlanFromSession(session);

      if (uid) {
        await activatePremium(uid, plan);
        await recordPayment(uid, {
          type: 'subscription',
          plan: plan.plan,
          currency: session.currency?.toUpperCase() || 'USD',
          amount: session.amount_total ?? 0,
          stripePaymentIntentId: session.payment_intent as string,
        });
        console.log('[Stripe] Premium activated via Payment Link for user:', uid);
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const uid = paymentIntent.metadata?.firebaseUserId;

      if (uid) {
        await activatePremium(uid, { plan: 'monthly' });
        await recordPayment(uid, {
          type: 'subscription',
          plan: 'monthly',
          currency: paymentIntent.currency.toUpperCase(),
          amount: paymentIntent.amount,
          stripePaymentIntentId: paymentIntent.id,
        });
        console.log('[Stripe] Premium activated via PaymentIntent for user:', uid);
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.error('[Stripe] Payment failed:', paymentIntent.id, paymentIntent.last_payment_error?.message);
    }
  } catch (err: any) {
    console.error('[Stripe] Webhook processing error:', err.message);
    // Return 200 so Stripe doesn't retry indefinitely for non-recoverable errors
    // But log it so we can investigate
  }

  res.json({ received: true });
});

interface PlanInfo {
  plan: 'monthly' | 'yearly';
}

function extractPlanFromSession(session: Stripe.Checkout.Session): PlanInfo {
  // Try to infer plan from line items or metadata
  const metadata = session.metadata || {};
  if (metadata.plan === 'yearly') return { plan: 'yearly' };
  if (metadata.plan === 'monthly') return { plan: 'monthly' };
  // Default to monthly if we can't tell
  return { plan: 'monthly' };
}

async function activatePremium(uid: string, plan: PlanInfo) {
  const days = plan.plan === 'yearly' ? 365 : 30;
  const expiry = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  );

  await admin.firestore().doc(`users/${uid}`).update({
    subscriptionTier: 'premium',
    subscriptionExpiry: expiry,
  });
}

interface PaymentRecord {
  type: 'subscription' | 'one_time';
  plan: string;
  currency: string;
  amount: number;
  stripePaymentIntentId: string;
}

async function recordPayment(uid: string, payment: PaymentRecord) {
  await admin.firestore().collection(`users/${uid}/payments`).add({
    ...payment,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
