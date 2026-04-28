# Generating APK for Rent Management Mobile App

This guide provides steps to generate an APK for the Expo React Native app.

## Prerequisites

1. Node.js (v18 or later)
2. npm or yarn
3. Expo CLI (installed globally or via npx)

## Method 1: Using EAS Build (Recommended - Cloud Build)

EAS Build doesn't require Android SDK or Java installed locally. It builds in the cloud and provides download links.

### Steps:

1. **Install EAS CLI globally** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Log in to your Expo account**:
   ```bash
   eas login
   ```
   Follow the prompts to authenticate.

3. **Configure build profile** (already done in `eas.json`):
   - The `eas.json` file is already configured for Android APK builds.

4. **Start the build**:
   ```bash
   eas build --platform android --profile preview
   ```
   - This will create a preview build (APK) that you can share internally.
   - For production APK, use `--profile production`.

5. **Wait for build to complete**:
   - The build will run in Expo's cloud infrastructure (takes 10-20 minutes).
   - You'll get a link to download the APK when complete.

6. **Download the APK**:
   - Follow the link provided in the terminal or Expo dashboard.

## Method 2: Local Build (Requires Android SDK)

If you prefer to build locally, you need to set up the Android development environment.

### Setup Android SDK:

1. **Install Java JDK 11+**:
   - Download from [Adoptium](https://adoptium.net/) or Oracle
   - Set `JAVA_HOME` environment variable

2. **Install Android Studio** or command-line tools:
   - Download Android Studio from [developer.android.com](https://developer.android.com/studio)
   - Install Android SDK (API level 34), build tools, and platform tools
   - Set `ANDROID_HOME` environment variable

3. **Accept Android licenses**:
   ```bash
   %ANDROID_HOME%/tools/bin/sdkmanager --licenses
   ```

### Build APK:

1. **Ensure dependencies are installed**:
   ```bash
   cd mobile-app
   npm install
   ```

2. **Generate Android native code** (if needed):
   ```bash
   npx expo prebuild --platform android
   ```

3. **Build debug APK**:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
   - The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Build release APK**:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   - The APK will be at `android/app/build/outputs/apk/release/app-release.apk`
   - You may need to configure signing keys for release.

## Method 3: Using Expo Classic Build (Deprecated)

Expo's classic `expo build:android` is deprecated but may still work:

```bash
cd mobile-app
npx expo build:android
```

## Quick Script

For convenience, a PowerShell script `build-apk.ps1` is provided in this directory. Run it to attempt Method 1 (EAS Build).

## Troubleshooting

- **Android SDK not found**: Ensure `ANDROID_HOME` is set correctly
- **Java not found**: Install JDK and set `JAVA_HOME`
- **EAS login issues**: Create Expo account at https://expo.dev
- **Build errors**: Check Expo documentation or run with `--verbose` flag

## APK Location

After successful build:
- EAS Build: Download from provided URL
- Local debug: `mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`
- Local release: `mobile-app/android/app/build/outputs/apk/release/app-release.apk`