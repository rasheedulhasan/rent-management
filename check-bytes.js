const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mobile-app', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
const data = fs.readFileSync(filePath);
console.log('First 10 bytes (hex):', data.slice(0, 10).toString('hex'));
console.log('First 10 bytes (decimal):', Array.from(data.slice(0, 10)).join(','));
console.log('First 10 characters:', data.slice(0, 10).toString('utf8'));
console.log('First char code:', data[0]);