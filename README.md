# MeetHub

MeetHub is an Expo SDK 54 / React Native app with Firebase email and Google authentication, Firestore-backed meeting records and chat, local schedule reminders, FCM device-token registration, and native WebRTC audio/video with Firestore signaling.

## Requirements

- Node.js 20 or newer and npm
- Android Studio with the Android SDK and an Android emulator, or a USB-debuggable Android phone
- A Firebase project with Authentication (Email/Password and Google), Cloud Firestore, and Cloud Messaging enabled
- An Expo account and EAS CLI for Android development builds

This app **cannot run as a call app in Expo Go**. `react-native-webrtc`, native camera/microphone access, Android screen capture and remote push require the custom development build.

## Install and configure

```bash
npm install
npx expo install @react-native-async-storage/async-storage expo-notifications expo-device expo-clipboard expo-sharing expo-dev-client @react-native-community/datetimepicker expo-auth-session expo-crypto
npx expo install react-native-webrtc@124.0.6 @config-plugins/react-native-webrtc@13.0.0
npm install firebase
Copy-Item .env.example .env
```

Fill `.env` with the Firebase **Web app** config values. Firebase client config values are public app identifiers, not server secrets; never put service-account credentials in the app. Add Android/iOS Google OAuth client IDs to enable Google sign-in. The callback scheme is `meethub`; add the matching redirect URI and Android package (`com.meethub.app`) to your OAuth configuration.

In Firebase Console:

1. Create a Firebase project and register an Android app with package `com.meethub.app`.
2. Download `google-services.json` to the repository root (it is git-ignored). Configure EAS with this file and set `expo.android.googleServicesFile` in `app.json` before building.
3. Enable Email/Password and Google under Authentication → Sign-in method.
4. Create Firestore and deploy the included security policy and indexes: `firebase deploy --only firestore:rules,firestore:indexes`.
5. Add authorized OAuth SHA-1 fingerprints for the debug/EAS signing certificates to the Android OAuth client.

For Google OAuth, create Android and Web OAuth client IDs and set the corresponding `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values. The Google button is disabled until a client ID is supplied.

## Run on Android

Install Android Studio, install an Android SDK/platform, create and boot an emulator, then from this folder:

```bash
npx expo start --dev-client
```

For a local development build, keep Android Studio/SDK and Java 17 available:

```bash
npx expo run:android
```

Or build an installable development APK with EAS:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
```

Install the resulting APK on an emulator or physical phone, then run the Metro command above. For a USB phone, enable Developer options → USB debugging and authorize the host computer. A physical device is recommended for camera, microphone, FCM and screen-sharing tests. After changing a config plugin, native permissions, package name, or Google services file, rebuild the development client.

## Calling, screen sharing, notifications

WebRTC uses a mesh (one peer connection per remote participant) with authenticated Firestore offer/answer/ICE signaling. The included public STUN server is suitable for development only. Add TURN URL, username and credential from a TURN provider to `.env` for reliable connections behind restrictive NATs and firewalls. Never use a long-lived TURN secret embedded in a production client; issue short-lived credentials from a trusted backend.

The screen-share config plugin enables the WebRTC Android media-projection foreground service and manifest permissions; sharing is still subject to Android's system consent prompt and device/OS support. MeetHub does not record calls. Audio output uses the device's active WebRTC audio route; explicit speakerphone/Bluetooth routing controls are not included.

Scheduled reminders are local Android notifications. The app can register a native FCM token in the signed-in user's private `devices` subcollection when push is enabled. This archive does not include a `functions/` directory, so scheduled server-side reminder delivery is not deployable from this project alone. A Firebase Cloud Function must be added separately for remote push delivery. Include a valid `google-services.json` in the Android build.

## Data/security

Collections: `users`, `meetings`, nested meeting `participants`, `messages`, and `signaling`, plus `notifications`. Apply `firestore.rules` before using a production Firebase project. Meeting-code lookup is an authenticated point read; meeting listings, chat and signaling are restricted to meeting participants. Participant IDs are retained on meeting records for meeting history.

## Checks

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
```

The repository's Firebase environment and Android signing/Google-services credentials are intentionally not included. Until those project-specific values are configured and a native build is installed, live Firebase, calls and push-token registration cannot be exercised.
