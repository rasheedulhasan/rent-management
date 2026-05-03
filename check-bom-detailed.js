const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mobile-app', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
const data = fs.readFileSync(filePath);

console.log('File size:', data.length);
console.log('First 20 bytes hex:', data.slice(0, 20).toString('hex'));

// Check common BOMs
const boms = {
    'UTF-8': [0xEF, 0xBB, 0xBF],
    'UTF-16 BE': [0xFE, 0xFF],
    'UTF-16 LE': [0xFF, 0xFE],
    'UTF-32 BE': [0x00, 0x00, 0xFE, 0xFF],
    'UTF-32 LE': [0xFF, 0xFE, 0x00, 0x00],
};

for (const [name, bytes] of Object.entries(boms)) {
    if (data.length >= bytes.length) {
        const slice = data.slice(0, bytes.length);
        const matches = slice.equals(Buffer.from(bytes));
        console.log(`${name} BOM present? ${matches}`);
        if (matches) {
            console.log('  BOM bytes:', slice.toString('hex'));
        }
    }
}

// Try to decode as UTF-8 and see first character
const firstChar = data.toString('utf8', 0, 1);
console.log('First character (UTF-8):', firstChar);
console.log('First character code point:', firstChar.charCodeAt(0));

// Try to decode as Latin1
const latin1 = data.toString('latin1');
console.log('First 10 chars (Latin1):', latin1.substring(0, 10));