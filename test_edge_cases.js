import { extractVitals } from './content/scanner/vital-extractor.js';

const texts = [
  "tc: 38",
  "tđ: 38",
  "to: 38",
  "t°: 38",
  "t°c: 38",
  "tuổi 38",
  "có thai 38 tuần",
  "số lượng tiểu cầu 80",
  "tiêm 80",
  "nam 80",
  "chụp mri 80",
  "100 m 80",
  "hành 120/80",
  "phút 20",
  "bệnh nhân mệt 80",
  "t 38",
  "tc 38",
  "tđ 38"
];

texts.forEach(t => {
  console.log(`"${t}"`);
  console.log(extractVitals(t));
});
