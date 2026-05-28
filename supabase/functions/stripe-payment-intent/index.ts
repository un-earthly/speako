import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@15.0.0?target=deno'

serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { amount, currency, uid } = await req.json()

    if (!amount || typeof amount !== 'number' || amount < 1) {
      return new Response(JSON.stringify({ error: 'Invalid amount' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!currency || typeof currency !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid currency' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!uid || typeof uid !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const stripe = new Stripe(stripeKey, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2024-04-10',
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        firebaseUserId: uid,
        app: 'speako',
      },
    })

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      }
    )
  } catch (err: any) {
    console.error('[Stripe] Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
