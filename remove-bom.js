const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mobile-app', 'node_modules', 'expo-modules-core', 'android', 'ExpoModulesCorePlugin.gradle');
console.log('Processing:', filePath);

const data = fs.readFileSync(filePath);
const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
let hasBom = data.slice(0, 3).equals(bom);
console.log('Has BOM?', hasBom);

if (hasBom) {
    const contentWithoutBom = data.slice(3);
    fs.writeFileSync(filePath, contentWithoutBom);
    console.log('BOM removed.');
} else {
    console.log('No BOM found.');
}