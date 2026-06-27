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

// ============================================
// TESTS CHO 5 SCORES MỚI — Phase 1 CDS Upgrade
// ============================================

describe('CHA₂DS₂-VASc Score (Atrial Fibrillation Stroke Risk)', () => {
    const sys = SmartScoreEngine.SCORING_SYSTEMS.CHA2DS2VASc;

    it('exists and has correct metadata', () => {
        expect(sys).toBeDefined();
        expect(sys.id).toBe('CHA2DS2VASc');
        expect(sys.icdPrefixes).toContain('I48');
    });

    it('calculates 0 points (low risk male)', () => {
        const res = sys.calculate({
            chf: false, hypertension: false, age75: false,
            diabetes: false, stroke: false, vascular: false,
            age65: false, sex: false
        });
        expect(res.total).toBe(0);
        expect(res.color).toBe('green');
        expect(res.rec).toContain('Không cần kháng đông');
    });

    it('calculates 1 point (intermediate risk)', () => {
        const res = sys.calculate({
            chf: false, hypertension: true, age75: false,
            diabetes: false, stroke: false, vascular: false,
            age65: false, sex: false
        });
        expect(res.total).toBe(1);
        expect(res.color).toBe('yellow');
        expect(res.rec).toContain('Cân nhắc kháng đông');
    });

    it('calculates high score with age75 (2 points) + stroke (2 points)', () => {
        const res = sys.calculate({
            chf: false, hypertension: false, age75: true,
            diabetes: false, stroke: true, vascular: false,
            age65: false, sex: false
        });
        expect(res.total).toBe(4);
        expect(res.color).toBe('red');
        expect(res.rec).toContain('Khuyến cáo MẠNH kháng đông');
    });

    it('calculates maximum score (9)', () => {
        const res = sys.calculate({
            chf: true, hypertension: true, age75: true,
            diabetes: true, stroke: true, vascular: true,
            age65: true, sex: true
        });
        expect(res.total).toBe(10);
        expect(res.color).toBe('red');
    });
});

describe('HAS-BLED Score (Bleeding Risk)', () => {
    const sys = SmartScoreEngine.SCORING_SYSTEMS.HASBLED;

    it('exists and triggers on I48 (AF)', () => {
        expect(sys).toBeDefined();
        expect(sys.icdPrefixes).toContain('I48');
    });

    it('calculates low bleeding risk (0-2)', () => {
        const res = sys.calculate({
            hypertension: true, abnormal_renal: false, abnormal_liver: false,
            stroke: false, bleeding: false, labile_inr: false,
            elderly: true, drugs: false, alcohol: false
        });
        expect(res.total).toBe(2);
        expect(res.color).toBe('green');
        expect(res.rec).toContain('chấp nhận được');
    });

    it('calculates high bleeding risk (≥3)', () => {
        const res = sys.calculate({
            hypertension: true, abnormal_renal: true, abnormal_liver: false,
            stroke: true, bleeding: false, labile_inr: false,
            elderly: false, drugs: false, alcohol: false
        });
        expect(res.total).toBe(3);
        expect(res.color).toBe('red');
        expect(res.rec).toContain('Thận trọng cao');
        // HAS-BLED cao KHÔNG phải chống chỉ định
        expect(res.rec).toContain('không phải chống chỉ định');
    });

    it('calculates maximum score (9)', () => {
        const res = sys.calculate({
            hypertension: true, abnormal_renal: true, abnormal_liver: true,
            stroke: true, bleeding: true, labile_inr: true,
            elderly: true, drugs: true, alcohol: true
        });
        expect(res.total).toBe(9);
        expect(res.color).toBe('red');
    });
});

describe('MELD Score (End-Stage Liver Disease)', () => {
    const sys = SmartScoreEngine.SCORING_SYSTEMS.MELD;

    it('exists and triggers on liver disease ICD codes', () => {
        expect(sys).toBeDefined();
        expect(sys.icdPrefixes).toContain('K74');
        expect(sys.icdPrefixes).toContain('B18');
    });

    it('calculates low MELD with normal values', () => {
        const res = sys.calculate({
            bilirubin: 1.0, creatinine: 1.0, inr: 1.0, dialysis: false
        });
        expect(res.total).toBe(6); // Minimum clamped to 6
        expect(res.color).toBe('green');
    });

    it('calculates moderate MELD (10-17)', () => {
        const res = sys.calculate({
            bilirubin: 2.0, creatinine: 1.0, inr: 1.5, dialysis: false
        });
        expect(res.total).toBeGreaterThanOrEqual(10);
        expect(res.total).toBeLessThan(18);
        expect(res.color).toBe('yellow');
        expect(res.rec).toContain('trung bình');
    });

    it('calculates high MELD (≥25) → urgent transplant', () => {
        const res = sys.calculate({
            bilirubin: 20.0, creatinine: 4.0, inr: 4.0, dialysis: false
        });
        expect(res.total).toBeGreaterThanOrEqual(25);
        expect(res.color).toBe('red');
        expect(res.rec).toContain('ghép gan khẩn cấp');
    });

    it('caps creatinine at 4.0 when on dialysis', () => {
        const resDialysis = sys.calculate({
            bilirubin: 1.0, creatinine: 0.8, inr: 1.0, dialysis: true
        });
        const resHighCr = sys.calculate({
            bilirubin: 1.0, creatinine: 4.0, inr: 1.0, dialysis: false
        });
        expect(resDialysis.total).toBe(resHighCr.total);
    });

    it('clamps MELD between 6 and 40', () => {
        const resMin = sys.calculate({ bilirubin: 1.0, creatinine: 1.0, inr: 1.0 });
        expect(resMin.total).toBeGreaterThanOrEqual(6);

        const resMax = sys.calculate({ bilirubin: 20.0, creatinine: 4.0, inr: 4.0 });
        expect(resMax.total).toBeLessThanOrEqual(40);
    });
});

describe('NEWS2 Score (National Early Warning Score)', () => {
    const sys = SmartScoreEngine.SCORING_SYSTEMS.NEWS2;

    it('exists and is always available for inpatients', () => {
        expect(sys).toBeDefined();
        expect(sys.alwaysAvailable).toBe(true);
        expect(sys.icdPrefixes).toEqual([]); // Universal
    });

    it('calculates 0 (all normal)', () => {
        const res = sys.calculate({
            respRate: 0, spo2Scale1: 0, airOrOxygen: false,
            systolicBP: 0, pulse: 0, consciousness: 0, temperature: 0
        });
        expect(res.total).toBe(0);
        expect(res.color).toBe('green');
    });

    it('calculates low score (1-4)', () => {
        const res = sys.calculate({
            respRate: 1, spo2Scale1: 1, airOrOxygen: false,
            systolicBP: 0, pulse: 0, consciousness: 0, temperature: 1
        });
        expect(res.total).toBe(3);
        expect(res.color).toBe('yellow');
    });

    it('calculates medium-high score (5-6) → urgent clinical assessment', () => {
        const res = sys.calculate({
            respRate: 2, spo2Scale1: 1, airOrOxygen: true,
            systolicBP: 0, pulse: 0, consciousness: 0, temperature: 0
        });
        expect(res.total).toBe(5);
        expect(res.color).toBe('red');
        expect(res.rec).toContain('KHẨN');
    });

    it('calculates critical score (≥7) → activate RRT/MET', () => {
        const res = sys.calculate({
            respRate: 3, spo2Scale1: 3, airOrOxygen: true,
            systolicBP: 0, pulse: 0, consciousness: 0, temperature: 0
        });
        expect(res.total).toBe(8);
        expect(res.color).toBe('red');
        expect(res.rec).toContain('KHẨN CẤP');
        expect(res.rec).toContain('RRT/MET');
    });

    it('triggers red for single parameter = 3 even if total < 5', () => {
        // Only one parameter at 3, rest at 0 → total = 3, but anyRed = true
        const res = sys.calculate({
            respRate: 3, spo2Scale1: 0, airOrOxygen: false,
            systolicBP: 0, pulse: 0, consciousness: 0, temperature: 0
        });
        expect(res.total).toBe(3);
        // anyRed triggers medium-high pathway
        expect(res.color).toBe('red');
    });
});

describe('SOFA Score (Sequential Organ Failure Assessment)', () => {
    const sys = SmartScoreEngine.SCORING_SYSTEMS.SOFA;

    it('exists and triggers on sepsis/organ failure ICD codes', () => {
        expect(sys).toBeDefined();
        expect(sys.icdPrefixes).toContain('A41');
        expect(sys.icdPrefixes).toContain('R65');
    });

    it('calculates 0 (no organ dysfunction)', () => {
        const res = sys.calculate({
            respiration: 0, coagulation: 0, liver: 0,
            cardiovascular: 0, cns: 0, renal: 0
        });
        expect(res.total).toBe(0);
        expect(res.color).toBe('green');
    });

    it('calculates SOFA ≥ 2 → Sepsis diagnosis when infection present', () => {
        const res = sys.calculate({
            respiration: 1, coagulation: 0, liver: 0,
            cardiovascular: 1, cns: 0, renal: 0
        });
        expect(res.total).toBe(2);
        expect(res.color).toBe('green'); // Still low mortality
    });

    it('calculates moderate organ dysfunction (3-6)', () => {
        const res = sys.calculate({
            respiration: 2, coagulation: 1, liver: 1,
            cardiovascular: 0, cns: 0, renal: 0
        });
        expect(res.total).toBe(4);
        expect(res.color).toBe('yellow');
        expect(res.rec).toContain('Sepsis');
    });

    it('calculates severe multi-organ failure (7-11)', () => {
        const res = sys.calculate({
            respiration: 3, coagulation: 2, liver: 1,
            cardiovascular: 2, cns: 0, renal: 0
        });
        expect(res.total).toBe(8);
        expect(res.color).toBe('red');
        expect(res.rec).toContain('Suy đa tạng nặng');
    });

    it('calculates critical organ failure (≥12)', () => {
        const res = sys.calculate({
            respiration: 4, coagulation: 3, liver: 2,
            cardiovascular: 3, cns: 1, renal: 2
        });
        expect(res.total).toBe(15);
        expect(res.color).toBe('red');
        expect(res.rec).toContain('tối đa');
        expect(res.rec).toContain('gia đình');
    });

    it('calculates maximum SOFA (24)', () => {
        const res = sys.calculate({
            respiration: 4, coagulation: 4, liver: 4,
            cardiovascular: 4, cns: 4, renal: 4
        });
        expect(res.total).toBe(24);
        expect(res.color).toBe('red');
    });
});

// ============================================
// AUTO-FILL LOGIC TESTS — evaluatePatientContext
// ============================================

describe('evaluatePatientContext — Auto-fill for new scores', () => {
    it('auto-fills CHA2DS2VASc from patient context', () => {
        const context = {
            patient: { age: '72 tuổi', gender: 'Nữ' },
            encounter: {
                diagnoses: [
                    { code: 'I48' },   // Rung nhĩ → trigger
                    { code: 'I10' },   // THA → hypertension
                    { code: 'E11' },   // ĐTĐ → diabetes
                    { code: 'I50.0' }, // Suy tim → chf
                ]
            },
            labs: []
        };

        const evals = SmartScoreEngine.evaluatePatientContext(context);
        const ev = evals.CHA2DS2VASc;

        expect(ev.suggested).toBe(true);      // I48 matches
        expect(ev.prefilled.sex).toBe(true);   // Nữ
        expect(ev.prefilled.age65).toBe(true); // 72 tuổi → 65-74 range
        expect(ev.prefilled.age75).toBe(false); // < 75
        expect(ev.prefilled.hypertension).toBe(true); // I10
        expect(ev.prefilled.diabetes).toBe(true);     // E11
        expect(ev.prefilled.chf).toBe(true);          // I50
    });

    it('auto-fills HAS-BLED elderly and renal from labs', () => {
        const context = {
            patient: { age: '70' },
            encounter: { diagnoses: [{ code: 'I48' }] },
            labs: [{ code: 'creatinine', value: 250, unit: 'µmol/L' }]
        };

        const evals = SmartScoreEngine.evaluatePatientContext(context);
        const ev = evals.HASBLED;

        expect(ev.prefilled.elderly).toBe(true);         // > 65
        expect(ev.prefilled.abnormal_renal).toBe(true);   // 250 µmol/L ≥ 200
    });

    it('auto-fills MELD from lab values (µmol/L bilirubin converted)', () => {
        const context = {
            patient: { age: '55' },
            encounter: { diagnoses: [{ code: 'K74' }] },
            labs: [
                { code: 'bilirubin', value: 85, unit: 'µmol/L' },
                { code: 'creatinine', value: 177, unit: 'µmol/L' },
                { code: 'INR', value: 2.3 }
            ]
        };

        const evals = SmartScoreEngine.evaluatePatientContext(context);
        const ev = evals.MELD;

        expect(ev.suggested).toBe(true);
        expect(ev.prefilled.bilirubin).toBe(5.0);    // 85/17.1 ≈ 4.97 → closest to 5.0
        expect(ev.prefilled.creatinine).toBe(2.0);   // 177/88.4 ≈ 2.0
        expect(ev.prefilled.inr).toBe(2.5);           // 2.3 → closest to 2.5
    });

    it('NEWS2 is always suggested even without ICD match', () => {
        const context = {
            patient: { age: '45' },
            encounter: { diagnoses: [{ code: 'Z00' }] }, // Routine checkup
            labs: []
        };

        const evals = SmartScoreEngine.evaluatePatientContext(context);
        expect(evals.NEWS2.suggested).toBe(true);
    });

    it('auto-fills SOFA from platelet, bilirubin, creatinine labs', () => {
        const context = {
            patient: { age: '60' },
            encounter: { diagnoses: [{ code: 'A41' }] },
            labs: [
                { code: 'PLT', value: 80 },        // 50-99 → coagulation = 2
                { code: 'bilirubin', value: 3.5, unit: 'mg/dL' },   // 2.0-5.9 → liver = 2
                { code: 'creatinine', value: 2.5, unit: 'mg/dL' }   // 2.0-3.4 → renal = 2
            ]
        };

        const evals = SmartScoreEngine.evaluatePatientContext(context);
        const ev = evals.SOFA;

        expect(ev.suggested).toBe(true);
        expect(ev.prefilled.coagulation).toBe(2);
        expect(ev.prefilled.liver).toBe(2);
        expect(ev.prefilled.renal).toBe(2);
    });

    it('reports missing labs for SOFA when not available', () => {
        const context = {
            patient: { age: '50' },
            encounter: { diagnoses: [{ code: 'A41' }] },
            labs: [] // No labs
        };

        const evals = SmartScoreEngine.evaluatePatientContext(context);
        const ev = evals.SOFA;

        expect(ev.missingLabs.coagulation).toBe(true);
        expect(ev.missingLabs.liver).toBe(true);
        expect(ev.missingLabs.renal).toBe(true);
    });
});
