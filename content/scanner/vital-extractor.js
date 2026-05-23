export function extractVitals(text) {
  if (!text || typeof text !== 'string') {
    return { hr: null, temp: null, bp: null, rr: null, spo2: null };
  }

  const result = {
    hr: null,
    temp: null,
    bp: null,
    rr: null,
    spo2: null
  };

  // 1. Mạch (HR) - Ngưỡng an toàn sinh lý: 40 - 180 bpm
  const hrMatch = text.match(/(?<![\p{L}\d])(?:m[ạa]ch|hr|m)(?!\p{L})[\s:=]*(?:nhanh|ch[ậa]m)?[\s:=]*(?:đo được)?[\s:=]*(\d{2,3})(?!\d)/iu);
  if (hrMatch && hrMatch[1]) {
    const val = parseInt(hrMatch[1], 10);
    if (val >= 40 && val <= 180) {
      result.hr = val;
    }
  }

  // 2. Nhiệt độ (Temp) - Ngưỡng an toàn sinh lý: 34.0 - 42.0 °C
  // Hỗ trợ cả có tiền tố (t, nd, nđ, nhiệt độ...) và có đơn vị nhiệt độ phía sau (độ, C, độ C...) hoặc không có tiền tố nhưng có đơn vị phía sau bắt buộc
  const tempMatch = text.match(/(?<![\p{L}\d])(?:(?:(?:nhi[eệ]t\s*[dđ][oộ]|nhi[eệ]t|n[đd]|t[oọ°]c?|t)(?!\p{L})[\s:=]*(\d{2}(?:[.,]\d+)?)(?:\s*(?:[o°]c|c|độ\s*c|độ))?)|(\d{2}(?:[.,]\d+)?)\s*(?:[o°]c|độ\s*c|độ|c(?!\p{L})))(?!\d)/iu);
  if (tempMatch) {
    const rawVal = tempMatch[1] || tempMatch[2];
    if (rawVal) {
      const val = parseFloat(rawVal.replace(',', '.'));
      if (val >= 34.0 && val <= 42.0) {
        result.temp = val;
      }
    }
  }

  // 3. Huyết áp (BP) - Ngưỡng an toàn sinh lý: Tâm thu 70 - 220, Tâm trương 40 - 130 mmHg
  // Hỗ trợ huyết áp kiểu Pháp (ví dụ: 12/8 hoặc 12/7.5)
  const bpMatch = text.match(/(?<![\p{L}\d])(?:huy[eế]t\s*[aá]p|ha|bp)(?!\p{L})[\s:=]*(?:đo được)?[\s:=]*(\d{1,3}(?:[.,]\d+)?\s*[/\\]\s*\d{1,3}(?:[.,]\d+)?)(?!\d)/iu);
  if (bpMatch && bpMatch[1]) {
    const parts = bpMatch[1].replace(/\\/g, '/').split('/');
    if (parts.length === 2) {
      let systolic = parseFloat(parts[0].trim().replace(',', '.'));
      let diastolic = parseFloat(parts[1].trim().replace(',', '.'));
      
      if (!isNaN(systolic) && !isNaN(diastolic)) {
        // Huyết áp kiểu Pháp: cả hai trị số đều nhỏ (< 30), nhân 10
        if (systolic < 30 && diastolic < 30) {
          systolic *= 10;
          diastolic *= 10;
        }
        
        // Kiểm tra an toàn sinh lý học
        if (systolic >= 70 && systolic <= 220 && diastolic >= 40 && diastolic <= 130) {
          result.bp = `${Math.round(systolic)}/${Math.round(diastolic)}`;
        }
      }
    }
  }

  // 4. Nhịp thở (RR) - Ngưỡng an toàn sinh lý: 8 - 40 lần/phút
  const rrMatch = text.match(/(?<![\p{L}\d])(?:(?:nh[iị]p\s*th[oở]|rr)(?!\p{L})[\s:=]*|nt(?!\p{L})(?:[:=]\s*|\s+(?=\d{1,2}\s*(?:l\/p|l\/phút|lần\/p|lần\/phút|l(?!\p{L})))|))(\d{1,2})(?!\d)/iu);
  if (rrMatch && rrMatch[1]) {
    const val = parseInt(rrMatch[1], 10);
    if (val >= 8 && val <= 40) {
      result.rr = val;
    }
  }

  // 5. SpO2 - Ngưỡng an toàn sinh lý: 50 - 100 %
  // Hỗ trợ lỗi sp02 (số 0 thay vì chữ O)
  const spo2Match = text.match(/(?<![\p{L}\d])(?:sp[o0]2)(?!\p{L})[\s:=]*(?:đo ngón tay)?[\s:=]*(\d{2,3})(?!\d)/iu);
  if (spo2Match && spo2Match[1]) {
    const val = parseInt(spo2Match[1], 10);
    if (val >= 50 && val <= 100) {
      result.spo2 = val;
    }
  }

  return result;
}

