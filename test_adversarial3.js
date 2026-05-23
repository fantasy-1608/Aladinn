import { extractVitals } from './content/scanner/vital-extractor.js';
console.log(extractVitals("thuốc pha 120/80 ml"));
console.log(extractVitals("sunt 20")); // nt in sunt -> rr = 20?
