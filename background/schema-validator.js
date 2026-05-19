/**
 * Schema Validator for AI Responses
 * Ensures that the payload returned from AI matches expected structure before auto-filling
 */

export class SchemaValidator {
    /**
     * Validates that the parsed AI response conforms to the base schema
     * @param {Object} data - Parsed JSON object from AI
     * @returns {Object} Result object { isValid, error, data }
     */
    static validateVoiceClinical(data) {
        if (!data || typeof data !== 'object') {
            return { isValid: false, error: 'Phản hồi không phải là JSON object' };
        }

        // Expected optional string fields
        const stringFields = [
            'lyDoVaoVien', 'quaTrinhBenhLy', 'tienSuBanThan', 'tienSuGiaDinh',
            'khamToanThan', 'khamBoPhan', 'chanDoanBanDau', 'huongXuLy'
        ];

        for (const field of stringFields) {
            if (data[field] !== undefined && typeof data[field] !== 'string') {
                return { isValid: false, error: `Trường ${field} phải là chuỗi (string)` };
            }
        }

        const allowedFields = new Set([...stringFields, 'sinhHieu', 'icd10Suggest']);
        for (const key of Object.keys(data)) {
            if (!allowedFields.has(key)) {
                return { isValid: false, error: `Trường ${key} không nằm trong whitelist` };
            }
        }

        const jsonStr = JSON.stringify(data).toLowerCase();
        if (jsonStr.includes('<script>') || jsonStr.includes('javascript:')) {
            return { isValid: false, error: 'Phát hiện nội dung độc hại (Prompt injection)' };
        }

        // Validate Sinh Hieu
        if (data.sinhHieu) {
            if (typeof data.sinhHieu !== 'object') {
                return { isValid: false, error: 'Trường sinhHieu phải là object' };
            }
            
            const sinhHieuFields = [
                'mach', 'nhietDo', 'huyetApTamThu', 'huyetApTamTruong',
                'nhipTho', 'spO2', 'canNang', 'chieuCao'
            ];

            for (const field of sinhHieuFields) {
                // Allows string or number
                if (data.sinhHieu[field] !== undefined && 
                    typeof data.sinhHieu[field] !== 'string' && 
                    typeof data.sinhHieu[field] !== 'number') {
                    return { isValid: false, error: `Trường sinhHieu.${field} phải là chuỗi hoặc số` };
                }
            }
        }

        // Validate icd10Suggest
        if (data.icd10Suggest !== undefined) {
            if (!Array.isArray(data.icd10Suggest)) {
                return { isValid: false, error: 'Trường icd10Suggest phải là một mảng (array)' };
            }
            
            for (const item of data.icd10Suggest) {
                if (typeof item !== 'object' || !item.code || !item.name) {
                    return { isValid: false, error: 'Các phần tử trong icd10Suggest phải có code và name' };
                }
            }
        }

        return { isValid: true, data };
    }
}
