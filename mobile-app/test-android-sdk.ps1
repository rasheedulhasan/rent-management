#!/usr/bin/env pwsh
<#
.SYNOPSIS
Test Android SDK configuration for Rent Management Mobile app.
#>

Write-Host "=== Android SDK Configuration Test ===" -ForegroundColor Cyan
Write-Host ""

# Check Java
Write-Host "Checking Java..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1
    Write-Host "[OK] Java is installed" -ForegroundColor Green
    if ($env:JAVA_HOME) {
        Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Gray
    }
} catch {
    Write-Host "[WARNING] Java not found in PATH" -ForegroundColor Yellow
}

# Check Android SDK
Write-Host "`nChecking Android SDK..." -ForegroundColor Yellow
$sdkFound = $false
$sdkPath = $null

if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    $sdkPath = $env:ANDROID_HOME
    $sdkFound = $true
    Write-Host "[OK] ANDROID_HOME is set: $sdkPath" -ForegroundColor Green
} elseif ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
    $sdkPath = $env:ANDROID_SDK_ROOT
    $sdkFound = $true
    Write-Host "[OK] ANDROID_SDK_ROOT is set: $sdkPath" -ForegroundColor Green
} else {
    # Check common locations
    $commonPaths = @(
        "${env:USERPROFILE}\AppData\Local\Android\Sdk",
        "C:\Android\Sdk",
        "C:\Program Files\Android\Android Studio\Sdk",
        "${env:USERPROFILE}\AppData\Local\Android\android-sdk"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $sdkPath = $path
            $sdkFound = $true
            Write-Host "[OK] Found Android SDK at: $path" -ForegroundColor Green
            break
        }
    }
    
    if (-not $sdkFound) {
        Write-Host "[ERROR] Android SDK not found!" -ForegroundColor Red
        Write-Host "`nPlease install Android Studio or set ANDROID_HOME environment variable." -ForegroundColor Yellow
        Write-Host "Common installation locations:" -ForegroundColor Gray
        Write-Host "  - ${env:USERPROFILE}\AppData\Local\Android\Sdk" -ForegroundColor Gray
        Write-Host "  - C:\Android\Sdk" -ForegroundColor Gray
        Write-Host "`nYou can set it temporarily with:" -ForegroundColor Gray
        Write-Host "  `$env:ANDROID_HOME = 'C:\Users\oromu\AppData\Local\Android\Sdk'" -ForegroundColor Gray
    }
}

# Check local.properties
Write-Host "`nChecking local.properties..." -ForegroundColor Yellow
$localPropsPath = "android\local.properties"
if (Test-Path $localPropsPath) {
    Write-Host "[OK] local.properties exists" -ForegroundColor Green
    Get-Content $localPropsPath | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
} else {
    Write-Host "[WARNING] local.properties not found" -ForegroundColor Yellow
    if ($sdkPath) {
        Write-Host "Creating local.properties with sdk.dir=$sdkPath" -ForegroundColor Green
        "sdk.dir=$sdkPath" | Out-File -FilePath $localPropsPath -Encoding UTF8
    }
}

# Check Gradle wrapper
Write-Host "`nChecking Gradle..." -ForegroundColor Yellow
if (Test-Path "gradlew") {
    Write-Host "[OK] Gradle wrapper exists" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Gradle wrapper not found in current directory" -ForegroundColor Yellow
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
if ($sdkFound) {
    Write-Host "Android SDK configuration appears valid." -ForegroundColor Green
    Write-Host "You can try building with: .\build-apk.ps1 -LocalBuild" -ForegroundColor Cyan
} else {
    Write-Host "Android SDK configuration needs attention." -ForegroundColor Red
}