const AIUIInjector = {
    /**
     * Inject AI styling and effects into the fill button
     * @param {HTMLElement} button 
     * @param {string} [label]
     */
    injectVIPState(button, label) {
        if (!button) return;

        const btnText = /** @type {HTMLElement|null} */ (button.querySelector('.btn-text'));

        // Clean up base label
        let baseText = label || (btnText ? btnText.innerText : button.innerText) || 'Điền Bệnh án';
        baseText = baseText.replace(/[✨📋⏳✅]/gu, '').replace(/\(VIP\)/gi, '').replace(/\(AI VIP\)/gi, '').trim();

        const iconUrl = chrome.runtime?.getURL ? chrome.runtime.getURL('assets/icons/icon16.png') : '';
        const vipText = `<img src="${iconUrl}" style="width:20px;height:20px;vertical-align:middle;margin-right:6px;"><span style="vertical-align:middle;">${baseText} (AI VIP)</span>`;

        if (btnText) {
            btnText.innerHTML = vipText;
        } else {
            button.innerHTML = vipText;
        }

        // Ép kiểu CSS ưu tiên cao nhất (important) để đè lên giao diện cũ
        button.style.setProperty('background', 'linear-gradient(135deg, #d4a853 0%, #f59e0b 100%)', 'important');
        button.style.setProperty('color', '#0b1121', 'important');
        button.style.setProperty('border', '2px solid rgba(255, 255, 255, 0.4)', 'important');
        button.style.setProperty('box-shadow', '0 4px 15px rgba(212, 168, 83, 0.5), 0 0 20px rgba(245, 158, 11, 0.4)', 'important');
        button.style.setProperty('text-shadow', 'none', 'important');
        button.style.setProperty('transform', 'scale(1.05)', 'important');
        button.style.setProperty('transition', 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', 'important');

        this._ensureKeyframes();
        button.classList.add('vnpt-ai-btn-active');
        button.classList.remove('vnpt-base-btn-active');
    },

    /**
     * Remove VIP styling
     * @param {HTMLElement} button 
     * @param {string} originalText 
     */
    removeVIPState(button, originalText) {
        if (!button) return;

        // Restore base HTML structure
        button.innerHTML = originalText;

        button.style.cssText = ''; // Reset inline styles
        button.classList.remove('vnpt-ai-btn-active');
        button.classList.add('vnpt-base-btn-active');
    },

    /**
     * Tạo công tắc Base/VIP
     * @param {Object} options
     * @param {boolean} options.initialState
     * @param {(state: boolean) => void} options.onChange
     * @returns {HTMLElement}
     */
    createToggle(options) {
        const wrapper = document.createElement('div');
        wrapper.id = 'vnpt-vip-toggle-wrapper';
        wrapper.innerHTML = `
            <div class="vnpt-toggle-container ${options.initialState ? 'vip-active' : ''}">
                <span class="toggle-label base">BASE</span>
                <div class="toggle-switch">
                    <div class="toggle-handle"></div>
                </div>
                <span class="toggle-label vip">VIP</span>
            </div>
        `;

        this._injectToggleStyles();

        const container = wrapper.querySelector('.vnpt-toggle-container');
        if (container) {
            container.addEventListener('click', () => {
                const newState = !container.classList.contains('vip-active');
                container.classList.toggle('vip-active', newState);
                options.onChange(newState);
            });
        }

        return wrapper;
    },

    _injectToggleStyles() {
        if (document.getElementById('vnpt-vip-toggle-styles')) return;

        const style = document.createElement('style');
        style.id = 'vnpt-vip-toggle-styles';
        style.textContent = `
            #vnpt-vip-toggle-wrapper {
                position: fixed;
                top: 105px;
                right: 15px;
                z-index: 2147483647;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            .vnpt-toggle-container {
                display: flex;
                align-items: center;
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(8px);
                padding: 4px 8px;
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                gap: 6px;
                user-select: none;
                transition: all 0.3s ease;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .vnpt-toggle-container:hover {
                background: rgba(15, 23, 42, 0.95);
                border-color: rgba(255, 255, 255, 0.2);
            }
            .toggle-label {
                font-size: 9px;
                font-weight: 800;
                color: #8B8579;
                letter-spacing: 0.05em;
                transition: color 0.3s;
            }
            .vip-active .toggle-label.vip { color: #d4a853; }
            .vip-active .toggle-label.base { color: #8B8579; }
            .toggle-switch {
                width: 32px;
                height: 16px;
                background: rgba(212, 168, 83, 0.1);
                border: 1px solid rgba(212, 168, 83, 0.3);
                border-radius: 10px;
                position: relative;
                transition: background 0.3s;
            }
            .vip-active .toggle-switch { background: #d4a853; border-color: #f59e0b; }
            .toggle-handle {
                width: 12px;
                height: 12px;
                background: #E8E0D4;
                border-radius: 50%;
                position: absolute;
                top: 1px;
                left: 1px;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .vip-active .toggle-handle {
                transform: translateX(16px);
                background: #0b1121;
                box-shadow: 0 0 10px rgba(212, 168, 83, 0.8);
            }
        `;
        document.head.appendChild(style);
    },

    _ensureKeyframes() {
        if (document.getElementById('vnpt-ai-keyframes')) return;
        const style = document.createElement('style');
        style.id = 'vnpt-ai-keyframes';
        style.textContent = `
            @keyframes ai-glow-pulse {
                0% { box-shadow: 0 4px 15px rgba(212, 168, 83, 0.5), 0 0 10px rgba(245, 158, 11, 0.4); }
                50% { box-shadow: 0 4px 25px rgba(212, 168, 83, 0.8), 0 0 30px rgba(245, 158, 11, 0.7); }
                100% { box-shadow: 0 4px 15px rgba(212, 168, 83, 0.5), 0 0 10px rgba(245, 158, 11, 0.4); }
            }
            .vnpt-ai-btn-active {
                animation: ai-glow-pulse 2s infinite ease-in-out !important;
                font-weight: bold !important;
            }
            .vnpt-base-btn-active {
                transition: all 0.4s ease !important;
            }
        `;
        document.head.appendChild(style);
    },

    /**
     * Typing animation...
     * @param {HTMLTextAreaElement|HTMLInputElement} targetElement 
     * @param {string} text 
     * @param {number} [speed]
     * @returns {Promise<void>}
     */
    async typeText(targetElement, text, speed = 15) {
        return new Promise((resolve) => {
            targetElement.value = '';
            let i = 0;
            const interval = setInterval(() => {
                targetElement.value += text.charAt(i);
                const event = new Event('input', { bubbles: true });
                targetElement.dispatchEvent(event);
                targetElement.scrollTop = targetElement.scrollHeight;
                i++;
                if (i >= text.length) {
                    clearInterval(interval);
                    resolve(undefined);
                }
            }, speed);
        });
    }
};

/** @type {any} */
(window).AIUIInjector = AIUIInjector;
