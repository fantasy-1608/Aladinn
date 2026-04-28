/**
 * template-ui.js
 * Giao diện menu nổi cho Slash Command
 */
import { TemplateStore } from '../../shared/template-store.js';

class TemplateUI {
    constructor() {
        this.menuEl = null;
        this.templates = [];
        this.filteredTemplates = [];
        this.selectedIndex = 0;
        this.activeTarget = null;
        this.currentQuery = '';
        this.isOpen = false;
        this.queryStartPos = 0;
        
        this.init();
    }

    async init() {
        this.templates = await TemplateStore.getTemplates();
        this.createMenuElement();
        
        // Cập nhật lại template khi storage thay đổi
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.aladinn_templates) {
                this.templates = changes.aladinn_templates.newValue;
            }
        });
    }

    createMenuElement() {
        this.menuEl = document.createElement('div');
        this.menuEl.className = 'aladinn-template-menu';
        this.menuEl.style.display = 'none';
        document.body.appendChild(this.menuEl);
        
        // Thêm CSS
        if (!document.getElementById('aladinn-template-style')) {
            const style = document.createElement('style');
            style.id = 'aladinn-template-style';
            style.textContent = `
                .aladinn-template-menu {
                    position: absolute;
                    z-index: 10000;
                    width: 350px;
                    max-height: 250px;
                    overflow-y: auto;
                    background: rgba(30, 41, 59, 0.95);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(245, 158, 11, 0.2);
                    border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    color: #fff;
                    font-family: 'Inter', system-ui, sans-serif;
                    display: flex;
                    flex-direction: column;
                }
                .aladinn-template-menu-header {
                    padding: 8px 12px;
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #f59e0b;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    background: rgba(245, 158, 11, 0.05);
                }
                .aladinn-template-item {
                    padding: 10px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    transition: all 0.2s;
                }
                .aladinn-template-item:last-child {
                    border-bottom: none;
                }
                .aladinn-template-item.selected,
                .aladinn-template-item:hover {
                    background: rgba(245, 158, 11, 0.15);
                }
                .aladinn-template-item-title {
                    font-weight: 600;
                    font-size: 13px;
                    margin-bottom: 4px;
                    color: #fbbf24;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .aladinn-template-item-shortcut {
                    font-size: 11px;
                    background: rgba(255,255,255,0.1);
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: #cbd5e1;
                }
                .aladinn-template-item-content {
                    font-size: 12px;
                    color: #94a3b8;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .aladinn-template-empty {
                    padding: 15px;
                    text-align: center;
                    color: #94a3b8;
                    font-size: 13px;
                }
                /* Scrollbar */
                .aladinn-template-menu::-webkit-scrollbar {
                    width: 6px;
                }
                .aladinn-template-menu::-webkit-scrollbar-track {
                    background: transparent;
                }
                .aladinn-template-menu::-webkit-scrollbar-thumb {
                    background: rgba(245, 158, 11, 0.3);
                    border-radius: 3px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    open(targetEl, queryStartPos) {
        if (!this.templates || this.templates.length === 0) return;
        
        this.activeTarget = targetEl;
        this.queryStartPos = queryStartPos;
        this.currentQuery = '';
        this.isOpen = true;
        
        this.updateFilter();
        this.positionMenu();
        this.menuEl.style.display = 'flex';
    }

    close() {
        this.isOpen = false;
        this.menuEl.style.display = 'none';
        this.activeTarget = null;
    }

    updateQuery(query) {
        this.currentQuery = query.toLowerCase();
        this.updateFilter();
    }

    updateFilter() {
        if (!this.currentQuery) {
            this.filteredTemplates = [...this.templates];
        } else {
            this.filteredTemplates = this.templates.filter(t => 
                t.shortcut.toLowerCase().includes(this.currentQuery) || 
                t.title.toLowerCase().includes(this.currentQuery)
            );
        }
        
        this.selectedIndex = 0;
        this.renderMenu();
    }

    renderMenu() {
        if (this.filteredTemplates.length === 0) {
            this.menuEl.innerHTML = `<div class="aladinn-template-empty">Không tìm thấy mẫu nào phù hợp với "${this.currentQuery}"</div>`;
            return;
        }

        let html = '<div class="aladinn-template-menu-header">Mẫu Bệnh Án</div>';
        
        this.filteredTemplates.forEach((t, index) => {
            const isSelected = index === this.selectedIndex ? 'selected' : '';
            html += `
                <div class="aladinn-template-item ${isSelected}" data-index="${index}">
                    <div class="aladinn-template-item-title">
                        ${t.title} <span class="aladinn-template-item-shortcut">/${t.shortcut}</span>
                    </div>
                    <div class="aladinn-template-item-content">${t.content}</div>
                </div>
            `;
        });

        this.menuEl.innerHTML = html;

        // Add click events
        const items = this.menuEl.querySelectorAll('.aladinn-template-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.getAttribute('data-index'));
                this.selectTemplate(idx);
            });
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = parseInt(item.getAttribute('data-index'));
                this.highlightSelected();
            });
        });
    }

    positionMenu() {
        if (!this.activeTarget) return;
        
        // Lấy toạ độ của textarea (để hiển thị ngay bên dưới)
        const rect = this.activeTarget.getBoundingClientRect();
        
        this.menuEl.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        this.menuEl.style.left = (rect.left + window.scrollX) + 'px';
        
        // Tránh bị tràn màn hình
        const menuRect = this.menuEl.getBoundingClientRect();
        if (rect.left + menuRect.width > window.innerWidth) {
            this.menuEl.style.left = (window.innerWidth - menuRect.width - 10) + 'px';
        }
    }

    handleKeyDown(e) {
        if (!this.isOpen) return false;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.filteredTemplates.length;
            this.highlightSelected();
            return true;
        }
        
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.filteredTemplates.length) % this.filteredTemplates.length;
            this.highlightSelected();
            return true;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            this.selectTemplate(this.selectedIndex);
            return true;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            return true;
        }

        return false;
    }

    highlightSelected() {
        const items = this.menuEl.querySelectorAll('.aladinn-template-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                // Scroll into view if needed
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    selectTemplate(index) {
        if (index < 0 || index >= this.filteredTemplates.length) return;
        
        const template = this.filteredTemplates[index];
        const target = this.activeTarget;
        
        if (!target) return;

        // Thay thế nội dung từ dấu / đến vị trí hiện tại bằng content của template
        const text = target.value;
        const currentPos = target.selectionStart;
        
        const beforeMatch = text.substring(0, this.queryStartPos);
        const afterMatch = text.substring(currentPos);
        
        target.value = beforeMatch + template.content + afterMatch;
        
        // Đặt con trỏ sau nội dung vừa chèn
        const newPos = beforeMatch.length + template.content.length;
        target.setSelectionRange(newPos, newPos);
        
        // Trigger sự kiện input để hệ thống HIS nhận diện sự thay đổi
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        
        this.close();
    }
}

export const templateUI = new TemplateUI();
