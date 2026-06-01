/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('PatientObserver', () => {
    beforeEach(() => {
        // Setup mock event bus
        window.HIS = window.HIS || {};
        window.HIS.EventBus = {
            emit: vi.fn(),
            on: vi.fn()
        };
        window.HIS.Logger = {
            info: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };

        // Reset document body
        document.body.innerHTML = '';
    });

    afterEach(() => {
        if (window.HIS?.PatientObserver) {
            window.HIS.PatientObserver.stop();
        }
        vi.restoreAllMocks();
    });

    it('successfully observes inpatient grid and selects patient', async () => {
        // Mock inpatient grid HTML
        document.body.innerHTML = `
            <table id="grdBenhNhan">
                <tbody>
                    <tr id="PID_INPATIENT_123" class="ui-widget-content">
                        <td>1</td>
                        <td>NGUYỄN VĂN A</td>
                    </tr>
                </tbody>
            </table>
        `;

        // Import module dynamically
        await import('../../shared/patient-observer.js');

        // Start observing
        window.HIS.PatientObserver.start();

        // Simulate selection (add class ui-state-highlight)
        const tr = document.getElementById('PID_INPATIENT_123');
        tr.classList.add('ui-state-highlight');

        // Wait a tick for MutationObserver to fire
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check if EventBus.emit was called with inpatient patient:selected details
        expect(window.HIS.EventBus.emit).toHaveBeenCalledWith('patient:selected', expect.objectContaining({
            rowId: 'PID_INPATIENT_123',
            patientName: 'NGUYỄN VĂN A'
        }));
    });

    it('successfully observes outpatient grid and selects patient via KHAMBENHID', async () => {
        // Mock outpatient grid HTML
        document.body.innerHTML = `
            <table id="grdDSBenhNhan">
                <tbody>
                    <tr id="1" class="ui-widget-content">
                        <td>1</td>
                        <td aria-describedby="grdDSBenhNhan_KHAMBENHID"> 100200300 </td>
                        <td> NGUYỄN THỊ B </td>
                    </tr>
                </tbody>
            </table>
        `;

        // Start observing
        window.HIS.PatientObserver.start();

        // Simulate selection
        const tr = document.getElementById('1');
        tr.classList.add('ui-state-highlight');

        // Wait a tick
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check if EventBus.emit was called with outpatient patient:selected details
        expect(window.HIS.EventBus.emit).toHaveBeenCalledWith('patient:selected', expect.objectContaining({
            rowId: '100200300',
            patientName: 'NGUYỄN THỊ B'
        }));
    });
});
