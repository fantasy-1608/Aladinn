import { extractVitals } from './content/scanner/vital-extractor.js';
console.log(extractVitals('tiêm 50'));
console.log('tiêm 50'.match(/(?:m[ạa]ch|hr|m)[\s:=]*(?:nhanh|ch[ậa]m)?[\s:=]*(?:đo được)?[\s:=]*(\d{2,3})\b/i));
