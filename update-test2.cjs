const fs = require('fs');
let code = fs.readFileSync('tests/cds/engine-parity.test.js', 'utf8');

const fixtures = `
    it('Fixture 12: Drug-Lab Rule with range operator', async () => {
        const context = {
            medications: [{ display_name: 'Metformin 850mg' }],
            encounter: { diagnoses: [{ code: 'E11.9' }] },
            labs: [
                { code: 'glucose', value: 5.5, unit: 'mmol/L' }
            ]
        };
        await runParityTest(context);
    });

    it('Fixture 13: Insurance Rule skipping for paracetamol', async () => {
        const context = {
            medications: [{ display_name: 'Efferalgan 500mg' }], // paracetamol
            encounter: { diagnoses: [{ code: 'E11.9' }] }, // Not R50
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 14: filterLow = true removes low severity alerts', async () => {
        const context = {
            medications: [
                { display_name: 'Metformin 850mg' }, // Triggers LAB-METFORMIN-GLUCOSE-NORMAL (low severity)
                { display_name: 'Ibuprofen 400mg' }, // Just something else
                { display_name: 'Diclofenac 50mg' }  // Triggers DDI (high severity)
            ],
            encounter: { diagnoses: [{ code: 'M13.9' }] },
            labs: [
                { code: 'glucose', value: 5.5, unit: 'mmol/L' }
            ]
        };
        
        const runParityTestFilterLow = async (ctx) => {
            const { analyzeLocally, setFeatureFlags } = await import('../../content/cds/engine.js');
            const { normalizationCache } = await import('../../content/cds/normalization-cache.js');
            
            setFeatureFlags({ cds_runtime_rule_index: false, cds_normalization_cache: false });
            const oldResult = await analyzeLocally(ctx, true); // true = filterLow
            
            normalizationCache.clear();
            setFeatureFlags({ cds_runtime_rule_index: true, cds_normalization_cache: true });
            const newColdResult = await analyzeLocally(ctx, true);
            const newWarmResult = await analyzeLocally(ctx, true);
            
            const sortAlerts = (res) => ({ ...res, alerts: [...res.alerts].sort((a, b) => a.rule_code.localeCompare(b.rule_code)) });
            const oldSorted = sortAlerts(oldResult);
            const newColdSorted = sortAlerts(newColdResult);
            const newWarmSorted = sortAlerts(newWarmResult);
            
            expect(newColdSorted.alerts.length).toBe(oldSorted.alerts.length);
            expect(newWarmSorted.alerts.length).toBe(oldSorted.alerts.length);
            expect(newColdSorted).toEqual(oldSorted);
            expect(newWarmSorted).toEqual(oldSorted);
        };
        
        await runParityTestFilterLow(context);
    });
});
`;

code = code.replace(/}\);\n}\);\n?$/, fixtures);
// wait, the file ends with `    });\n});\n`
code = code.substring(0, code.lastIndexOf('});')) + fixtures;

// update the mocks
code = code.replace(
    /dbUtils\.getDrugLabRules\.mockResolvedValue\(\[/,
    `dbUtils.getDrugLabRules.mockResolvedValue([\n            { is_active: 1, drugs: ['metformin'], lab_code: 'glucose', operator: 'range', threshold: 4.0, threshold_max: 6.0, severity: 'low', rule_code: 'LAB-METFORMIN-GLUCOSE-NORMAL', clinical_effect: 'Đường huyết bình thường', recommendation: 'Duy trì liều' },`
);

code = code.replace(
    /dbUtils\.getInsuranceRules\.mockResolvedValue\(\[/,
    `dbUtils.getInsuranceRules.mockResolvedValue([\n            { is_active: 1, generic_name: 'paracetamol', condition_type: 'icd_prefix_required', condition_value: 'R50', severity: 'low', rule_code: 'INS-PARA-R50', message: 'Yêu cầu chẩn đoán sốt' },`
);


fs.writeFileSync('tests/cds/engine-parity.test.js', code);
