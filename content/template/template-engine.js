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

        // Scan ngay lập tức và thêm 1 lần scan sau 3s cho iframe lazy-load
        // MutationObserver đã cover việc detect iframe mới — không cần poll vĩnh viễn
        this._scanIframes(document);
        setTimeout(() => this._scanIframes(document), 3000);
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
     * isValidTarget — cho phép mọi ô nhập liệu:
     *   - <textarea> bất kỳ
     *   - <input type="text"> hoặc <input type="search">
     *
     * Trigger là "//" (2 dấu gạch chéo) nên rất khó vô tình kích hoạt.
     * Không cần filter phức tạp nữa.
     */
    isValidTarget(target) {
        if (!target) return false;

        const tagName = target.tagName.toLowerCase();

        if (tagName === 'textarea') return true;

        if (tagName === 'input') {
            const type = (target.type || 'text').toLowerCase();
            return type === 'text' || type === 'search';
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

        // Trigger bằng "//" — tìm chuỗi "//" gần cursor nhất
        const lastDoubleSlashIndex = textBeforeCursor.lastIndexOf('//');

        if (lastDoubleSlashIndex !== -1) {
            // query là phần sau "//"
            const query = textBeforeCursor.substring(lastDoubleSlashIndex + 2);

            // Query không được chứa khoảng trắng/newline
            if (!/[\s\n]/.test(query)) {
                if (!templateUI.isOpen) {
                    templateUI.open(target, lastDoubleSlashIndex);
                }
                templateUI.updateQuery(query);
                return;
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
