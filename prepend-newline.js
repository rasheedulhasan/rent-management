const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mobile-app', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
const content = fs.readFileSync(filePath, 'utf8');
// Prepend a newline (use LF to keep consistency; Windows uses CRLF but Gradle handles both)
const newContent = '\n' + content;
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Prepended newline to file.');