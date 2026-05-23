import { extractVitals } from './content/scanner/vital-extractor.js';

const cases = [
  "Bệnh nhân cao 1m80, nặng 70kg",
  "Nằm viện nt 20",
  "Sốt li bì, tc 38 ngày",
  "Truyền dịch tđ 38 giọt/phút"
];

cases.forEach(t => {
  console.log(`"${t}" ->`, extractVitals(t));
});
