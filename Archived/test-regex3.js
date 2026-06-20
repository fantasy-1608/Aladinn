import { extractVitals } from './content/scanner/vital-extractor.js';
console.log(extractVitals('Bệnh nhân uống vitamin t 38 viên'));
console.log(extractVitals('Thời gian t 38 phút'));
console.log(extractVitals('t 38 độ'));
console.log(extractVitals('t: 38'));
