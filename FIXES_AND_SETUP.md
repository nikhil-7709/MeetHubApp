# MeetHub — repair notes and setup

## Repairs made in this copy

1. **Firebase placeholder detection:** the sample values in `.env.example` no longer count as a valid Firebase configuration. Without this check, the app tried to initialize Firebase with fake values.
2. **Firestore meeting updates:** the included security rules now allow the meeting host to finish a meeting while writing `endedAt` and `durationSeconds`, and allow the join flow to set `startedAt`. The previous rules rejected those legitimate writes.
3. **Documentation accuracy:** clarified that this archive does not contain a `functions/` directory, so server-side scheduled push delivery cannot be deployed from this archive as-is.
4. **Clean archive:** generated without Git history, Expo cache, or `node_modules`.

## Windows setup (PowerShell)

Run these commands in the project folder (the folder containing `package.json`):

```powershell
node --version
npm --version
npm install
Copy-Item .env.example .env
```

Open `.env` and replace every Firebase placeholder with the values from Firebase Console → Project settings → Your apps → Web app. Do not leave values such as `your-project-id` or `replace-with-firebase-web-api-key` in place.

In Firebase Console:

1. Enable **Authentication → Email/Password** (and Google only if you have configured OAuth IDs).
2. Create a **Cloud Firestore** database.
3. In project root, deploy the included rules: `npx firebase-tools@latest deploy --only firestore:rules` (requires Firebase CLI login and a configured Firebase project).
4. Register the Android app using package ID `com.meethub.app`; place the matching `google-services.json` in the project root and configure `android.googleServicesFile` in `app.json` if you use native Firebase/FCM configuration.

Then run checks:

```powershell
npx expo install --fix
npx expo lint
npx tsc --noEmit
npx expo-doctor
```

Run on a development build (not Expo Go; this app uses native WebRTC):

```powershell
npx expo run:android
```

Or create an internal APK using EAS:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

## Important limitations

- The Firebase project values, OAuth client IDs, `google-services.json`, signing credentials, and TURN credentials are not supplied in the archive. Live authentication, database access, notifications, and reliable calls cannot be confirmed until you configure your own services.
- WebRTC calls may fail on some networks without a correctly configured TURN server. The public STUN server alone is not production-reliable.
- The source was reviewed and the repairs above were applied, but automated lint/type-check/build validation could not be completed in this environment because `npm install` timed out before dependencies were installed. Run the checks above on your Windows machine and share the full terminal output if any errors remain.
