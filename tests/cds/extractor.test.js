// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CDSExtractor } from '../../content/cds/extractor.js';

describe('CDSExtractor: _parseLab Unit Tests', () => {
    it('should correctly normalize and parse glucose in mg% (from the clinical issue)', () => {
        const rawName = 'Xét nghiệm đường máu mao mạch tại giường (một lần)';
        const rawValue = '476';
        const unit = 'mg%';
        const refRange = '70 - 130mg/dL';

        const parsed = CDSExtractor._parseLab(rawName, rawValue, unit, refRange);
        expect(parsed).not.toBeNull();
        expect(parsed.code).toBe('glucose');
        // 476 / 18 = 26.4444... -> rounded to 26.44
        expect(parsed.value).toBe(26.44);
    });

    it('should correctly normalize and parse glucose in mg/dL without unit but value > 25', () => {
        const rawName = 'Đường máu mao mạch';
        const rawValue = '270';
        const unit = '';
        const refRange = '70 - 110';

        const parsed = CDSExtractor._parseLab(rawName, rawValue, unit, refRange);
        expect(parsed).not.toBeNull();
        expect(parsed.code).toBe('glucose');
        // 270 / 18 = 15.00
        expect(parsed.value).toBe(15.0);
    });

    it('should parse glucose in mmol/L directly without scaling', () => {
        const rawName = 'Định lượng Glucose [Máu]';
        const rawValue = '5.6';
        const unit = 'mmol/L';
        const refRange = '3.9 - 6.4';

        const parsed = CDSExtractor._parseLab(rawName, rawValue, unit, refRange);
        expect(parsed).not.toBeNull();
        expect(parsed.code).toBe('glucose');
        expect(parsed.value).toBe(5.6);
    });

    it('should correctly extract Potassium (K) with single character key', () => {
        const rawName = 'K';
        const rawValue = '3.25';
        const unit = 'mmol/L';
        const refRange = '3.5 - 5.0';

        const parsed = CDSExtractor._parseLab(rawName, rawValue, unit, refRange);
        expect(parsed).not.toBeNull();
        expect(parsed.code).toBe('potassium');
        expect(parsed.value).toBe(3.25);
    });

    it('should correctly extract Sodium (Na) with single word/character key', () => {
        const rawName = 'Na';
        const rawValue = '137';
        const unit = 'mmol/L';
        const refRange = '135 - 145';

        const parsed = CDSExtractor._parseLab(rawName, rawValue, unit, refRange);
        expect(parsed).not.toBeNull();
        expect(parsed.code).toBe('sodium');
        expect(parsed.value).toBe(137);
    });

    it('should parse Urea with Vietnamese accents properly', () => {
        const rawName = 'Định lượng Urê máu [Máu]';
        const rawValue = '2.58';
        const unit = 'mmol/L';
        const refRange = '2.5 - 7.5';

        const parsed = CDSExtractor._parseLab(rawName, rawValue, unit, refRange);
        expect(parsed).not.toBeNull();
        expect(parsed.code).toBe('urea');
        expect(parsed.value).toBe(2.58);
    });

    it('should handle AST and ALT with various raw names', () => {
        const astParsed = CDSExtractor._parseLab('Đo hoạt độ AST (GOT) [Máu]', '45', 'U/L', '≤ 37');
        expect(astParsed).not.toBeNull();
        expect(astParsed.code).toBe('AST');
        expect(astParsed.value).toBe(45);

        const altParsed = CDSExtractor._parseLab('Đo hoạt độ ALT (GPT) [Máu]', '31', 'U/L', '≤ 40');
        expect(altParsed).not.toBeNull();
        expect(altParsed.code).toBe('ALT');
        expect(altParsed.value).toBe(31);
    });
});
