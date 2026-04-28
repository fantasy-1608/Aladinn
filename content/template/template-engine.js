/**
 * template-engine.js
 * Xử lý sự kiện gõ phím để kích hoạt Slash Command (Template Bệnh Án)
 */
import { templateUI } from './template-ui.js';

class TemplateEngine {
    constructor() {
        this.init();
    }

    init() {
        // Lắng nghe sự kiện input/keyup trên toàn bộ document (Event Delegation)
        document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
        document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
        document.addEventListener('click', this.handleClickOutside.bind(this));
    }

    isValidTarget(target) {
        if (!target) return false;
        
        const tagName = target.tagName.toLowerCase();
        if (tagName === 'textarea') return true;
        
        if (tagName === 'input') {
            const type = target.type.toLowerCase();
            if (type === 'text' || type === 'search') {
                // Không bắt trên ô tìm kiếm bệnh nhân hoặc mã bệnh nhân nếu có thể (dựa vào id/class)
                const id = target.id || '';
                const cls = target.className || '';
                if (id.toLowerCase().includes('search') || cls.toLowerCase().includes('search')) {
                    return false;
                }
                return true;
            }
        }
        
        return false;
    }

    handleKeyDown(e) {
        // Nếu menu đang mở, chặn các phím điều hướng (Lên, Xuống, Enter) để không ảnh hưởng textarea
        if (templateUI.isOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            templateUI.handleKeyDown(e);
        }
    }

    handleKeyUp(e) {
        const target = e.target;
        if (!this.isValidTarget(target)) return;

        // Nếu menu đang mở và nhấn Escape, Menu UI sẽ tự handle và close
        if (templateUI.isOpen && e.key === 'Escape') {
            templateUI.handleKeyDown(e);
            return;
        }

        // Bỏ qua các phím điều hướng nếu menu đang mở (đã handle ở keydown)
        if (templateUI.isOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
            return;
        }

        const value = target.value;
        const cursorPos = target.selectionStart;

        // Tìm vị trí dấu / gần nhất trước con trỏ
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

        if (lastSlashIndex !== -1) {
            // Đảm bảo dấu / ở đầu dòng hoặc sau một dấu cách (để tránh nhầm với URL hoặc ngày tháng)
            const isAtStartOrSpace = lastSlashIndex === 0 || textBeforeCursor[lastSlashIndex - 1] === ' ' || textBeforeCursor[lastSlashIndex - 1] === '\\n';
            
            if (isAtStartOrSpace) {
                const query = textBeforeCursor.substring(lastSlashIndex + 1);
                
                // Nếu query không chứa khoảng trắng (chỉ là 1 từ liền mạch) -> Kích hoạt menu
                if (!/\\s/.test(query)) {
                    if (!templateUI.isOpen) {
                        templateUI.open(target, lastSlashIndex);
                    }
                    templateUI.updateQuery(query);
                    return;
                }
            }
        }

        // Nếu không thỏa mãn điều kiện, đóng menu
        if (templateUI.isOpen) {
            templateUI.close();
        }
    }

    handleClickOutside(e) {
        if (templateUI.isOpen) {
            // Trừ khi click vào chính menu
            if (templateUI.menuEl && !templateUI.menuEl.contains(e.target)) {
                templateUI.close();
            }
        }
    }
}

// Khởi tạo Engine
export function initTemplateEngine() {
    return new TemplateEngine();
}
