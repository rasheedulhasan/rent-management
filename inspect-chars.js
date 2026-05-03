const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mobile-app', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
const data = fs.readFileSync(filePath);
const str = data.toString('utf8');

console.log('First 10 characters:');
for (let i = 0; i < Math.min(10, str.length); i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    console.log(`  ${i}: '${ch}' (U+${code.toString(16).toUpperCase().padStart(4, '0')}) ${code}`);
}

console.log('\nChecking for non-ASCII characters in first 100 chars:');
for (let i = 0; i < Math.min(100, str.length); i++) {
    const code = str.charCodeAt(i);
    if (code > 127) {
        console.log(`  Non-ASCII at ${i}: '${str[i]}' (U+${code.toString(16).toUpperCase()})`);
    }
}

// Also check for Unicode BOM character U+FEFF
const hasBOM = str.charCodeAt(0) === 0xFEFF;
console.log(`\nHas Unicode BOM (U+FEFF)? ${hasBOM}`);
if (hasBOM) {
    console.log('Removing BOM...');
    const newStr = str.slice(1);
    fs.writeFileSync(filePath, newStr, 'utf8');
    console.log('File rewritten without BOM.');
}