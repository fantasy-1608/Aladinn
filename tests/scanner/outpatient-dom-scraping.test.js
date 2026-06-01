/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Simulated implementations of api-bridge.js outpatient DOM helper functions
function _findDomElementBySelectors(selectors) {
    if (!Array.isArray(selectors)) selectors = [selectors];
    for (var s = 0; s < selectors.length; s++) {
        var selector = selectors[s];
        try {
            var el = document.querySelector(selector);
            if (el) return el;
        } catch (err) {}
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
            try {
                var doc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                if (doc) {
                    var innerEl = doc.querySelector(selector);
                    if (innerEl) return innerEl;
                }
            } catch (_e) {}
        }
    }
    return null;
}

function _findDomValBySelectors(selectors) {
    var el = _findDomElementBySelectors(selectors);
    if (!el) return '';
    return (el.value || el.textContent || '').trim();
}

describe('Bóc tách Dữ liệu Chẩn đoán Ngoại trú từ DOM', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('bóc tách chính xác chẩn đoán chính và bệnh kèm theo bằng selector chuẩn exact ID', () => {
        // Setup mock DOM với các ID chuẩn tabBenhAntxt*
        const maBenhChinhInput = document.createElement('input');
        maBenhChinhInput.id = 'tabBenhAntxtMABENHCHINH';
        maBenhChinhInput.value = 'M13';
        document.body.appendChild(maBenhChinhInput);

        const tenBenhChinhInput = document.createElement('input');
        tenBenhChinhInput.id = 'tabBenhAntxtBENHCHINH';
        tenBenhChinhInput.value = 'Các viêm khớp khác';
        document.body.appendChild(tenBenhChinhInput);

        const maKemTheoInput = document.createElement('input');
        maKemTheoInput.id = 'tabBenhAntxtMABENHKEMTHEO';
        maKemTheoInput.value = 'M79.1';
        document.body.appendChild(maKemTheoInput);

        const tenKemTheoInput = document.createElement('input');
        tenKemTheoInput.id = 'tabBenhAntxtBENHKEMTHEO';
        tenKemTheoInput.value = 'Đau cơ';
        document.body.appendChild(tenKemTheoInput);

        // Run scrapers
        const maBenhChinh = _findDomValBySelectors(['#tabBenhAntxtMABENHCHINH', '[id$="MABENHCHINH" i]']);
        const tenBenhChinh = _findDomValBySelectors(['#tabBenhAntxtBENHCHINH', '[id$="BENHCHINH" i]:not([id$="MABENHCHINH" i])']);
        const maKemTheo = _findDomValBySelectors(['#tabBenhAntxtMABENHKEMTHEO', '[id$="MABENHKEMTHEO" i]']);
        const tenKemTheo = _findDomValBySelectors(['#tabBenhAntxtBENHKEMTHEO', '[id$="BENHKEMTHEO" i]:not([id$="MABENHKEMTHEO" i])']);

        let chanDoanBanDau = '';
        if (tenBenhChinh) {
            if (tenBenhChinh.includes('-')) {
                chanDoanBanDau = tenBenhChinh;
            } else {
                chanDoanBanDau = maBenhChinh ? maBenhChinh + '-' + tenBenhChinh : tenBenhChinh;
            }
        }

        let chanDoanKemTheo = '';
        if (tenKemTheo) {
            if (tenKemTheo.includes('-') || tenKemTheo.includes(';')) {
                chanDoanKemTheo = tenKemTheo;
            } else {
                chanDoanKemTheo = maKemTheo ? maKemTheo + '-' + tenKemTheo : tenKemTheo;
            }
        }

        expect(chanDoanBanDau).toBe('M13-Các viêm khớp khác');
        expect(chanDoanKemTheo).toBe('M79.1-Đau cơ');
    });

    it('bóc tách chính xác bằng case-insensitive selectors khi id không chứa prefix tabBenhAn', () => {
        // Setup mock DOM với ID tùy biến không có prefix
        const maBenhChinhInput = document.createElement('input');
        maBenhChinhInput.id = 'txtMABENHCHINH';
        maBenhChinhInput.value = 'M13';
        document.body.appendChild(maBenhChinhInput);

        const tenBenhChinhInput = document.createElement('input');
        tenBenhChinhInput.id = 'txtBENHCHINH';
        tenBenhChinhInput.value = 'Các viêm khớp khác';
        document.body.appendChild(tenBenhChinhInput);

        const maKemTheoInput = document.createElement('input');
        maKemTheoInput.id = 'txtMABENHKEMTHEO';
        maKemTheoInput.value = 'M79.1';
        document.body.appendChild(maKemTheoInput);

        const tenKemTheoInput = document.createElement('input');
        tenKemTheoInput.id = 'txtBENHKEMTHEO';
        tenKemTheoInput.value = 'Đau cơ';
        document.body.appendChild(tenKemTheoInput);

        // Run scrapers using only the case-insensitive fallback logic
        const maBenhChinh = _findDomValBySelectors(['[id$="MABENHCHINH" i]']);
        const tenBenhChinh = _findDomValBySelectors(['[id$="BENHCHINH" i]:not([id$="MABENHCHINH" i])']);
        const maKemTheo = _findDomValBySelectors(['[id$="MABENHKEMTHEO" i]']);
        const tenKemTheo = _findDomValBySelectors(['[id$="BENHKEMTHEO" i]:not([id$="MABENHKEMTHEO" i])']);

        let chanDoanBanDau = '';
        if (tenBenhChinh) {
            if (tenBenhChinh.includes('-')) {
                chanDoanBanDau = tenBenhChinh;
            } else {
                chanDoanBanDau = maBenhChinh ? maBenhChinh + '-' + tenBenhChinh : tenBenhChinh;
            }
        }

        let chanDoanKemTheo = '';
        if (tenKemTheo) {
            if (tenKemTheo.includes('-') || tenKemTheo.includes(';')) {
                chanDoanKemTheo = tenKemTheo;
            } else {
                chanDoanKemTheo = maKemTheo ? maKemTheo + '-' + tenKemTheo : tenKemTheo;
            }
        }

        expect(chanDoanBanDau).toBe('M13-Các viêm khớp khác');
        expect(chanDoanKemTheo).toBe('M79.1-Đau cơ');
    });

    it('không chèn thêm mã ICD nếu giá trị DOM của chẩn đoán đã chứa định dạng mã và dấu phân tách', () => {
        // Setup mock DOM mà chẩn đoán kèm theo đã chứa mã (VD: khi gõ hoặc lấy thô hoàn chỉnh)
        const tenKemTheoInput = document.createElement('input');
        tenKemTheoInput.id = 'tabBenhAntxtBENHKEMTHEO';
        tenKemTheoInput.value = 'M79.1-Đau cơ;K21-Bệnh trào ngược dạ dày - thực quản';
        document.body.appendChild(tenKemTheoInput);

        const maKemTheoInput = document.createElement('input');
        maKemTheoInput.id = 'tabBenhAntxtMABENHKEMTHEO';
        maKemTheoInput.value = 'M79.1';
        document.body.appendChild(maKemTheoInput);

        const tenKemTheo = _findDomValBySelectors(['#tabBenhAntxtBENHKEMTHEO', '[id$="BENHKEMTHEO" i]:not([id$="MABENHKEMTHEO" i])']);
        const maKemTheo = _findDomValBySelectors(['#tabBenhAntxtMABENHKEMTHEO', '[id$="MABENHKEMTHEO" i]']);

        let chanDoanKemTheo = '';
        if (tenKemTheo) {
            if (tenKemTheo.includes('-') || tenKemTheo.includes(';')) {
                // Đã định dạng sẵn -> giữ nguyên, tránh tạo chuỗi lặp: M79.1-M79.1-Đau cơ...
                chanDoanKemTheo = tenKemTheo;
            } else {
                chanDoanKemTheo = maKemTheo ? maKemTheo + '-' + tenKemTheo : tenKemTheo;
            }
        }

        expect(chanDoanKemTheo).toBe('M79.1-Đau cơ;K21-Bệnh trào ngược dạ dày - thực quản');
    });

    it('bóc tách dữ liệu từ iframe phụ thuộc cùng nguồn (same-origin iframe)', () => {
        // Tạo iframe giả lập
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);

        // Tạo cấu trúc DOM bên trong iframe
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.body.innerHTML = `
            <input id="tabBenhAntxtBENHKEMTHEO" value="K21-Trào ngược" />
        `;

        const val = _findDomValBySelectors(['#tabBenhAntxtBENHKEMTHEO']);
        expect(val).toBe('K21-Trào ngược');
    });
});
