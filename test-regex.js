import { extractVitals } from "./content/scanner/vital-extractor.js";
console.log(extractVitals("nt 20"));
console.log(extractVitals("nt 20 l/p"));
console.log(extractVitals("nt: 20"));
