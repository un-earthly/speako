# Unbounded

A real-time translation chat app that lets two people speaking different languages have a seamless conversation. Each participant selects their language, and all messages are automatically translated as they are sent.

## Features

- **Real-time translated chat** — messages are stored with both the original and translated text via Firestore
- **Voice messages** — record and play back audio messages with transcription
- **Speech recognition** — tap-to-talk input using device speech recognition
- **Language detection** — automatically identifies the language being spoken
- **Auth** — email/password and Google sign-in, persistent sessions, forgot-password with OTP
- **Account management** — edit profile, change password, view chat history, set preferred language
- **Light/dark theme** — follows system preference with manual override

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo SDK 55) |
| Navigation | React Navigation v7 (Native Stack + Bottom Tabs) |
| Backend | Firebase (Auth, Firestore, Storage) |
| State | React Context + Hooks |
| Audio | `expo-audio`, `expo-speech-recognition` |
| Images | `expo-image-picker` |
| Icons | `@expo/vector-icons` |

## Project Structure

```
src/
├── App.tsx                  # Root component (theme, splash, deep linking)
├── config/firebase.ts       # Firebase initialization
├── contexts/                # Auth, Theme, Translation contexts
├── navigation/              # Root, Auth, and App navigators
├── screens/
│   ├── auth/                # Splash, Login, SignUp, ForgotPassword, OTP
│   ├── home/                # Language selection + start conversation
│   ├── conversation/        # Real-time chat screen
│   └── account/             # Profile, history, settings
├── components/
│   ├── common/              # Button, Input, LanguagePicker, Avatar
│   └── chat/                # MessageBubble, ChatInput, VoiceRecorder
├── services/                # Auth, Firestore, Storage, Translation API
├── hooks/                   # useAuth, useFirestore, useStorage
├── constants/               # Languages list, colors, route names
└── utils/                   # Validators, formatters
```

## Firestore Data Model

```
users/{userId}
conversations/{conversationId}
  └── messages/{messageId}   # originalText + translatedText per message
translations/{translationId}
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Android Studio or Xcode for native builds

### Setup

```sh
npm install
```

Create `src/config/firebase.ts` with your Firebase project credentials:

```ts
import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
};

export const app = initializeApp(firebaseConfig);
```

### Run

```sh
# Start dev server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

> This project uses a development build and **cannot** be run with Expo Go.

### Build (EAS)

```sh
# Preview build (internal distribution)
eas build --profile preview

# Production build
eas build --profile production
```

## Supported Languages

English, Bengali, Arabic, Bahasa Indonesia, Chinese (Simplified), Korean, Japanese, and more — full list in `src/constants/languages.ts`.

## Environment

- Bundle ID: `com.normod.unbounded`
- Firebase project: `unbounded-4b73f`
- EAS project: `d38bfccf-2b75-467b-889e-11a9a966a5c0`
