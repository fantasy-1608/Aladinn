/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SmartScoreEngine } from '../../content/cds/smart-score.js';
import { SmartPathEngine } from '../../content/cds/smart-path.js';
import { PatientContextGuard } from '../../content/shared/patient-context-guard.js';

describe('SmartScoreEngine Unit Tests', () => {
    // 1. Glasgow Coma Scale (GCS)
    describe('Glasgow Coma Scale (GCS)', () => {
        const GcsSystem = SmartScoreEngine.SCORING_SYSTEMS.GCS;

        it('calculates normal GCS (15)', () => {
            const res = GcsSystem.calculate({ eye: 4, verbal: 5, motor: 6 });
            expect(res.total).toBe(15);
            expect(res.risk).toBe('Bình thường');
            expect(res.rec).toContain('Theo dõi sát');
        });

        it('calculates severe GCS (8 or less)', () => {
            const res = GcsSystem.calculate({ eye: 2, verbal: 2, motor: 4 });
            expect(res.total).toBe(8);
            expect(res.risk).toContain('NẶNG');
            expect(res.rec).toContain('đặt nội khí quản');
        });

        it('calculates moderate GCS (9-12)', () => {
            const res = GcsSystem.calculate({ eye: 3, verbal: 3, motor: 4 });
            expect(res.total).toBe(10);
            expect(res.risk).toContain('TRUNG BÌNH');
            expect(res.rec).toContain('chụp CT-scanner');
        });

        it('calculates mild GCS (13-14)', () => {
            const res = GcsSystem.calculate({ eye: 4, verbal: 4, motor: 5 });
            expect(res.total).toBe(13);
            expect(res.risk).toContain('NHẸ');
            expect(res.rec).toContain('Chụp CT sọ não nếu có chỉ định');
        });
    });

    // 2. qSOFA
    describe('qSOFA (Quick SOFA)', () => {
        const qSofaSystem = SmartScoreEngine.SCORING_SYSTEMS.qSOFA;

        it('calculates low risk qSOFA (0 or 1)', () => {
            const res = qSofaSystem.calculate({ resprate: true, altered_mental: false, systolic_bp: false });
            expect(res.total).toBe(1);
            expect(res.risk).toBe('Nguy cơ thấp');
            expect(res.rec).toContain('Tiếp tục theo dõi');
        });

        it('calculates high risk qSOFA (2 or 3)', () => {
            const res = qSofaSystem.calculate({ resprate: true, altered_mental: true, systolic_bp: false });
            expect(res.total).toBe(2);
            expect(res.risk).toContain('Nguy cơ cao');
            expect(res.rec).toContain('kháng sinh phổ rộng');
        });
    });

    // 3. CURB-65
    describe('CURB-65 (Pneumonia Severity)', () => {
        const CurbSystem = SmartScoreEngine.SCORING_SYSTEMS.CURB65;

        it('calculates mild severity CURB-65 (0 or 1)', () => {
            const res = CurbSystem.calculate({ confusion: false, urea: true, resprate: false, bloodpressure: false, age65: false });
            expect(res.total).toBe(1);
            expect(res.risk).toContain('Nhóm 1');
            expect(res.rec).toContain('ngoại trú');
        });

        it('calculates moderate severity CURB-65 (2)', () => {
            const res = CurbSystem.calculate({ confusion: true, urea: false, resprate: true, bloodpressure: false, age65: false });
            expect(res.total).toBe(2);
            expect(res.risk).toContain('Nhóm 2');
            expect(res.rec).toContain('nội trú ngắn ngày');
        });

        it('calculates severe CURB-65 (3 or more)', () => {
            const res = CurbSystem.calculate({ confusion: true, urea: true, resprate: true, bloodpressure: false, age65: false });
            expect(res.total).toBe(3);
            expect(res.risk).toContain('Nhóm 3');
            expect(res.rec).toContain('khẩn cấp');
        });
    });

    // 4. Wells Score for Pulmonary Embolism (PE)
    describe('Wells Score for Pulmonary Embolism (PE)', () => {
        const WellsSystem = SmartScoreEngine.SCORING_SYSTEMS.WellsPE;

        it('calculates low probability Wells Score (< 2.0)', () => {
            const res = WellsSystem.calculate({ dvt_symptoms: false, pe_likely: false, tachycardia: false, immobilization: false, prior_pe_dvt: false, hemoptysis: true, malignancy: false });
            expect(res.total).toBe(1.0);
            expect(res.risk).toContain('THẤP');
            expect(res.rec).toContain('D-Dimer');
        });

        it('calculates moderate probability Wells Score (2.0 - 6.0)', () => {
            const res = WellsSystem.calculate({ dvt_symptoms: true, pe_likely: false, tachycardia: true, immobilization: false, prior_pe_dvt: false, hemoptysis: false, malignancy: false });
            expect(res.total).toBe(4.5);
            expect(res.risk).toContain('TRUNG BÌNH');
            expect(res.rec).toContain('D-Dimer');
        });

        it('calculates high probability Wells Score (> 6.0)', () => {
            const res = WellsSystem.calculate({ dvt_symptoms: true, pe_likely: true, tachycardia: true, immobilization: false, prior_pe_dvt: false, hemoptysis: false, malignancy: false });
            expect(res.total).toBe(7.5);
            expect(res.risk).toContain('CAO');
            expect(res.rec).toContain('CT-Scanner');
        });
    });

    // 5. Alvarado Score (Appendicitis)
    describe('Alvarado Score (Appendicitis)', () => {
        const AlvaradoSystem = SmartScoreEngine.SCORING_SYSTEMS.Alvarado;

        it('calculates low risk Alvarado (1 - 4)', () => {
            const res = AlvaradoSystem.calculate({ migration: true, anorexia: false, nausea: true, tenderness: false, rebound: false, fever: false, leukocytosis: false, neutrophil_shift: false });
            expect(res.total).toBe(2);
            expect(res.risk).toContain('Chưa nghi ngờ');
            expect(res.rec).toContain('theo dõi');
        });

        it('calculates moderate risk Alvarado (5 - 6)', () => {
            const res = AlvaradoSystem.calculate({ migration: true, anorexia: true, nausea: true, tenderness: false, rebound: true, fever: true, leukocytosis: false, neutrophil_shift: false });
            expect(res.total).toBe(5);
            expect(res.risk).toContain('Có khả năng');
            expect(res.rec).toContain('đau bụng mỗi 2-4 giờ');
        });

        it('calculates high risk Alvarado (7 - 10)', () => {
            const res = AlvaradoSystem.calculate({ migration: true, anorexia: true, nausea: true, tenderness: true, rebound: true, fever: true, leukocytosis: false, neutrophil_shift: false });
            // tenderness is 2 points. So 1+1+1+2+1+1 = 7 points
            expect(res.total).toBe(7);
            expect(res.risk).toContain('Rất nghi ngờ');
            expect(res.rec).toContain('Hội chẩn Ngoại khoa');
        });
    });

    // 6. Test evaluating patient context (Labs & Age prefill)
    describe('Patient Context Evaluation & Prefills', () => {
        it('prefills age65 and urea correctly for CURB-65 in patient context', () => {
            const mockContext = {
                patient: { age: '70 tuổi' },
                encounter: {
                    diagnoses: [{ code: 'J18.0' }]
                },
                labs: [
                    { code: 'urea', value: 8.5, unit: 'mmol/L' }
                ]
            };

            const evaluations = SmartScoreEngine.evaluatePatientContext(mockContext);
            expect(evaluations.CURB65.suggested).toBe(true);
            expect(evaluations.CURB65.prefilled.age65).toBe(true);
            expect(evaluations.CURB65.prefilled.urea).toBe(true);
        });

        it('prefills leukocytosis and neutrophil_shift correctly for Alvarado', () => {
            const mockContext = {
                patient: { age: '25' },
                encounter: {
                    diagnoses: [{ code: 'K35.8' }]
                },
                labs: [
                    { code: 'WBC', value: 12.0 },
                    { code: 'neutrophil', value: 80.0 }
                ]
            };

            const evaluations = SmartScoreEngine.evaluatePatientContext(mockContext);
            expect(evaluations.Alvarado.suggested).toBe(true);
            expect(evaluations.Alvarado.prefilled.leukocytosis).toBe(true);
            expect(evaluations.Alvarado.prefilled.neutrophil_shift).toBe(true);
        });
    });
});

describe('SmartPathEngine Unit Tests', () => {
    beforeEach(() => {
        // Reset toggle to default false before each test
        SmartPathEngine.enabled = false;
    });

    it('remains hidden and inactive by default when enableSmartPath is false', () => {
        expect(SmartPathEngine.enabled).toBe(false);
        const guideline = SmartPathEngine.getGuidelinesForICD('J44');
        expect(guideline).toBeNull();

        const mockContext = {
            encounter: {
                diagnoses: [{ code: 'J44' }]
            }
        };
        const evaluations = SmartPathEngine.evaluatePatientContext(mockContext);
        expect(evaluations.enabled).toBe(false);
        expect(evaluations.matches).toHaveLength(0);
    });

    it('provides clinical guidelines when feature is enabled', () => {
        SmartPathEngine.enabled = true;
        expect(SmartPathEngine.enabled).toBe(true);

        const guideline = SmartPathEngine.getGuidelinesForICD('J44');
        expect(guideline).toBeDefined();
        expect(guideline.name).toContain('Bệnh phổi tắc nghẽn mạn tính');
        expect(guideline.recommendations.drugs).toHaveLength(3);
        expect(guideline.recommendations.labs).toHaveLength(3);
    });

    it('maps prefix codes correctly (e.g. J44.9 to J44 guideline)', () => {
        SmartPathEngine.enabled = true;
        const guideline = SmartPathEngine.getGuidelinesForICD('J44.9');
        expect(guideline).toBeDefined();
        expect(guideline.icd10).toBe('J44');
    });

    it('returns null for unknown ICD-10 codes', () => {
        SmartPathEngine.enabled = true;
        const guideline = SmartPathEngine.getGuidelinesForICD('XYZ123');
        expect(guideline).toBeNull();
    });

    it('evaluates patient context and returns correct guideline matches when enabled', () => {
        SmartPathEngine.enabled = true;
        const mockContext = {
            encounter: {
                diagnoses: [
                    { code: 'I10', name: 'Tăng huyết áp vô căn' },
                    { code: 'XYZ', name: 'Bệnh lạ' }
                ]
            }
        };

        const evaluations = SmartPathEngine.evaluatePatientContext(mockContext);
        expect(evaluations.enabled).toBe(true);
        expect(evaluations.matches).toHaveLength(1);
        expect(evaluations.matches[0].guideline.icd10).toBe('I10');
        expect(evaluations.matches[0].guideline.recommendations.drugs[0].name).toContain('Amlodipine');
    });
});

describe('PatientContextGuard Safety Tests (AmbientScribe Mismatch Detection)', () => {
    const originalPatientId = 'PATIENT_A_123';
    const differentPatientId = 'PATIENT_B_456';
    const encounterId = 'ENC_888';
    const admissionDate = '2026-05-22';
    const formType = 'PrescriptionForm';

    it('successfully validates when patient context is identical', () => {
        const lockedKey = PatientContextGuard.createKey(originalPatientId, encounterId, admissionDate, formType);
        
        const isValid = PatientContextGuard.validate(
            lockedKey,
            originalPatientId,
            encounterId,
            admissionDate,
            formType
        );
        expect(isValid).toBe(true);
    });

    it('blocks clinical writeback and fails validation when patient ID is mutated/changed (Anti-Cross-Contamination)', () => {
        const lockedKey = PatientContextGuard.createKey(originalPatientId, encounterId, admissionDate, formType);
        
        // Simulating patient tab switch or grid selection change
        const isValid = PatientContextGuard.validate(
            lockedKey,
            differentPatientId,
            encounterId,
            admissionDate,
            formType
        );
        
        expect(isValid).toBe(false);
    });

    it('rejects validation when essential identifiers are missing to prevent unsafe writeback', () => {
        // PatientContextGuard.createKey throws an error if patientId or encounterId is missing
        expect(() => {
            PatientContextGuard.createKey('', encounterId, admissionDate, formType);
        }).toThrow('Missing required patient identifiers');

        expect(() => {
            PatientContextGuard.createKey(originalPatientId, '', admissionDate, formType);
        }).toThrow('Missing required patient identifiers');
    });
});
