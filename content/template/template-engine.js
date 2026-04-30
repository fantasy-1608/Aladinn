/**
 * template-engine.js
 * Xử lý sự kiện gõ phím để kích hoạt Slash Command (Template Bệnh Án)
 * 
 * Fix v2:
 * - Bỏ trigger trên ô input trong grid/table bệnh nhân HIS
 * - Attach listener vào iframe same-origin để hoạt động trong form bệnh án
 */
import { templateUI } from './template-ui.js';

class TemplateEngine {
    constructor() {
        this._boundKeyUp   = this.handleKeyUp.bind(this);
        this._boundKeyDown = this.handleKeyDown.bind(this);
        this._boundClick   = this.handleClickOutside.bind(this);
        this._attachedDocs = new WeakSet(); // tránh attach 2 lần
        this.init();
    }

    init() {
        this._attachToDoc(document);

        // Quan sát iframe được thêm vào sau (HIS render iframe động)
        const observer = new MutationObserver(() => this._scanIframes(document));
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
        });

        // Scan ngay lập tức và poll nhẹ để bắt iframe lazy-load
        this._scanIframes(document);
        setInterval(() => this._scanIframes(document), 2000);
    }

    /** Attach listener vào 1 document (top hoặc iframe) */
    _attachToDoc(doc) {
        if (!doc || this._attachedDocs.has(doc)) return;
        this._attachedDocs.add(doc);

        doc.addEventListener('keyup',  this._boundKeyUp,   true);
        doc.addEventListener('keydown', this._boundKeyDown, true);
        doc.addEventListener('click',   this._boundClick);
    }

    /** Đệ quy tìm tất cả iframe same-origin và attach */
    _scanIframes(doc) {
        if (!doc) return;
        const iframes = doc.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                const innerDoc = iframe.contentDocument;
                if (innerDoc && innerDoc.readyState !== 'uninitialized') {
                    this._attachToDoc(innerDoc);
                    this._scanIframes(innerDoc); // đệ quy iframe lồng nhau
                }
            } catch (_e) {
                // Cross-origin → bỏ qua
            }
        });
    }

    /**
     * isValidTarget — chỉ cho phép:
     *   - <textarea> bất kỳ (kể cả trong form bệnh án dạng bảng)
     *   - <input type="text"> KHÔNG nằm trong grid filter row của HIS
     *
     * Phân biệt:
     *   Grid filter: row có ≥3 input (dãy ô lọc bệnh nhân đầu bảng)
     *   Form bệnh án: bảng 2 cột label|textarea/input → luôn cho phép
     */
    isValidTarget(target) {
        if (!target) return false;

        const tagName = target.tagName.toLowerCase();

        // Textarea: luôn hợp lệ (HIS form dùng table layout nhưng vẫn là form hợp lệ)
        if (tagName === 'textarea') return true;

        if (tagName === 'input') {
            const type = (target.type || 'text').toLowerCase();
            if (type !== 'text' && type !== 'search') return false;

            const id          = (target.id  || '').toLowerCase();
            const cls         = (target.className || '').toLowerCase();
            const name        = (target.name || '').toLowerCase();
            const placeholder = (target.placeholder || '').toLowerCase();

            // 1. Ô có từ khóa tìm kiếm rõ ràng
            const searchWords = ['search', 'filter', 'lookup', 'timkiem', 'find'];
            if (searchWords.some(w => id.includes(w) || cls.includes(w) || placeholder.includes(w))) {
                return false;
            }

            // 2. Reject nếu nằm trong <th> (header cell → chắc chắn là filter)
            if (target.closest('th')) return false;

            // 3. Reject nếu row hiện tại có ≥3 input (đặc trưng grid filter HIS)
            //    Form bệnh án 2 cột chỉ có 1 input/row → an toàn
            const parentRow = target.closest('tr');
            if (parentRow) {
                const inputsInRow = parentRow.querySelectorAll('input[type="text"], input:not([type])').length;
                if (inputsInRow >= 3) return false;
            }

            // 4. Ô có id/name khớp pattern mã filter của HIS (maBN, ngayTu, denNgay...)
            const codePatterns = /^(ma[a-z]|ngay|tunga|dennga|trangtha|loaidk)/i;
            if (codePatterns.test(id) || codePatterns.test(name)) return false;

            return true;
        }

        return false;
    }

    handleKeyDown(e) {
        if (templateUI.isOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            templateUI.handleKeyDown(e);
        }
    }

    handleKeyUp(e) {
        const target = e.target;
        if (!this.isValidTarget(target)) return;

        if (templateUI.isOpen && e.key === 'Escape') {
            templateUI.handleKeyDown(e);
            return;
        }

        if (templateUI.isOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            return;
        }

        const value = target.value || '';
        const cursorPos = target.selectionStart;

        const textBeforeCursor = value.substring(0, cursorPos);
        const lastSlashIndex   = textBeforeCursor.lastIndexOf('/');

        if (lastSlashIndex !== -1) {
            // Cho phép / ở bất kỳ vị trí nào, trừ sau chữ/số liền kề
            // (tránh http://, 1/2, 01/01)
            const charBefore    = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : '';
            const isPartOfToken = /[a-zA-Z0-9]/.test(charBefore);

            if (!isPartOfToken) {
                const query = textBeforeCursor.substring(lastSlashIndex + 1);

                // Query không được chứa khoảng trắng/newline
                if (!/[\s\n]/.test(query)) {
                    if (!templateUI.isOpen) {
                        // Nếu target trong iframe, cần truyền top-document để
                        // menu render trên top frame (không bị crop bởi iframe)
                        templateUI.open(target, lastSlashIndex);
                    }
                    templateUI.updateQuery(query);
                    return;
                }
            }
        }

        if (templateUI.isOpen) {
            templateUI.close();
        }
    }

    handleClickOutside(e) {
        if (templateUI.isOpen) {
            if (templateUI.menuEl && !templateUI.menuEl.contains(e.target)) {
                templateUI.close();
            }
        }
    }
}

export function initTemplateEngine() {
    return new TemplateEngine();
}
