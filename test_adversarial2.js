import { extractVitals } from './content/scanner/vital-extractor.js';

const texts = [
  "Bệnh nhân hút 37 ml dịch",
  "Uống hớp 120/80 nước",
  "Khâu m 120 mũi",
  "Mũi kim 120",
  "Khoảng cách 120 m",
  "tốt 37",
  "nhát 38",
  "120 lần/p, nhịp 20", // nhịp 20 rr? 
  "sp 98",
  "giọt 38",
  "sốt 39", // t 39
  "sút 38" // t 38
];

texts.forEach(t => {
  console.log(`--- Text: "${t}"`);
  console.log(extractVitals(t));
});
