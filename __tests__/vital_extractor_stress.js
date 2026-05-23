import { extractVitals } from '../content/scanner/vital-extractor.js';

console.log("Empty string:", extractVitals(''));
console.log("Object:", extractVitals({}));
console.log("Array:", extractVitals([]));
console.log("Number:", extractVitals(12345));
console.log("Undefined:", extractVitals(undefined));

// Malformed string
console.log("Malformed 1:", extractVitals('mạch:   123   Nhiệt   độ:  45.6  Huyết    áp:   250  /   150   Nhịp thở :   10   SpO2  :   100  '));

