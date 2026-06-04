const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

initializeApp();

const gmailUser = defineString('GMAIL_USER');
const gmailPass = defineString('GMAIL_APP_PASSWORD');

// Salt prevents rainbow-table attacks on stored OTP hashes
const HASH_SALT = 'speako-otp-v1';

function hashOTP(otp, email) {
  return crypto.createHash('sha256').update(otp + email + HASH_SALT).digest('hex');
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

exports.sendOTP = onCall({ region: 'us-central1' }, async (request) => {
  const { email } = request.data;

  if (!email || typeof email !== 'string' || !/\S+@\S+\.\S+/.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }

  const db = getFirestore();
  const ref = db.collection('otpCodes').doc(email);

  // Rate-limit: one OTP per 60 seconds
  const existing = await ref.get();
  if (existing.exists) {
    const { createdAt } = existing.data();
    if (createdAt && Date.now() - createdAt < 60_000) {
      throw new HttpsError('resource-exhausted', 'Please wait before requesting another code.');
    }
  }

  const otp = generateOTP();

  await ref.set({
    otpHash: hashOTP(otp, email),
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    createdAt: Date.now(),
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser.value(), pass: gmailPass.value() },
  });

  await transporter.sendMail({
    from: `"Speako" <${gmailUser.value()}>`,
    to: email,
    subject: 'Your Speako verification code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px">
        <h2 style="color:#007AFF;margin-bottom:8px">Verify your email</h2>
        <p style="color:#444;margin-bottom:24px">Use the code below to sign in to Speako. It expires in 10 minutes.</p>
        <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#007AFF;
                    background:#F0F7FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          ${otp}
        </div>
        <p style="color:#999;font-size:13px">Never share this code with anyone. Speako staff will never ask for it.</p>
      </div>
    `,
  });

  return { success: true };
});

exports.verifyOTP = onCall({ region: 'us-central1' }, async (request) => {
  const { email, otp, displayName } = request.data;

  if (!email || !otp) {
    throw new HttpsError('invalid-argument', 'Email and code are required.');
  }

  const db = getFirestore();
  const ref = db.collection('otpCodes').doc(email);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new HttpsError('not-found', 'No code found. Please request a new one.');
  }

  const { otpHash, expiresAt, attempts } = doc.data();

  if (attempts >= 5) {
    await ref.delete();
    throw new HttpsError('resource-exhausted', 'Too many failed attempts. Please request a new code.');
  }

  if (Date.now() > expiresAt) {
    await ref.delete();
    throw new HttpsError('deadline-exceeded', 'Code expired. Please request a new one.');
  }

  if (hashOTP(otp, email) !== otpHash) {
    await ref.update({ attempts: FieldValue.increment(1) });
    const remaining = 4 - attempts;
    throw new HttpsError(
      'invalid-argument',
      `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
    );
  }

  await ref.delete();

  // Get or create the Firebase Auth user
  const fbAuth = getAuth();
  let uid;

  try {
    const existing = await fbAuth.getUserByEmail(email);
    uid = existing.uid;
    if (displayName && !existing.displayName) {
      await fbAuth.updateUser(uid, { displayName, emailVerified: true });
    }
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      const created = await fbAuth.createUser({
        email,
        emailVerified: true,
        ...(displayName ? { displayName } : {}),
      });
      uid = created.uid;
    } else {
      throw e;
    }
  }

  const token = await fbAuth.createCustomToken(uid);
  return { token };
});
