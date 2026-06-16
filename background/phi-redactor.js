/**
 * PHI Redactor - Removes Protected Health Information before sending to AI
 * 
 * Target fields to redact:
 * - Họ tên (Name)
 * - Mã bệnh nhân / Số hồ sơ (Patient ID)
 * - CCCD/CMND (National ID)
 * - BHYT (Health Insurance)
 * - Địa chỉ (Address) - best effort
 * - Số điện thoại (Phone)
 * - Email
 * 
 * [P0-SEC-002] Regex patterns đã được thu hẹp để giảm false positive:
 * - CCCD: Yêu cầu đúng 12 số liên tục (không match 9 số vô điều kiện nữa)
 *   Thêm heuristic: chỉ match 9 số nếu đứng sau label "CMND"/"CCCD"
 * - PatientID: Bắt buộc prefix BN/HS/MA (trước đây prefix là optional)
 * - containsPHI() dùng pattern khác (chặt hơn) để tránh block nhầm request hợp lệ
 */

const PHI_PATTERNS = [
    // 1. Số điện thoại (Việt Nam)
    {
        name: 'Phone',
        regex: /(?:0|\+84)\s?[35789]\d{2}\s?\d{3}\s?\d{3}\b|(?:0|\+84)[35789]\d{8}\b/g,
        replacement: '[PHONE]'
    },
    // 2. Căn cước công dân 12 số (format chuẩn CCCD mới)
    {
        name: 'CCCD',
        regex: /\b0\d{11}\b/g,
        replacement: '[ID_CARD]'
    },
    // 2b. CMND 9 số — chỉ match khi có label/prefix rõ ràng phía trước
    {
        name: 'CMND',
        regex: /(?:CMND|CCCD|căn\s*cước|chứng\s*minh)\s*(?:số|:)?\s*(\d{9})\b/gi,
        replacement: (match, digits) => match.replace(digits, '[ID_CARD]')
    },
    // 3. Mã thẻ BHYT (Ví dụ: DN4010112345678, HC4..., 15 ký tự và định dạng cách quãng)
    {
        name: 'BHYT',
        regex: /\b[A-Za-z]{2}\d{13}\b|\b[A-Za-z]{2}\s\d{1}\s\d{2}\s\d{2}\s\d{3}\s\d{5}\b/g,
        replacement: '[BHYT]'
    },
    // 4. Mã bệnh nhân / Số hồ sơ VNPT HIS — BẮT BUỘC có prefix BN/HS/MA
    // [P0-SEC-002] Prefix bắt buộc để tránh match nhầm timestamps, SĐT, mã thuốc
    {
        name: 'PatientID',
        regex: /\b(BN|HS|MA)\d{8,10}\b/ig,
        replacement: '[PATIENT_ID]'
    },
    // 5. Email
    {
        name: 'Email',
        regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: '[EMAIL]'
    }
];

// [P0-03] Extended patterns — used by redactFields() and PHIPipeline
const FAMILY_NAME_PATTERN = {
    name: 'FamilyName',
    regex: /(Người\s*nhà|Liên\s*hệ|Bố|Mẹ|Cha|Vợ|Chồng|Con|Anh|Chị|Em)\s*[:：]\s*[^,;\n]+/gi,
    replacement: '[FAMILY_INFO]'
};

const WARD_ROOM_BED_PATTERN = {
    name: 'WardRoomBed',
    regex: /(Khoa|Phòng|Giường|Buồng)\s*[:：]\s*[^,;\n]+/gi,
    replacement: '[WARD_INFO]'
};

const TIMESTAMP_PATTERN = {
    name: 'Timestamp',
    regex: /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?)/g,
    replacement: '[DATE]'
};

export class PHIRedactor {
    /**
     * Redact standard PHI patterns from text
     * @param {string} text - Raw text
     * @returns {string} Redacted text
     */
    static redact(text) {
        if (!text || typeof text !== 'string') return text;
        
        let redacted = text;
        for (const pattern of PHI_PATTERNS) {
            redacted = redacted.replace(pattern.regex, pattern.replacement);
        }

        // Bổ sung: Thay thế tên bác sĩ và bệnh nhân qua nhãn lâm sàng
        redacted = redacted.replace(/(?:Bác\s*sĩ|Bs\.|BS|Bệnh\s*nhân|Bn\.|BN|bác\s*sĩ|bệnh\s*nhân)[\s:]+([A-ZÀ-Ỹ][A-ZÀ-Ỹa-zà-ỹ]*(?:\s+[A-ZÀ-Ỹ][A-ZÀ-Ỹa-zà-ỹ]*){1,4})/g, (match, _namePart) => {
            const prefixMatch = match.match(/(?:Bác\s*sĩ|Bs\.|BS|Bệnh\s*nhân|Bn\.|BN|bác\s*sĩ|bệnh\s*nhân)[\s:]+/i);
            const prefix = prefixMatch ? prefixMatch[0] : 'Bác sĩ: ';
            return prefix + '[NAME]';
        });

        // Best effort: Remove lines that look like "Họ tên: Nguyễn Văn A"
        // Regex looks for "Họ tên", "Tên", "Bệnh nhân" followed by colon and text
        redacted = redacted.replace(/(?:Họ\s*và\s*tên|Họ\s*tên|Tên\s*bệnh\s*nhân|Bệnh\s*nhân|BN)[\s:]+([A-ZÀ-Ỹa-zà-ỹ\s]{2,50})(?=[,.;\n]|$)/gi, (match) => {
            const prefixMatch = match.match(/(?:Họ\s*và\s*tên|Họ\s*tên|Tên\s*bệnh\s*nhân|Bệnh\s*nhân|BN)[\s:]+/i);
            const prefix = prefixMatch ? prefixMatch[0] : 'Họ tên: ';
            return prefix + '[NAME]';
        });

        // Best effort: Remove lines that look like address
        redacted = redacted.replace(/(?:Địa\s*chỉ)[\s:]+([^\n.;]+)/gi, (match) => {
            const prefixMatch = match.match(/(?:Địa\s*chỉ)[\s:]+/i);
            const prefix = prefixMatch ? prefixMatch[0] : 'Địa chỉ: ';
            return prefix + '[ADDRESS]';
        });

        // Best effort: Remove Date of birth
        redacted = redacted.replace(/(?:Ngày\s*sinh|Sinh\s*ngày|DOB|Sinh\s*năm)[\s:]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{4})/gi, (match, datePart) => {
            return match.replace(datePart, '[DOB]');
        });

        return redacted;
    }

    /**
     * Guard function: Check if text still contains obvious PHI
     * Uses STRICTER patterns than redact() to avoid false positive blocking.
     * [P0-SEC-002] Tách riêng containsPHI patterns — chặt hơn, chỉ match PHI thực sự.
     * @param {string} text - The text to check
     * @returns {boolean} True if it looks like PHI is present
     */
    static containsPHI(text) {
        if (!text) return false;
        
        // Strict patterns — chỉ match PHI rõ ràng, tránh false positive
        const strictPatterns = [
            /(?:0|\+84)\s?[35789]\d{2}\s?\d{3}\s?\d{3}\b|(?:0|\+84)[35789]\d{8}\b/, // Phone VN
            /\b0\d{11}\b/, // CCCD 12 số (bắt đầu bằng 0)
            /\b[A-Za-z]{2}\d{13}\b/, // BHYT
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
            /\b(?:BN|HS|MA|MABA|MABN)\s*[:-]?\s*\d{6,15}\b/i  // PatientID — [M-08]
        ];

        for (const regex of strictPatterns) {
            if (regex.test(text)) return true;
        }

        return false;
    }

    /**
     * [P0-03] Apply redaction to a map of field names → values.
     * Includes extended patterns (family, ward, timestamps).
     * @param {Object<string, string>} fieldMap
     * @param {{ allowDates?: boolean, allowWardInfo?: boolean }} options
     * @returns {{ redactedMap: Object, redactedCount: number, reasons: string[] }}
     */
    static redactFields(fieldMap, options = {}) {
        const { allowDates = false, allowWardInfo = false } = options;
        let redactedCount = 0;
        const reasons = [];
        const redactedMap = {};

        for (const [key, value] of Object.entries(fieldMap)) {
            if (!value || typeof value !== 'string') {
                redactedMap[key] = value ?? '';
                continue;
            }
            let text = PHIRedactor.redact(value);
            const afterBase = _countReplacements(value, text);
            if (afterBase > 0) {
                redactedCount += afterBase;
                reasons.push('base_phi');
            }

            // Family/relative names
            const beforeFamily = text;
            text = text.replace(FAMILY_NAME_PATTERN.regex, FAMILY_NAME_PATTERN.replacement);
            const familyHits = _countReplacements(beforeFamily, text);
            if (familyHits > 0) {
                redactedCount += familyHits;
                reasons.push('family_name');
            }

            // Ward/room/bed
            if (!allowWardInfo) {
                const beforeWard = text;
                text = text.replace(WARD_ROOM_BED_PATTERN.regex, WARD_ROOM_BED_PATTERN.replacement);
                const wardHits = _countReplacements(beforeWard, text);
                if (wardHits > 0) {
                    redactedCount += wardHits;
                    reasons.push('ward_info');
                }
            }

            // Timestamps
            if (!allowDates) {
                const beforeTs = text;
                text = text.replace(TIMESTAMP_PATTERN.regex, TIMESTAMP_PATTERN.replacement);
                const tsHits = _countReplacements(beforeTs, text);
                if (tsHits > 0) {
                    redactedCount += tsHits;
                    reasons.push('timestamp');
                }
            }

            redactedMap[key] = text;
        }

        return {
            redactedMap,
            redactedCount,
            reasons: [...new Set(reasons)]
        };
    }
}

/**
 * Count bracket-replacement tokens added between original and redacted text.
 * @param {string} original
 * @param {string} redacted
 * @returns {number}
 */
function _countReplacements(original, redacted) {
    if (original === redacted) return 0;
    const origTokens = (original.match(/\[[A-Z_]+\]/g) || []).length;
    const newTokens = (redacted.match(/\[[A-Z_]+\]/g) || []).length;
    return Math.max(0, newTokens - origTokens);
}
