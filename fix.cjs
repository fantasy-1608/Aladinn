const fs = require('fs');
let code = fs.readFileSync('tests/cds/engine-parity.test.js', 'utf8');

// I will find the end of Fixture 11 and cut the rest.
const fix11Start = code.indexOf("it('Fixture 11");
const end11 = code.indexOf("});", code.indexOf("await runParityTest(context);", fix11Start)) + 3;

code = code.substring(0, end11);

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

fs.writeFileSync('tests/cds/engine-parity.test.js', code + fixtures);
