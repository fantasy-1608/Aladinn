/**
 * ═══════════════════════════════════════════════════════════════════
 * VNPT-HIS API Mini Library for Aladinn (Selective Integration)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Lọc chính xác 7 API tối thiểu từ HunterAI thư viện để tích hợp
 * gọn nhẹ vào Aladinn. Giảm thiểu 70% kích thước, tối ưu hóa
 * hiệu năng, độc lập hoàn toàn với DOM.
 * 
 * Base URL: https://{hostname}/vnpthis/RestService
 * Auth: Sử dụng session cookie JSESSIONID + UUID từ browser.
 */

// ═══════════════════════════════════════════════════════════════════
// Essential API Definitions
// ═══════════════════════════════════════════════════════════════════

export const API_PATIENT_CONTEXT = {
  id: 'NGT02K016.EV003',
  func: 'ajaxExecuteQueryPaging',
  params: ['NGT02K016.EV003'],
  description: 'Giải mã Context bệnh nhân (KHAMBENHID, HOSOBENHANID, BENHNHANID, TIEPNHANID)'
};

export const API_VITALS = {
  id: 'NT.006',
  func: 'ajaxCALL_SP_O',
  params: ['NT.006'], // Param format: JSON.stringify({KHAMBENHID: khambenhid})
  description: 'Sinh hiệu bệnh nhân (Mạch, Nhiệt độ, Huyết áp, Cân nặng, Chiều cao, SpO2)'
};

export const API_TIMELINE = {
  id: 'NT.024.DSPHIEU',
  func: 'ajaxExecuteQueryPaging',
  params: ['NT.024.DSPHIEU'],
  description: 'Danh sách phiếu y lệnh điều trị, chỉ định cận lâm sàng (Type: 1=XN, 2=CĐHA, 4=Điều trị)'
};

export const API_EVENT_DETAIL = {
  id: 'NT.024.2',
  func: 'ajaxExecuteQueryPaging',
  params: ['NT.024.2'], // Param [0] = MAUBENHPHAMID
  description: 'Chi tiết kết quả cận lâm sàng (Lab kết quả, mô tả CT Scan, PACS link)'
};

export const API_MEDICATIONS = {
  id: 'NTU02D007.05',
  func: 'ajaxExecuteQueryPaging',
  params: ['NTU02D007.05'], // Param [0] = KHAMBENHID
  description: 'Danh sách y lệnh thuốc nội trú của phiên điều trị'
};

export const API_MEDICAL_HISTORY = {
  id: 'NT.006.HSBA.HIS',
  func: 'ajaxCALL_SP_O',
  params: ['NT.006.HSBA.HIS'], // Param format: JSON.stringify({HOSOBENHANID: hosobenhanid})
  description: 'Hồ sơ bệnh án lúc nhập viện (tiền sử, lý do vào viện, khám bộ phận)'
};

export const API_DRUG_MATERIALS = {
  id: 'NT.024.DSTHUOCVT',
  func: 'ajaxExecuteQueryPaging',
  params: ['NT.024.DSTHUOCVT'], // Lấy phiếu vật tư (Type: 8=Vật tư, "7;"=Thuốc)
  description: 'Danh sách phiếu vật tư tiêu hao'
};

export const API_VATTU_ITEMS = {
  id: 'NT.034.1',
  func: 'ajaxExecuteQueryPaging',
  params: ['NT.034.1'], // Param [0] = IDPHIEU
  description: 'Chi tiết danh sách vật tư trong một phiếu'
};

// ═══════════════════════════════════════════════════════════════════
// Helper Builders
// ═══════════════════════════════════════════════════════════════════

/**
 * Tạo URL và payload cho API dạng ajaxExecuteQueryPaging
 */
export function buildApiUrl(baseUrl, uuid, queryName, options = [], rows = 500) {
  const postData = JSON.stringify({
    func: 'ajaxExecuteQueryPaging',
    uuid: uuid,
    params: [queryName],
    options: options
  });

  const searchParams = new URLSearchParams({
    postData: postData,
    _search: 'false',
    rows: String(rows),
    page: '1',
    sidx: '',
    sord: 'asc'
  });

  return `${baseUrl}/vnpthis/RestService?${searchParams.toString()}`;
}

/**
 * Tạo URL và payload cho API dạng ajaxCALL_SP_O hoặc ajaxCALL_SP
 */
export function buildSpUrl(baseUrl, uuid, spName, param, funcType = 'ajaxCALL_SP_O') {
  const postData = JSON.stringify({
    func: funcType,
    uuid: uuid,
    params: [spName, param, 0]
  });

  const searchParams = new URLSearchParams({ postData });
  return `${baseUrl}/vnpthis/RestService?${searchParams.toString()}`;
}
