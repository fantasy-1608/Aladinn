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
 */

const PHI_PATTERNS = [
    // 1. Số điện thoại (Việt Nam)
    {
        name: 'Phone',
        regex: /(?:0|\+84)\s?[35789]\d{2}\s?\d{3}\s?\d{3}\b|(?:0|\+84)[35789]\d{8}\b/g,
        replacement: '[PHONE]'
    },
    // 2. Căn cước công dân / CMND (9 hoặc 12 số)
    {
        name: 'CCCD/CMND',
        regex: /\b\d{9}\b|\b\d{12}\b/g,
        replacement: '[ID_CARD]'
    },
    // 3. Mã thẻ BHYT (Ví dụ: DN4010112345678, HC4..., 15 ký tự và định dạng cách quãng)
    {
        name: 'BHYT',
        regex: /\b[A-Za-z]{2}\d{13}\b|\b[A-Za-z]{2}\s\d{1}\s\d{2}\s\d{2}\s\d{3}\s\d{5}\b/g,
        replacement: '[BHYT]'
    },
    // 4. Mã bệnh nhân / Số hồ sơ VNPT HIS (Thường là chuỗi số dài đặc thù, vd: 24000000)
    {
        name: 'PatientID',
        regex: /\b(BN|HS|MA)?\d{8,10}\b/ig,
        replacement: '[PATIENT_ID]'
    },
    // 5. Email
    {
        name: 'Email',
        regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: '[EMAIL]'
    }
];

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
     * @param {string} text - The text to check
     * @returns {boolean} True if it looks like PHI is present
     */
    static containsPHI(text) {
        if (!text) return false;
        
        // If we find an unredacted BHYT, Phone, or Email, block it
        const strictPatterns = [
            /(?:0|\+84)\s?[35789]\d{2}\s?\d{3}\s?\d{3}\b|(?:0|\+84)[35789]\d{8}\b/, // Phone
            /\b\d{9}\b|\b\d{12}\b/, // CCCD
            /\b[A-Za-z]{2}\d{13}\b|\b[A-Za-z]{2}\s\d{1}\s\d{2}\s\d{2}\s\d{3}\s\d{5}\b/, // BHYT
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ // Email
        ];

        for (const regex of strictPatterns) {
            if (regex.test(text)) return true;
        }

        return false;
    }
}
