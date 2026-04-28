# Android Build Fixes

## Issues Fixed

The Android APK build was failing with two main errors:

1. **SDK location not found** - `ANDROID_HOME` environment variable not set and `local.properties` missing
2. **Gradle property 'release' not found** - Android Gradle Plugin version incompatible with Expo modules

## Changes Made

### 1. Updated Android Gradle Plugin Version
- File: `android/build.gradle`
- Changed: `classpath('com.android.tools.build:gradle')` → `classpath('com.android.tools.build:gradle:8.3.0')`
- Reason: AGP 8.3.0 supports `components.release` property required by ExpoModulesCorePlugin

### 2. Enhanced Build Script
- File: `build-apk.ps1`
- Added: Android SDK detection and automatic configuration
- Added: Automatic creation/update of `local.properties` with correct SDK path
- Added: Better error messages and fallback paths

### 3. Created Local Properties Template
- File: `android/local.properties`
- Created with placeholder SDK path that will be updated by build script

### 4. Added Diagnostic Tool
- File: `test-android-sdk.ps1`
- Helps verify Android SDK configuration before building

## Next Steps

### Option A: Build with Fixed Script
1. Open PowerShell in the `mobile-app` directory
2. Run the diagnostic tool first:
   ```powershell
   .\test-android-sdk.ps1
   ```
3. If Android SDK is found, run the build:
   ```powershell
   .\build-apk.ps1 -LocalBuild
   ```

### Option B: Manual Configuration
If you need to manually set Android SDK path:

1. Find your Android SDK installation path (usually in `%USERPROFILE%\AppData\Local\Android\Sdk`)
2. Set environment variable (temporarily):
   ```powershell
   $env:ANDROID_HOME = "C:\Users\oromu\AppData\Local\Android\Sdk"
   ```
3. Or update `android/local.properties` directly:
   ```
   sdk.dir=C:\\Users\\oromu\\AppData\\Local\\Android\\Sdk
   ```

### Option C: Use EAS Cloud Build
If local build continues to fail, use cloud build (no Android SDK required):
```powershell
.\build-apk.ps1  # Without -LocalBuild flag
```

## Common Issues & Solutions

### Android SDK Not Installed
- Install [Android Studio](https://developer.android.com/studio)
- During installation, ensure "Android SDK" is selected
- Or install SDK command-line tools only

### Java Version Issues
- Required: Java JDK 11 or 17
- Recommended: [Eclipse Temurin JDK 17](https://adoptium.net/temurin/releases/)
- Set `JAVA_HOME` environment variable

### Gradle Build Still Fails
- Clear Gradle cache: `cd android && .\gradlew clean`
- Delete `android/.gradle` directory and try again
- Update Expo: `npx expo install --fix`

## Verification

To verify the fixes work:

1. The build should no longer show "SDK location not found" error
2. The "Could not get unknown property 'release'" error should be resolved
3. Build should progress to compiling and generating APK

## New Fix for Expo Modules Core Issue

If you're still experiencing the "Could not get unknown property 'release'" error after applying the above fixes, use the new fix script:

```powershell
.\fix-expo-build.ps1
```

This script applies a temporary patch to `expo-modules-core` to handle the missing `components.release` property.

## Quick Start Guide

### For Local Build (requires Android SDK)
1. Install Android Studio and ensure Android SDK is installed
2. Set `ANDROID_HOME` environment variable
3. Run diagnostic: `.\test-android-sdk.ps1`
4. Apply Expo fix if needed: `.\fix-expo-build.ps1`
5. Build: `.\build-apk.ps1 -LocalBuild`

### For Cloud Build (no Android SDK required)
1. Ensure you're logged in to Expo: `npx eas login`
2. Build: `.\build-apk.ps1`
   - This uses EAS cloud build (takes 10-20 minutes)
   - APK will be available for download from Expo dashboard

## Troubleshooting

### Android SDK Not Found
- The build script now checks if Android SDK actually exists
- If not found, it will exit with clear instructions
- Install Android SDK or use cloud build

### Expo Modules Compatibility
- The fix script modifies the Gradle plugin to be compatible with Android Gradle Plugin 8.3.0
- If the fix doesn't work, try downgrading AGP to 8.1.0 in `android/build.gradle`

### Still Having Issues?
Consider using EAS cloud build which handles all dependencies in the cloud and is more reliable for most users.
If issues persist, check the [Expo documentation](https://docs.expo.dev/build-reference/local-builds/) for local builds.