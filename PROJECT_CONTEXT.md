# Speako — Project Context

> A real-time translation chat app built with React Native (Expo) + Firebase.

---

## 1. App Overview

**Speako** enables people who speak different languages to communicate seamlessly. It supports two conversation modes:

- **Remote Chat** — Two users chat via Firestore real-time sync, each on their own device
- **Face-to-Face (Walkie-Talkie)** — Two people share one device, drag a mic slider toward their language and speak

### Core Features

| Feature | Description |
|---------|-------------|
| **Auth** | Email/Password, Google Sign-In |
| **Translation** | Real-time text/voice translation via Google Translate, DeepL, MyMemory, LibreTranslate |
| **AI Translation** | Premium feature using OpenAI for context-aware translations |
| **Points & Rewards** | Free-tier users earn points by watching ads; points are spent per message |
| **Referrals** | Users invite friends with referral codes; both get bonus points |
| **Premium Subscription** | Monthly/Yearly plans via Stripe; removes ads, unlimited messages, AI mode |
| **Ads** | Banner, Interstitial, Rewarded, and App-Open ads (Google Mobile Ads) |
| **Dark Mode** | System-aware light/dark theme |

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native (Expo SDK 52) |
| Navigation | React Navigation v7 (Native Stack + Bottom Tabs) |
| State Management | React Context + Hooks |
| Auth | Firebase Authentication |
| Database | Cloud Firestore |
| Payments | Stripe (Payment Links + PaymentIntents) |
| Ads | react-native-google-mobile-ads |
| Translation | Google Translate (unofficial), DeepL, MyMemory, LibreTranslate, OpenAI |
| Icons | `@expo/vector-icons` |
| Speech | `expo-speech` + `expo-speech-recognition` |

---

## 3. Firebase Configuration

**Project ID**: `speako-b701f`

### Firestore Collections

```
users/{userId}
  - uid: string
  - email: string
  - displayName: string
  - photoURL: string
  - preferredLanguage: string
  - phone: string | null
  - isDiscoverable: boolean
  - subscriptionTier: 'free' | 'premium'
  - subscriptionExpiry: Timestamp | null
  - points: number
  - adStreak: number
  - lastAdWatched: string (ISO)
  - aiConversationEnabled: boolean
  - aiConversationUnlocked: boolean
  - referralCode: string
  - referredBy: string | null
  - referralCount: number
  - referralPointsEarned: number
  - lastLoginDate: string (YYYY-MM-DD)
  - createdAt: timestamp

  subcollections:
    payments/{paymentId}
      - type: 'subscription' | 'one_time'
      - plan: 'monthly' | 'yearly'
      - currency: string
      - amount: number (cents)
      - stripePaymentIntentId: string
      - createdAt: serverTimestamp

    pointsHistory/{entryId}
      - type: 'earned' | 'spent'
      - amount: number
      - reason: string
      - balanceAfter: number
      - conversationId: string | null
      - createdAt: serverTimestamp

conversations/{conversationId}
  - participants: string[]
  - participantLanguages: { [uid]: string }
  - expectedOtherLanguage: string | null
  - inviteCode: string | null
  - status: 'waiting' | 'active'
  - mode: 'faceToFace' | undefined
  - createdBy: string
  - messageCount: number
  - createdAt: timestamp
  - updatedAt: timestamp
  - lastMessage: { text, senderId, timestamp }

messages/{messageId}
  - conversationId: string
  - senderId: string
  - originalText: string
  - translatedText: string
  - sourceLanguage: string
  - targetLanguage: string
  - type: 'text' | 'voice'
  - audioURL: string | null
  - createdAt: serverTimestamp

users/_referralIndex
  - codes: { [referralCode]: userId }
```

---

## 4. Directory Structure

```
src/
├── App.tsx                          # Root component (StripeProvider, linking, ErrorBoundary, ToastProvider)
├── index.tsx                        # Entry point
├── assets/                          # Static images
├── components/
│   ├── common/
│   │   ├── AdBanner.tsx             # Google banner ad (hidden for premium)
│   │   ├── Button.tsx
│   │   ├── ErrorBoundary.tsx        # App-wide error boundary
│   │   ├── FlagEmoji.tsx
│   │   ├── Input.tsx
│   │   ├── LanguagePickerModal.tsx
│   │   ├── LoadingOverlay.tsx       # Dark-mode aware loading modal
│   │   └── RewardModal.tsx          # Points reward animation modal
│   └── chat/
│       └── (no separate chat components — inline in screens)
├── config/
│   └── firebase.ts                  # Firebase app initialization
├── contexts/
│   ├── AuthContext.tsx              # Auth state, user doc sync, subscription status
│   ├── ThemeContext.tsx             # Light/Dark/System theme toggle
│   └── ToastContext.tsx             # Global toast notification system
├── hooks/
│   ├── useAppOpenAd.ts              # App-open ad with point reward
│   ├── useInterstitialAd.ts         # Interstitial ad (premium skip)
│   └── useRewardedAd.ts             # Rewarded ad for points
├── navigation/
│   ├── AuthNavigator.tsx            # Auth flow stack
│   ├── AppNavigator.tsx             # Main app stack (tabs + overlays)
│   └── TabNavigator.tsx             # Bottom tabs (Home, History, Account)
├── screens/
│   ├── auth/
│   │   ├── SplashScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── SignUpScreen.tsx
│   │   └── ForgotPasswordScreen.tsx
│   ├── home/
│   │   ├── HomeScreen.tsx           # Recent conversations, quick actions
│   │   ├── FindPersonScreen.tsx     # Search by email/phone, start chat
│   │   └── VoiceVerificationScreen.tsx
│   ├── conversation/
│   │   ├── ConversationScreen.tsx   # Remote 1-to-1 chat (text/voice, points, ads)
│   │   ├── FaceToFaceScreen.tsx     # Walkie-talkie slider mode
│   │   ├── JoinScreen.tsx           # Enter invite code
│   │   └── WaitingScreen.tsx        # Host waiting room
│   └── account/
│       ├── AccountScreen.tsx        # Profile, menu, referral, AI toggle
│       ├── EditProfileScreen.tsx    # Edit name, phone, discoverable
│       ├── ConversationHistoryScreen.tsx  # Conversation list, swipe-to-delete
│       ├── ChangePasswordScreen.tsx
│       ├── ChangeLanguageScreen.tsx
│       ├── ChangeThemeScreen.tsx
│       ├── SubscribeScreen.tsx      # Stripe payment link checkout
│       └── ManageSubscriptionScreen.tsx   # View/cancel premium
├── services/
│   ├── firestore.ts                 # CRUD + subscriptions for conversations/messages
│   ├── translation.ts               # Multi-backend translation with fallback chain
│   ├── ai-translation.ts            # OpenAI translation
│   ├── rewards.ts                   # Points economy (earn/spend/history)
│   ├── referral.ts                  # Referral code generation & processing
│   ├── subscription.ts              # Premium status check
│   ├── stripe-payment.ts            # Client-side PaymentIntent via Firebase function
│   ├── language-detect.ts           # Fast script-based language detection
│   ├── spellcheck.ts                # LanguageTool integration
│   └── notifications.ts             # Push notification setup
├── constants/
│   ├── ads.ts                       # Ad unit IDs
│   ├── colors.ts                    # Theme colors (light + dark palettes)
│   ├── languages.ts                 # Supported languages list
│   ├── routes.ts                    # Route name constants
│   └── stripe-links.ts              # Stripe Payment Link URLs
└── utils/
    ├── date.ts                      # Date formatting, isSameDay
    └── points.ts                    # Tiered message cost calculator
```

---

## 5. Navigation Flow

```
Auth Stack (not authenticated)
├── SplashScreen
├── LoginScreen
├── SignUpScreen
└── ForgotPasswordScreen

App Stack (authenticated)
├── Tabs
│   ├── HomeTab (HomeScreen)
│   │   └── pushes: VoiceVerification, FindPerson, Waiting, Join,
│   │                Conversation, FaceToFace
│   ├── HistoryTab (ConversationHistoryScreen)
│   │   └── pushes: Conversation, FaceToFace, Waiting
│   └── AccountTab (AccountScreen)
│       └── pushes: EditProfile, ChangePassword, ChangeLanguage,
│                    ChangeTheme, Subscribe, ManageSubscription
└── Overlay Screens (full-screen over tabs)
    ├── ConversationScreen
    ├── FaceToFaceScreen
    ├── WaitingScreen
    ├── JoinScreen
    └── VoiceVerificationScreen
```

---

## 6. Points & Pricing Economy

### Earning Points
| Action | Points |
|--------|--------|
| Welcome bonus | 100 |
| Daily login | 10 |
| Watch startup ad | 25 |
| Watch rewarded ad | 50 + streak bonus (up to 150) |
| Refer a friend | 200 |
| Referred signup | 50 |

### Spending Points (per message)
| Messages Sent | Cost |
|---------------|------|
| 1–10 | 5 pts |
| 11–25 | 8 pts |
| 26–50 | 12 pts |
| 51+ | 20 pts |

Premium users pay **0 points** for unlimited messages.

---

## 7. Ad Strategy

| Ad Type | Placement | Reward |
|---------|-----------|--------|
| **Banner** | Home, History, Account, FindPerson, Conversation, FaceToFace, Settings screens | None |
| **App Open** | Cold start | 25 pts |
| **Interstitial** | Start conversation, leave conversation, delete conversation | None |
| **Rewarded** | Explicit "Watch Ad for Points" button, AI unlock, low-points banner | 50–150 pts |

All ads are hidden for premium users.

---

## 8. Payment Flow

```
User taps Subscribe
  → Select plan (monthly/yearly) + currency (AED/SAR/USD)
  → Open Stripe Payment Link with client_reference_id=uid
  → Stripe hosted checkout
      ├─ Success → redirect to /payment/success.html
      │            → deep-link speako://payment/success
      │            → SubscribeScreen polls Firestore for 10s
      │            → Webhook (if configured) auto-activates premium
      ├─ Cancel  → redirect to /payment/cancel.html
      └─ Error   → redirect to /payment/error.html
```

---

## 9. Key Behaviors

### Conversation Modes
- **Remote**: Created via invite code or direct search. Two users, two devices. Uses `ConversationScreen`.
- **Face-to-Face**: Created via "Talk" button on Home. One user, one device, two languages. Uses `FaceToFaceScreen` with drag-to-record slider.

### Translation Flow
1. User sends message (or speaks)
2. Source language is determined (explicit for remote, active-speaker side for face-to-face)
3. `translateText()` tries backends in order: AI (premium) → DeepL → Google → MyMemory → LibreTranslate
4. Both `originalText` and `translatedText` stored in Firestore
5. Recipient sees `translatedText` as primary, `originalText` as secondary

### Message Cost Deduction
- Both `ConversationScreen` and `FaceToFaceScreen` deduct points per message
- Cost increases with conversation length (tiered pricing)
- Deducted via Firestore transaction with audit trail to `pointsHistory`

---

## 10. Environment Variables

```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Stripe secret key is NOT in the client.** It lives in:
- `functions/src/index.ts` (Firebase Functions config)
- `supabase/functions/*/index.ts` (Supabase edge functions)

---

*Last updated: 2026-05-29*
