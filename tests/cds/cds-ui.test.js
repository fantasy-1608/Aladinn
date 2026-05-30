// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { CDSUI } from '../../content/cds/ui.js';

describe('CDSUI: update and drug deduplication', () => {
    beforeEach(() => {
        // Clear DOM and reset CDSUI panel state
        document.body.innerHTML = '';
        CDSUI.panel = null;
        CDSUI.iconToggle = null;
        CDSUI.isOpen = false;
    });

    it('should initialize and render panel correctly', () => {
        CDSUI.init();
        expect(document.getElementById('aladinn-cds-drawer')).not.toBeNull();
        expect(document.getElementById('aladinn-cds-panel')).not.toBeNull();
        expect(document.getElementById('aladinn-cds-shield')).not.toBeNull();
    });

    it('should clean and deduplicate unmapped drugs in the UI', () => {
        CDSUI.init();

        const summary = {
            critical_count: 0,
            warning_count: 0,
            info_count: 0,
            total_scanned: 3
        };
        const alerts = [];
        const debug = {
            normalized_drugs: ['Paracetamol 500mg'],
            unmapped_drugs: [
                'Foxitimed 1g',
                'Foxitimed 1g', // Duplicate
                'Foxitimed\u00a01g', // Duplicate with NBSP
                'Foxitimed\u200b1g', // Duplicate with zero-width space
                'Lidocain-BFS 200mg',
                'foxitimed 1g' // Duplicate with different case
            ]
        };
        const context = {
            patient: {
                id: 'BN123',
                name: 'LUONG THANH NHO'
            },
            encounter: {
                diagnoses: []
            }
        };

        CDSUI.update({ summary, alerts, debug, context });

        // Verify the number of unmapped drugs in the label
        const uncheckedGroup = document.querySelector('.cds-unchecked');
        expect(uncheckedGroup).not.toBeNull();
        
        const countSpan = uncheckedGroup.querySelector('.cds-coverage-count');
        expect(countSpan.textContent).toBe('(2)'); // Only 'Foxitimed 1g' and 'Lidocain-BFS 200mg'

        // Verify actual rendered pills
        const pills = Array.from(uncheckedGroup.querySelectorAll('.cds-pill.unchecked'));
        expect(pills).toHaveLength(2);
        
        const pillTexts = pills.map(p => p.textContent.trim());
        expect(pillTexts).toContain('Foxitimed 1g');
        expect(pillTexts).toContain('Lidocain-BFS 200mg');
    });

    it('should clean and deduplicate checked (normalized) drugs in the UI', () => {
        CDSUI.init();

        const summary = {
            critical_count: 0,
            warning_count: 0,
            info_count: 0,
            total_scanned: 5
        };
        const alerts = [];
        const debug = {
            normalized_drugs: [
                'Paracetamol 500mg',
                'Paracetamol 500mg', // Duplicate
                'Paracetamol\u00a0500mg', // Duplicate with NBSP
                'Metformin 850mg'
            ],
            unmapped_drugs: []
        };
        const context = {
            patient: {
                id: 'BN123',
                name: 'LUONG THANH NHO'
            },
            encounter: {
                diagnoses: []
            }
        };

        CDSUI.update({ summary, alerts, debug, context });

        // Verify the checked/normalized group label count
        const checkedGroup = document.querySelector('.cds-checked');
        expect(checkedGroup).not.toBeNull();
        
        const countSpan = checkedGroup.querySelector('.cds-coverage-count');
        expect(countSpan.textContent).toBe('(2)'); // Only 'Paracetamol 500mg' and 'Metformin 850mg'

        // Verify status text shows the unique count
        const statusText = document.getElementById('cds-status-text');
        expect(statusText.textContent).toContain('Đã phân tích: 2/5 thuốc');
    });
});
