/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import '../../content/shared/self-healing.js';

describe('Self-Healing DOM Engine', () => {
    let engine;

    beforeEach(() => {
        engine = window.SelfHealingEngine;
        document.body.innerHTML = '';
    });

    describe('Text Normalization', () => {
        it('normalizes Vietnamese characters with accents', () => {
            const result = engine.normalizeText('Lý do hội chẩn');
            expect(result).toBe('ly do hoi chan');
        });

        it('normalizes Đ and đ characters', () => {
            const result = engine.normalizeText('Đường tiêu hóa');
            expect(result).toBe('duong tieu hoa');
        });

        it('lowercases and trims spacing', () => {
            const result = engine.normalizeText('  CÂN   NẶNG (kg)  ');
            expect(result).toBe('can nang kg');
        });

        it('handles null or undefined safely', () => {
            expect(engine.normalizeText(null)).toBe('');
            expect(engine.normalizeText(undefined)).toBe('');
        });
    });

    describe('Semantic Field Finding', () => {
        it('finds input when exact "for" attribute is matched on label', () => {
            document.body.innerHTML = `
                <div>
                    <label for="weight_input_id">Cân nặng</label>
                    <input id="weight_input_id" type="text" />
                </div>
            `;
            const found = engine.findSemanticField(document, ['can nang'], 'input');
            expect(found).not.toBeNull();
            expect(found.id).toBe('weight_input_id');
        });

        it('finds nested input inside target label', () => {
            document.body.innerHTML = `
                <div>
                    <label>
                        Chiều cao (cm)
                        <input type="text" class="height-class" />
                    </label>
                </div>
            `;
            const found = engine.findSemanticField(document, ['chieu cao'], 'input');
            expect(found).not.toBeNull();
            expect(found.className).toBe('height-class');
        });

        it('finds element checking sibling hierarchy (up to 3 levels)', () => {
            document.body.innerHTML = `
                <div class="row">
                    <div class="col-label">
                        <span>Tiền sử bệnh</span>
                    </div>
                    <div class="col-input">
                        <textarea class="target-textarea"></textarea>
                    </div>
                </div>
            `;
            const found = engine.findSemanticField(document, ['tien su'], 'any');
            expect(found).not.toBeNull();
            expect(found.tagName.toLowerCase()).toBe('textarea');
            expect(found.className).toBe('target-textarea');
        });

        it('falls back to placeholders and title attributes matching directly', () => {
            document.body.innerHTML = `
                <div>
                    <input type="text" placeholder="Nhập chỉ số BMI..." class="bmi-input" />
                </div>
            `;
            const found = engine.findSemanticField(document, ['bmi'], 'input');
            expect(found).not.toBeNull();
            expect(found.className).toBe('bmi-input');
        });

        it('restricts findings to requested targetType (checkbox / radio)', () => {
            document.body.innerHTML = `
                <div class="form-group">
                    <label>Sụt cân không mong muốn</label>
                    <input type="text" class="wrong-text-input" />
                    <input type="checkbox" id="sut_can_cb" />
                </div>
            `;
            const found = engine.findSemanticField(document, ['sut can'], 'checkbox');
            expect(found).not.toBeNull();
            expect(found.id).toBe('sut_can_cb');
        });

        it('returns null when no matching elements are found', () => {
            document.body.innerHTML = `
                <div>
                    <label>Random label</label>
                    <input id="random_input" type="text" />
                </div>
            `;
            const found = engine.findSemanticField(document, ['non existent keyword'], 'input');
            expect(found).toBeNull();
        });
    });

    describe('Element Resolution Flow (resolveElement)', () => {
        it('resolves by traditional ID first', () => {
            document.body.innerHTML = `
                <div>
                    <input id="txtTOMTAT_TIEUSUBENH" class="correct-input" />
                    <label>Tiểu sử</label>
                    <input id="other_input" class="wrong-input" />
                </div>
            `;
            const resolved = engine.resolveElement(document, 'txtTOMTAT_TIEUSUBENH', 'tomTatTieuSuBenh');
            expect(resolved).not.toBeNull();
            expect(resolved.className).toBe('correct-input');
        });

        it('heals and resolves semantically when traditional ID is missing', () => {
            document.body.innerHTML = `
                <div>
                    <!-- Traditional ID txtTOMTAT_TIEUSUBENH is missing completely -->
                    <label>Tiểu sử bệnh</label>
                    <textarea class="healed-input"></textarea>
                </div>
            `;
            const resolved = engine.resolveElement(document, 'txtTOMTAT_TIEUSUBENH', 'tomTatTieuSuBenh');
            expect(resolved).not.toBeNull();
            expect(resolved.className).toBe('healed-input');
        });
    });
});
