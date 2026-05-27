# Unbounded Translator — Project Context

> A real-time translation chatting app built with React Native (Expo) + Firebase.

---

## 1. App Overview

**Unbounded** is a mobile app that enables two people who speak different languages to have a seamless conversation. Each person selects their language, and all messages are automatically translated in real-time.

### Core Features
- **Auth Flow**: Splash → Sign Up / Log In / Forgot Password (with OTP) → Home
- **Language Setup**: Select your language + the other person's language, with voice verification
- **Real-time Chat**: Send text or voice messages, see translations instantly
- **Account Management**: Profile, history, password, language preference, theme toggle, logout
- **Ad Integration**: Banner ad placeholder on home screen

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native (Expo SDK 55) |
| Navigation | React Navigation v7 (Native Stack + Bottom Tabs) |
| State Management | React Context + Hooks |
| Backend | Firebase (Auth, Firestore, Storage) |
| Styling | React Native StyleSheet |
| Icons | `@expo/vector-icons` |
| Audio | `expo-av` (recording + playback) |
| Images | `expo-image-picker` (profile photos) |

---

## 3. Firebase Configuration

**Project ID**: `unbounded-4b73f`
**Services Initialized**:
- ✅ Authentication (Email/Password + Google Sign-In)
- ✅ Cloud Firestore (location: `nam5`)
- ✅ Cloud Storage

### Firestore Collections

```
users/{userId}
  - uid: string
  - email: string
  - displayName: string
  - photoURL: string
  - preferredLanguage: string (e.g., "en", "bn", "ar")
  - createdAt: timestamp

conversations/{conversationId}
  - participants: string[] (user UIDs)
  - participantLanguages: { [uid]: string }
  - createdAt: timestamp
  - updatedAt: timestamp
  - lastMessage: {
      text: string
      senderId: string
      timestamp: timestamp
    }

messages/{messageId}
  - conversationId: string
  - senderId: string
  - originalText: string
  - translatedText: string
  - sourceLanguage: string
  - targetLanguage: string
  - type: "text" | "voice"
  - audioURL: string (optional, for voice messages)
  - createdAt: timestamp

translations/{translationId}
  - originalText: string
  - translatedText: string
  - sourceLanguage: string
  - targetLanguage: string
  - createdAt: timestamp
  - userId: string
```

### Storage Buckets
- `users/{userId}/profile.jpg` — Profile photos
- `voice-messages/{conversationId}/{messageId}.m4a` — Voice recordings

---

## 4. App Architecture

### Directory Structure

```
src/
├── App.tsx                    # Root component (theme, splash, linking)
├── index.tsx                  # Entry point
├── types.d.ts                 # Global type declarations
├── assets/                    # Static images
├── config/
│   └── firebase.ts            # Firebase app initialization
├── contexts/
│   ├── AuthContext.tsx        # Auth state & user management
│   ├── ThemeContext.tsx       # Light/Dark theme toggle
│   └── TranslationContext.tsx # Active translation session
├── navigation/
│   ├── index.tsx              # Root navigator (Auth + App stacks)
│   ├── AuthNavigator.tsx      # Auth flow screens
│   └── AppNavigator.tsx       # Main app tabs + modals
├── screens/
│   ├── auth/
│   │   ├── SplashScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── SignUpScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   └── OTPScreen.tsx
│   ├── home/
│   │   └── HomeScreen.tsx
│   ├── conversation/
│   │   └── ConversationScreen.tsx
│   └── account/
│       ├── AccountScreen.tsx
│       ├── PersonalInfoScreen.tsx
│       ├── HistoryScreen.tsx
│       ├── ChangePasswordScreen.tsx
│       ├── ChangeLanguageScreen.tsx
│       └── ChangeThemeScreen.tsx
├── components/
│   ├── common/                # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── LanguagePicker.tsx
│   │   └── Avatar.tsx
│   └── chat/                  # Chat-specific components
│       ├── MessageBubble.tsx
│       ├── ChatInput.tsx
│       └── VoiceRecorder.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useFirestore.ts
│   └── useStorage.ts
├── services/
│   ├── auth.ts
│   ├── firestore.ts
│   ├── storage.ts
│   └── translation.ts         # Translation API integration
├── constants/
│   ├── languages.ts           # Supported languages list
│   ├── colors.ts              # Theme colors
│   └── routes.ts              # Route names
└── utils/
    ├── validators.ts          # Form validation
    └── formatters.ts          # Date/text formatting
```

### Navigation Flow

```
Auth Stack (not authenticated)
├── SplashScreen
├── LoginScreen
├── SignUpScreen
├── ForgotPasswordScreen
└── OTPScreen

App Stack (authenticated)
├── MainTabs
│   ├── HomeTab (HomeScreen)
│   └── AccountTab (AccountScreen)
├── ConversationScreen (modal/push)
├── PersonalInfoScreen
├── HistoryScreen
├── ChangePasswordScreen
├── ChangeLanguageScreen
└── ChangeThemeScreen
```

---

## 5. Design System (from Figma)

### Colors
- **Primary Blue**: `#007AFF` (buttons, active states)
- **Background Light**: `#FFFFFF`
- **Background Dark**: `#1C1C1E`
- **Surface Light**: `#F2F2F7`
- **Surface Dark**: `#2C2C2E`
- **Text Primary**: `#000000` (light) / `#FFFFFF` (dark)
- **Text Secondary**: `#8E8E93`
- **Success Green**: `#34C759`
- **Danger Red**: `#FF3B30`

### Typography
- **Headings**: SF Pro Display / System Bold, 20–28px
- **Body**: SF Pro Text / System Regular, 16px
- **Captions**: 12–14px, secondary color

### Spacing
- Base unit: 8px
- Screen padding: 16–20px
- Card border radius: 12px
- Button border radius: 24px (pill shape)

---

## 6. Supported Languages

Based on the Figma screens, supported languages include:
- English (en)
- Bangla / Bengali (bn)
- Arabic (ar)
- Bahasa Indonesia (id)
- Simplified Chinese (zh)
- Korean (ko)
- Japanese (ja)
- Albanian (sq)
- Amharic (am)
- Armenian (hy)
- Azerbaijani (az)
- Belarusian (be)
- Bulgarian (bg)

*(Expandable list stored in `constants/languages.ts`)*

---

## 7. Key Behaviors

### Auth
- Sign up with email + password
- Log in with email + password
- Social login: Google, Apple
- Forgot password flow: Email → OTP → Reset → Success
- Persistent session via Firebase Auth state listener

### Home / Translation Setup
- Dropdown selectors for "Your Language" and "Other Person's Language"
- After selection, show voice verification prompt
- Microphone button to record a test phrase
- "Start Conversation" button creates a new Firestore `conversation` doc

### Conversation
- Real-time message sync via Firestore `onSnapshot`
- Messages show:
  - Sender avatar
  - Original text
  - Translated text below
  - Copy icon
  - Audio play icon (for voice messages)
- Input bar: text keyboard + voice toggle + send button
- Language flags shown at top for both participants

### Account
- Profile section with avatar, name, email
- Navigation to: Personal Info, History, Change Password
- App settings: Preferred Language, Theme
- Logout with confirmation modal

---

## 8. Translation Strategy

For MVP, use a cloud translation API (e.g., Google Cloud Translation API, DeepL, or LibreTranslate). In production, this can be swapped for a custom backend or Firebase Extension.

### Flow
1. User sends message in Language A
2. App calls translation service: A → B
3. Stores both `originalText` and `translatedText` in Firestore
4. Other user sees message in Language B (with original available)

---

## 9. Next Steps

1. ✅ Firebase project initialized and deployed
2. ⬜ Install dependencies (`firebase`, `@expo/vector-icons`, `expo-av`, etc.)
3. ⬜ Set up Firebase config in app (`src/config/firebase.ts`)
4. ⬜ Implement AuthContext + Auth screens
5. ⬜ Implement Home screen with language selection
6. ⬜ Implement Conversation screen with Firestore sync
7. ⬜ Implement Account screens
8. ⬜ Add theme support (light/dark)
9. ⬜ Polish UI to match Figma

---

*Last updated: 2026-05-07*
