import { extractVitals } from './content/scanner/vital-extractor.js';

const texts = [
  "Bệnh nhân uống 100 ml nước, cao 160 cm, cân nặng 50 kg.",
  "Khoảng cách 100 m từ nhà.",
  "Mũi 1 tiêm lúc 10 giờ.",
  "Sáng 10 viên.",
  "Hẹn khám lại sau 10 ngày.",
  "M 120", // could be mạch 120
  "Cách 100m", // matches hr?
  "m 120"
];

texts.forEach(t => {
  console.log(`--- Text: "${t}"`);
  console.log(extractVitals(t));
});
