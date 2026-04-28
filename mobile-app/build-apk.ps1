#!/usr/bin/env pwsh
<#
.SYNOPSIS
Build APK for Rent Management Mobile App using EAS Build or local Android build.

.DESCRIPTION
This script helps generate an APK via Expo Application Services (EAS) cloud build
or via local Android SDK. It checks for prerequisites, logs in to EAS (optional),
and starts the build.

.PARAMETER Profile
Build profile to use: preview (default) or production (EAS only)

.PARAMETER Platform
Platform to build for: android (default) or ios (EAS only)

.PARAMETER SkipLogin
Skip EAS login check and attempt build anyway (may fail if not authenticated)

.PARAMETER LocalBuild
Use local Android SDK to build APK instead of EAS cloud build

.PARAMETER ExpoToken
Expo token for non‑interactive login (environment variable EXPO_TOKEN also works)

.EXAMPLE
.\build-apk.ps1
.\build-apk.ps1 -Profile production
.\build-apk.ps1 -SkipLogin
.\build-apk.ps1 -LocalBuild
.\build-apk.ps1 -ExpoToken "your-token-here"
#>

param(
    [string]$Profile = "preview",
    [string]$Platform = "android",
    [switch]$SkipLogin,
    [switch]$LocalBuild,
    [string]$ExpoToken
)

Write-Host "=== Rent Management Mobile APK Generator ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js is not installed. Please install Node.js v18 or later." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow
$npmVersion = npm --version 2>$null
if (-not $npmVersion) {
    Write-Host "ERROR: npm is not installed." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] npm $npmVersion" -ForegroundColor Green

# Check EAS CLI
Write-Host "Checking EAS CLI..." -ForegroundColor Yellow
$easVersion = npx eas --version 2>$null
if (-not $easVersion) {
    Write-Host "EAS CLI not found. Installing globally..." -ForegroundColor Yellow
    npm install -g eas-cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install EAS CLI." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] EAS CLI installed" -ForegroundColor Green
} else {
    Write-Host "[OK] EAS CLI $easVersion" -ForegroundColor Green
}

# Determine if we need EAS login
$useEas = -not $LocalBuild
$loggedIn = $false

if ($useEas) {
    Write-Host "Checking EAS login status..." -ForegroundColor Yellow
    $whoami = npx eas whoami 2>&1
    if ($whoami -like "*Not logged in*" -or $whoami -like "*Error*") {
        # Not logged in
        $token = if ($ExpoToken) { $ExpoToken } else { $env:EXPO_TOKEN }
        if ($token) {
            Write-Host "Logging in with Expo token..." -ForegroundColor Yellow
            $env:EXPO_TOKEN = $token
            npx eas login --token $token
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Logged in with token" -ForegroundColor Green
                $loggedIn = $true
            } else {
                Write-Host "WARNING: Token login failed. Continuing without login." -ForegroundColor Yellow
            }
        }
        
        if (-not $loggedIn) {
            if ($SkipLogin) {
                Write-Host "Skipping login (--SkipLogin). Build may fail if authentication is required." -ForegroundColor Yellow
            } else {
                Write-Host "You are not logged in to EAS." -ForegroundColor Yellow
                Write-Host "Please log in using your Expo account." -ForegroundColor Yellow
                Write-Host "If you don't have an account, create one at https://expo.dev" -ForegroundColor Yellow
                Write-Host ""
                $choice = Read-Host "Do you want to log in now? (y/n)"
                if ($choice -eq 'y' -or $choice -eq 'Y') {
                    npx eas login
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "ERROR: Login failed." -ForegroundColor Red
                        exit 1
                    }
                    $loggedIn = $true
                } else {
                    Write-Host "You can log in manually later with 'eas login'" -ForegroundColor Yellow
                    Write-Host "Exiting." -ForegroundColor Red
                    exit 0
                }
            }
        }
    } else {
        Write-Host "[OK] Logged in to EAS" -ForegroundColor Green
        $loggedIn = $true
    }
}

# Check eas.json
if (-not (Test-Path "eas.json")) {
    Write-Host "WARNING: eas.json not found. Creating default configuration..." -ForegroundColor Yellow
    @'
{
  "cli": {
    "version": ">= 18.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
'@ | Out-File -FilePath "eas.json" -Encoding UTF8
    Write-Host "[OK] Created eas.json" -ForegroundColor Green
}

# Start build
Write-Host ""
if ($LocalBuild) {
    Write-Host "Starting LOCAL Android build (requires Android SDK)..." -ForegroundColor Cyan
    Write-Host "This will generate APK locally (release variant)." -ForegroundColor Yellow
    Write-Host ""

    # Check Java installation
    Write-Host "Checking Java installation..." -ForegroundColor Yellow
    $javaExists = $false
    try {
        $null = Get-Command java -ErrorAction Stop
        $javaExists = $true
    } catch {
        $javaExists = $false
    }
    
    if (-not $javaExists) {
        Write-Host "ERROR: Java is not installed or not in PATH." -ForegroundColor Red
        Write-Host ""
        Write-Host "To build Android APK locally, you need:" -ForegroundColor Yellow
        Write-Host "1. Java JDK 11 or 17 (recommended: Amazon Corretto 11)" -ForegroundColor Yellow
        Write-Host "2. Android SDK with build-tools and platform-tools" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Quick fix options:" -ForegroundColor Cyan
        Write-Host "A) Install Java from https://adoptium.net/temurin/releases/" -ForegroundColor Cyan
        Write-Host "B) Use EAS cloud build instead (remove -LocalBuild flag)" -ForegroundColor Cyan
        Write-Host "C) Set JAVA_HOME manually and add to PATH" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Example to set JAVA_HOME temporarily:" -ForegroundColor Gray
        Write-Host "  `$env:JAVA_HOME = 'C:\Program Files\Java\jdk-11.0.22'" -ForegroundColor Gray
        Write-Host "  `$env:PATH = `"`$env:JAVA_HOME\bin;`$env:PATH`"" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
    
    # Verify Java works
    $javaVersion = java -version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Java found but version check failed." -ForegroundColor Yellow
    }
    Write-Host "[OK] Java installed" -ForegroundColor Green

    # Check JAVA_HOME environment variable
    if (-not $env:JAVA_HOME) {
        Write-Host "WARNING: JAVA_HOME environment variable is not set." -ForegroundColor Yellow
        Write-Host "This may cause Gradle build issues. Setting JAVA_HOME automatically..." -ForegroundColor Yellow
        
        # Try to find Java installation path
        $javaPath = $null
        try {
            $javaPath = (Get-Command java -ErrorAction Stop).Source
        } catch {
            Write-Host "Could not get Java path from command." -ForegroundColor Yellow
        }
        
        if ($javaPath) {
            $javaHome = Split-Path (Split-Path $javaPath)
            $env:JAVA_HOME = $javaHome
            Write-Host "Set JAVA_HOME to: $javaHome" -ForegroundColor Green
        } else {
            Write-Host "Could not automatically determine JAVA_HOME." -ForegroundColor Yellow
            Write-Host "Please set it manually before running the build." -ForegroundColor Yellow
            Write-Host "You can set it temporarily with:" -ForegroundColor Gray
            Write-Host "  `$env:JAVA_HOME = 'C:\Program Files\Java\jdk-11.0.22'" -ForegroundColor Gray
        }
    } else {
        Write-Host "[OK] JAVA_HOME is set to: $env:JAVA_HOME" -ForegroundColor Green
    }

    # Check ANDROID_HOME / Android SDK
    Write-Host "Checking Android SDK..." -ForegroundColor Yellow
    $androidSdkPath = $null
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        $androidSdkPath = $env:ANDROID_HOME
        Write-Host "[OK] ANDROID_HOME is set to: $androidSdkPath" -ForegroundColor Green
    } elseif ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
        $androidSdkPath = $env:ANDROID_SDK_ROOT
        Write-Host "[OK] ANDROID_SDK_ROOT is set to: $androidSdkPath" -ForegroundColor Green
    } else {
        # Try common Android SDK locations on Windows
        $commonPaths = @(
            "${env:USERPROFILE}\AppData\Local\Android\Sdk",
            "C:\Android\Sdk",
            "C:\Program Files\Android\Android Studio\Sdk",
            "${env:USERPROFILE}\AppData\Local\Android\android-sdk"
        )
        foreach ($path in $commonPaths) {
            if (Test-Path $path) {
                $androidSdkPath = $path
                Write-Host "Found Android SDK at: $path" -ForegroundColor Green
                break
            }
        }
        
        if (-not $androidSdkPath) {
            Write-Host "ERROR: Android SDK not found." -ForegroundColor Red
            Write-Host "Please install Android Studio or set ANDROID_HOME environment variable." -ForegroundColor Yellow
            Write-Host "You can set it temporarily with:" -ForegroundColor Gray
            Write-Host "  `$env:ANDROID_HOME = 'C:\Users\oromu\AppData\Local\Android\Sdk'" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Since Android SDK is not available, you have two options:" -ForegroundColor Cyan
            Write-Host "1. Install Android SDK and try again" -ForegroundColor Cyan
            Write-Host "2. Use EAS cloud build (recommended) - remove -LocalBuild flag" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "To use EAS cloud build instead, run:" -ForegroundColor Green
            Write-Host "  .\build-apk.ps1  # without -LocalBuild" -ForegroundColor Green
            Write-Host ""
            Write-Host "Exiting local build." -ForegroundColor Red
            exit 1
        }
    }
    
    # Verify Android SDK path actually exists
    if (-not (Test-Path $androidSdkPath)) {
        Write-Host "ERROR: Android SDK path does not exist: $androidSdkPath" -ForegroundColor Red
        Write-Host "Please install Android Studio or update the SDK path." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To use EAS cloud build instead (no Android SDK required), run:" -ForegroundColor Green
        Write-Host "  .\build-apk.ps1  # without -LocalBuild" -ForegroundColor Green
        Write-Host ""
        exit 1
    }
    
    # Ensure local.properties has correct SDK path
    $localPropsPath = "android\local.properties"
    if (Test-Path $localPropsPath) {
        $content = Get-Content $localPropsPath -Raw
        if ($content -notmatch "sdk\.dir") {
            Add-Content -Path $localPropsPath -Value "`nsdk.dir=$androidSdkPath"
            Write-Host "Added sdk.dir to local.properties" -ForegroundColor Green
        } else {
            # Update existing sdk.dir
            $newContent = $content -replace "sdk\.dir=.*", "sdk.dir=$androidSdkPath"
            Set-Content -Path $localPropsPath -Value $newContent -NoNewline
            Write-Host "Updated sdk.dir in local.properties" -ForegroundColor Green
        }
    } else {
        # Create local.properties
        "sdk.dir=$androidSdkPath" | Out-File -FilePath $localPropsPath -Encoding UTF8
        Write-Host "Created local.properties with sdk.dir" -ForegroundColor Green
    }

    # Ensure dependencies
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: npm install failed." -ForegroundColor Red
        exit 1
    }

    # Prebuild Android native code
    Write-Host "Generating Android native code..." -ForegroundColor Yellow
    npx expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: expo prebuild failed." -ForegroundColor Red
        exit 1
    }

    # Build release APK
    Write-Host "Building release APK with Gradle..." -ForegroundColor Yellow
    cd android
    ./gradlew assembleRelease
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Gradle build failed." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "[OK] Local build completed successfully!" -ForegroundColor Green
    Write-Host "APK location: android/app/build/outputs/apk/release/app-release.apk" -ForegroundColor Cyan
} else {
    Write-Host "Starting EAS build for $Platform with profile '$Profile'..." -ForegroundColor Cyan
    Write-Host "This will take 10-20 minutes. The APK will be available for download." -ForegroundColor Yellow
    Write-Host ""

    $buildCommand = "npx eas build --platform $Platform --profile $Profile"
    Write-Host "Running: $buildCommand" -ForegroundColor Gray
    Invoke-Expression $buildCommand

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Build started successfully!" -ForegroundColor Green
        Write-Host "Check the Expo dashboard for build progress and download link." -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "[FAIL] Build failed. Check errors above." -ForegroundColor Red
        exit 1
    }
}