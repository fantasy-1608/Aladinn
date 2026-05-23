import { extractVitals } from "./content/scanner/vital-extractor.js";
console.log(extractVitals("Bệnh nhân T 38 tuổi"));
console.log(extractVitals("Bệnh nhân T, 38 tuổi"));
