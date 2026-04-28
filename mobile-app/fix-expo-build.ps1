#!/usr/bin/env pwsh
<#
.SYNOPSIS
Apply temporary fixes for Expo Android build issues.
#>

Write-Host "=== Applying Expo Build Fixes ===" -ForegroundColor Cyan

$gradleFile = "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"
$backupFile = "$gradleFile.backup"

if (-not (Test-Path $gradleFile)) {
    Write-Host "ERROR: ExpoModulesCorePlugin.gradle not found at $gradleFile" -ForegroundColor Red
    Write-Host "Make sure you have run 'npm install' first." -ForegroundColor Yellow
    exit 1
}

# Create backup if not exists
if (-not (Test-Path $backupFile)) {
    Copy-Item $gradleFile $backupFile -Force
    Write-Host "Created backup at $backupFile" -ForegroundColor Green
}

# Read content
$content = Get-Content $gradleFile -Raw

# Fix: Replace 'from components.release' with safe check
# We need to find the exact pattern and replace it
$pattern = '(\s+)from components\.release'

if ($content -match $pattern) {
    # Replace with conditional check
    $replacement = '$1afterEvaluate {
$1            if (project.components.findByName("release")) {
$1                from components.release
$1            } else {
$1                from components.default
$1            }
$1        }'
    
    $newContent = $content -replace $pattern, $replacement
    
    Set-Content -Path $gradleFile -Value $newContent -NoNewline -Encoding UTF8
    Write-Host "Applied fix for 'components.release' issue" -ForegroundColor Green
    
    # Verify the change
    $verifyContent = Get-Content $gradleFile -Raw
    if ($verifyContent -match 'project\.components\.findByName\("release"\)') {
        Write-Host "Fix verified successfully." -ForegroundColor Green
    } else {
        Write-Host "Warning: Fix may not have been applied correctly." -ForegroundColor Yellow
    }
} else {
    # Check if already fixed
    if ($content -match 'project\.components\.findByName\("release"\)') {
        Write-Host "File already contains the fix." -ForegroundColor Green
    } else {
        Write-Host "Pattern not found. The file structure may have changed." -ForegroundColor Yellow
        Write-Host "Manual intervention may be required." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Fixes applied successfully." -ForegroundColor Green
Write-Host "You can now try building again with: .\build-apk.ps1 -LocalBuild" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: This is a temporary fix. To revert, delete $gradleFile and rename $backupFile back." -ForegroundColor Yellow
Write-Host "Or run: Copy-Item '$backupFile' '$gradleFile' -Force" -ForegroundColor Gray