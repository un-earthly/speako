/**
 * Cloudflare Worker — FCM V1 notification sender
 * Free tier: 100k requests/day, no credit card needed.
 *
 * Deploy:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. Set secret: wrangler secret put FCM_SERVICE_ACCOUNT_JSON
 *      (paste the full service account JSON when prompted)
 *   4. wrangler deploy
 *   5. Copy the worker URL to EXPO_PUBLIC_NOTIFY_URL in your .env
 *
 * Get the service account JSON from Firebase Console →
 *   Project Settings → Service Accounts → Generate new private key
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { token, title, body: msgBody, data } = body;
    if (!token || !title) {
      return new Response('Missing token or title', { status: 400 });
    }

    // Parse service account from secret
    const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
    const projectId = sa.project_id;

    // Get OAuth2 access token using JWT (service account)
    const accessToken = await getAccessToken(sa);

    // Send via FCM V1 API
    const fcmRes = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body: msgBody },
            data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
            android: { priority: 'HIGH' },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
      }
    );

    const result = await fcmRes.json();
    return new Response(JSON.stringify(result), {
      status: fcmRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

// Minimal JWT + OAuth2 for service accounts using Web Crypto API (built into Workers)
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${enc(header)}.${enc(claim)}`;

  const keyData = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsigned}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const { access_token } = await tokenRes.json();
  return access_token;
}
