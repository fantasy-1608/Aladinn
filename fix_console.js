const fs = require('fs');
const path = require('path');

const dir = '/Users/trunganh/CNTT/Aladinn/content/scanner/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('iframe-helper.js'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    content = content.replace(/console\.warn/g, 'console.log');
    content = content.replace(/console\.error/g, 'console.log');
    
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${file}`);
}
