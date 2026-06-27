// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import {
    classifyLatestDiagnosis,
    scanPatientsSequentially,
    WARD_OVERVIEW_LIMITS
} from '../../content/scanner/ward-overview-core.js';

describe('Tổng quan khoa', () => {
    it('xếp chẩn đoán nguy cơ cao vào nhóm cần chú ý và nêu lý do', () => {
        const result = classifyLatestDiagnosis('Nhiễm khuẩn huyết; suy hô hấp cấp');

        expect(result.level).toBe('attention');
        expect(result.matches).toContain('nhiễm khuẩn huyết');
        expect(result.matches).toContain('suy hô hấp');
    });

    it('xếp chẩn đoán hậu phẫu vào nhóm cần theo dõi', () => {
        const result = classifyLatestDiagnosis('Hậu phẫu ngày 1 cắt ruột thừa');

        expect(result.level).toBe('monitor');
        expect(result.matches).toContain('hậu phẫu');
    });

    it('không tự suy luận khi tờ điều trị mới nhất thiếu chẩn đoán', () => {
        expect(classifyLatestDiagnosis('')).toEqual({
            level: 'missing',
            matches: [],
            reason: 'Chưa có chẩn đoán trong tờ điều trị mới nhất'
        });
    });

    it('quét tuần tự, không tạo request song song và nghỉ giữa các bệnh nhân', async () => {
        let activeRequests = 0;
        let maxActiveRequests = 0;
        const fetchPatient = vi.fn(async ({ rowId }) => {
            activeRequests += 1;
            maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
            await Promise.resolve();
            activeRequests -= 1;
            return { success: true, rowId, latestDiagnosis: 'Theo dõi sau mổ' };
        });
        const sleep = vi.fn(async () => {});

        const result = await scanPatientsSequentially(
            [{ rowId: '1' }, { rowId: '2' }, { rowId: '3' }],
            fetchPatient,
            { delayMs: 2000, sleep }
        );

        expect(result).toHaveLength(3);
        expect(maxActiveRequests).toBe(1);
        expect(sleep).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenCalledWith(2000);
    });

    it('giới hạn số bệnh nhân và dừng sau ba lỗi liên tiếp để bảo vệ HIS', async () => {
        const rows = Array.from(
            { length: WARD_OVERVIEW_LIMITS.maxPatients + 10 },
            (_, index) => ({ rowId: String(index + 1) })
        );
        const fetchPatient = vi.fn(async () => ({ success: false, error: 'timeout' }));

        const result = await scanPatientsSequentially(rows, fetchPatient, {
            delayMs: 0,
            sleep: async () => {}
        });

        expect(fetchPatient).toHaveBeenCalledTimes(WARD_OVERVIEW_LIMITS.maxConsecutiveFailures);
        expect(result.stoppedForSafety).toBe(true);
    });

    it('tôn trọng tín hiệu hủy trước request kế tiếp', async () => {
        const controller = new AbortController();
        const fetchPatient = vi.fn(async ({ rowId }) => {
            controller.abort();
            return { success: true, rowId, latestDiagnosis: 'Ổn định' };
        });

        const result = await scanPatientsSequentially(
            [{ rowId: '1' }, { rowId: '2' }],
            fetchPatient,
            { delayMs: 0, sleep: async () => {}, signal: controller.signal }
        );

        expect(fetchPatient).toHaveBeenCalledTimes(1);
        expect(result.cancelled).toBe(true);
    });

    it('dùng bộ hẹn giờ mặc định khi không truyền hàm sleep', async () => {
        vi.useFakeTimers();
        const fetchPatient = vi.fn(async ({ rowId }) => ({
            success: true,
            rowId,
            latestDiagnosis: 'Ổn định'
        }));

        const scanPromise = scanPatientsSequentially(
            [{ rowId: '1' }, { rowId: '2' }],
            fetchPatient,
            { delayMs: 10 }
        );
        await vi.runAllTimersAsync();
        const result = await scanPromise;
        vi.useRealTimers();

        expect(result).toHaveLength(2);
    });
});
