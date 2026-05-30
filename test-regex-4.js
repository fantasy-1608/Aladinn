import fs from 'fs';
const code = fs.readFileSync('./content/scanner/vital-extractor.js', 'utf8');
console.log(code.includes('extractVitals'));
