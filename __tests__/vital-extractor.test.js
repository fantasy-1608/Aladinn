import { describe, it, expect } from 'vitest';
import { extractVitals } from '../content/scanner/vital-extractor.js';

describe('Vital Extractor', () => {
  it('1. Full Standard', () => {
    const text = 'Mạch: 80 lần/p, Nhiệt độ: 37.5, Huyết áp: 120/80, Nhịp thở: 20, SpO2: 98%';
    expect(extractVitals(text)).toEqual({
      hr: 80,
      temp: 37.5,
      bp: '120/80',
      rr: 20,
      spo2: 98,
      stable: false
    });
  });

  it('2. Abbreviated / No spaces', () => {
    const text = 'M:80 t:37 HA:110/70 NT:18 spo2:99';
    expect(extractVitals(text)).toEqual({
      hr: 80,
      temp: 37,
      bp: '110/70',
      rr: 18,
      spo2: 99,
      stable: false
    });
  });

  it('3. Unaccented and Typos', () => {
    const text = 'mach 90, nhiet do 38, huyet ap 130/80, nhip tho 22';
    expect(extractVitals(text)).toEqual({
      hr: 90,
      temp: 38,
      bp: '130/80',
      rr: 22,
      spo2: null,
      stable: false
    });
  });

  it('4. Mixed separators / Commas', () => {
    const text = 'Mạch=80 , t = 37,5 ; ha 120 / 80 - nhịp thở 20 SpO2 98';
    expect(extractVitals(text)).toEqual({
      hr: 80,
      temp: 37.5,
      bp: '120/80',
      rr: 20,
      spo2: 98,
      stable: false
    });
  });

  it('5. Partial Data', () => {
    const text = 'HA 130/85, Mạch 90';
    expect(extractVitals(text)).toEqual({
      hr: 90,
      temp: null,
      bp: '130/85',
      rr: null,
      spo2: null,
      stable: false
    });
  });

  it('6. No Vitals', () => {
    const text = 'Bệnh nhân tỉnh, tiếp xúc tốt.';
    expect(extractVitals(text)).toEqual({
      hr: null,
      temp: null,
      bp: null,
      rr: null,
      spo2: null,
      stable: false
    });
  });

  it('7. Interleaved text', () => {
    const text = 'Mạch nhanh: 110 lần/p, HA đo được: 140/90';
    expect(extractVitals(text)).toEqual({
      hr: 110,
      temp: null,
      bp: '140/90',
      rr: null,
      spo2: null,
      stable: false
    });
  });

  it('8. Invalid Numbers / Empty', () => {
    const text = 'Mạch: ---, HA: không đo được';
    expect(extractVitals(text)).toEqual({
      hr: null,
      temp: null,
      bp: null,
      rr: null,
      spo2: null,
      stable: false
    });
  });

  it('9. Boundary Values (high/low)', () => {
    const text = 'Mạch: 200, t: 41, HA: 250/150, nt: 40, spo2: 50';
    expect(extractVitals(text)).toEqual({
      hr: null, // Vượt ngoài giới hạn sinh lý an toàn 180
      temp: 41,
      bp: null, // Vượt ngoài giới hạn sinh lý an toàn 220/130
      rr: 40,
      spo2: 50,
      stable: false
    });
  });

  it('10. Repeated Vitals', () => {
    const text = 'Mạch 80, sau 15p mạch 85';
    expect(extractVitals(text)).toEqual({
      hr: 80,
      temp: null,
      bp: null,
      rr: null,
      spo2: null,
      stable: false
    });
  });

  it('11. Null/invalid input handles gracefully', () => {
    expect(extractVitals(null)).toEqual({
      hr: null,
      temp: null,
      bp: null,
      rr: null,
      spo2: null,
      stable: false
    });
    expect(extractVitals(123)).toEqual({
      hr: null,
      temp: null,
      bp: null,
      rr: null,
      spo2: null,
      stable: false
    });
  });
  it('12. Adversarial / False Positive Checks', () => {
    const text = 'Bệnh nhân nam 50 tuổi. Mũi kim 120. Truyền thuốc pha 120/80. nt 20 lần/phút. Tiêm 50ml.';
    expect(extractVitals(text)).toEqual({
      hr: null,
      temp: null,
      bp: null,
      rr: 20,
      spo2: null,
      stable: false
    });
  });

  it('13. No Space (Abbreviated connected to numbers)', () => {
    const text = 'm80 t37.5 ha120/80 nt20 spo298';
    expect(extractVitals(text)).toEqual({
      hr: 80,
      temp: 37.5,
      bp: '120/80',
      rr: 20,
      spo2: 98,
      stable: false
    });
  });

  it('14. Adversarial - Height not HR', () => {
    const text = 'Cao 1m80 nặng 70kg';
    expect(extractVitals(text).hr).toBeNull();
  });

  it('15. Adversarial - Triệu chứng / Tốc độ not Temp', () => {
    const text = 'tc 38 ngày, tđ 38 giọt/phút';
    expect(extractVitals(text).temp).toBeNull();
  });

  it('16. Adversarial - Ngày thứ not Nhịp thở', () => {
    const text = 'nt 20, nt 21';
    expect(extractVitals(text).rr).toBeNull();
  });

  it('17. Valid Nhịp thở with colon or units', () => {
    expect(extractVitals('nt: 20').rr).toBe(20);
    expect(extractVitals('nt 22 l/p').rr).toBe(22);
    expect(extractVitals('nt20').rr).toBe(20);
  });

  it('18. French-style Blood Pressure (12/8 and decimal cases)', () => {
    // 12/8 -> 120/80
    expect(extractVitals('HA 12/8').bp).toBe('120/80');
    // 12/7.5 -> 120/75
    expect(extractVitals('ha 12/7.5').bp).toBe('120/75');
    // 11.5/7.5 -> 115/75
    expect(extractVitals('bp: 11,5/7,5').bp).toBe('115/75');
    // Out of physiological limit even after multiplication
    expect(extractVitals('ha 25/15').bp).toBeNull();
  });

  it('19. SpO2 typos (sp02 with number 0 and spO2)', () => {
    expect(extractVitals('sp02: 97%').spo2).toBe(97);
    expect(extractVitals('spO2 95').spo2).toBe(95);
    expect(extractVitals('sp02 đo ngón tay 99').spo2).toBe(99);
  });

  it('20. Temp with units at the end (37.5 độ, 37.5 C, etc.)', () => {
    expect(extractVitals('37.5 độ C').temp).toBe(37.5);
    expect(extractVitals('37.5 C').temp).toBe(37.5);
    expect(extractVitals('t 37.5 độ').temp).toBe(37.5);
    expect(extractVitals('nhiệt độ 37.5oC').temp).toBe(37.5);
    expect(extractVitals('nd: 37,5°C').temp).toBe(37.5);
    expect(extractVitals('37.5độ').temp).toBe(37.5);
  });

  it('21. Clinical Physiological Filter (Safety bounds)', () => {
    // Mạch ngoài khoảng 40 - 180 bpm
    expect(extractVitals('mạch 30').hr).toBeNull();
    expect(extractVitals('mạch 190').hr).toBeNull();
    
    // Nhiệt độ ngoài khoảng 34.0 - 42.0
    expect(extractVitals('nhiệt độ 33').temp).toBeNull();
    expect(extractVitals('t: 43 độ C').temp).toBeNull();
    
    // Huyết áp ngoài khoảng 70-220 / 40-130
    expect(extractVitals('ha 60/40').bp).toBeNull();
    expect(extractVitals('ha 120/140').bp).toBeNull();
    expect(extractVitals('ha 230/80').bp).toBeNull();
    
    // Nhịp thở ngoài khoảng 8 - 40
    expect(extractVitals('nt 6').rr).toBeNull();
    expect(extractVitals('nt 45').rr).toBeNull();
    
    // SpO2 ngoài khoảng 50 - 100
    expect(extractVitals('spo2 45').spo2).toBeNull();
    expect(extractVitals('spo2 105').spo2).toBeNull();
  });

  it('22. Stable Vitals Detection (R1)', () => {
    // sinh hiệu ổn
    expect(extractVitals('sinh hiệu ổn').stable).toBe(true);
    // sh ổn
    expect(extractVitals('sh ổn').stable).toBe(true);
    // shổn
    expect(extractVitals('shổn').stable).toBe(true);
    // sinh hiệu ổn định
    expect(extractVitals('sinh hiệu ổn định').stable).toBe(true);
    // sh ổn định
    expect(extractVitals('sh ổn định').stable).toBe(true);
    // sinh hieu on (không dấu)
    expect(extractVitals('sinh hieu on').stable).toBe(true);
    // sh on
    expect(extractVitals('sh on').stable).toBe(true);
    // shon
    expect(extractVitals('shon').stable).toBe(true);
    // sinh hieu on dinh
    expect(extractVitals('sinh hieu on dinh').stable).toBe(true);
    // sh on dinh
    expect(extractVitals('sh on dinh').stable).toBe(true);

    // Negative / unrelated cases
    expect(extractVitals('sinh hoạt bình thường').stable).toBe(false);
    expect(extractVitals('bệnh nhân ổn định').stable).toBe(false);
    expect(extractVitals('không ổn định').stable).toBe(false);
  });
});
