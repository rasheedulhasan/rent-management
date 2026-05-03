const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mobile-app', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
console.log('Processing:', filePath);

let data = fs.readFileSync(filePath);
// Remove UTF-8 BOM
if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
    data = data.slice(3);
    console.log('Removed UTF-8 BOM');
}
// Remove UTF-16 LE BOM (FF FE)
if (data[0] === 0xFF && data[1] === 0xFE) {
    data = data.slice(2);
    console.log('Removed UTF-16 LE BOM');
}
// Remove UTF-16 BE BOM (FE FF)
if (data[0] === 0xFE && data[1] === 0xFF) {
    data = data.slice(2);
    console.log('Removed UTF-16 BE BOM');
}
// Remove leading newline (0x0A) or carriage return (0x0D)
while (data.length > 0 && (data[0] === 0x0A || data[0] === 0x0D)) {
    data = data.slice(1);
    console.log('Removed leading newline/carriage return');
}
// Ensure the file ends with newline? Not needed.
fs.writeFileSync(filePath, data);
console.log('File fixed.');