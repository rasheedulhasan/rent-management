const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mobile-app', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
const data = fs.readFileSync(filePath);

console.log('First 32 bytes:');
for (let i = 0; i < Math.min(32, data.length); i++) {
    const byte = data[i];
    const hex = byte.toString(16).padStart(2, '0');
    const char = byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
    console.log(`  ${i}: 0x${hex} (${byte}) '${char}'`);
}

// Check for any non-ASCII bytes (>= 128)
const nonAscii = [];
for (let i = 0; i < data.length; i++) {
    if (data[i] > 127) {
        nonAscii.push({ i, byte: data[i] });
    }
}
console.log(`\nNon-ASCII bytes count: ${nonAscii.length}`);
if (nonAscii.length > 0) {
    console.log('Positions:', nonAscii.slice(0, 10));
}