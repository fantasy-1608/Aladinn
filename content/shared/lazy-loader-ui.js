export const LazyLoaderUI = {
    container: null,
    loadingModules: new Set(),
    
    moduleNames: {
        'cds': 'Cảnh báo lâm sàng (CDS)',
        'scanner': 'Trích xuất bệnh án (Scanner)',
        'sign': 'Ký số tự động (Sign)',
        'voice': 'Nhập liệu giọng nói (Voice)'
    },

    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.id = 'aladinn-lazy-loader-container';
        document.body.appendChild(this.container);

        this.injectCSS();
        this.bindEvents();
    },

    injectCSS() {
        if (document.getElementById('aladinn-lazy-loader-style')) return;
        
        const style = document.createElement('style');
        style.id = 'aladinn-lazy-loader-style';
        style.textContent = `
            #aladinn-lazy-loader-container {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .aladinn-lazy-loader-item {
                background: #ffffff;
                border: 1px solid #a6c9e2;
                padding: 8px 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                font-size: 11px;
                color: #004f9e;
                font-weight: bold;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.2s ease-out;
            }
            .aladinn-lazy-loader-item.show {
                opacity: 1;
                transform: translateY(0);
            }
            .aladinn-flat-spinner {
                width: 14px;
                height: 14px;
                border: 2px solid #e2e8f0;
                border-top-color: #004f9e;
                border-radius: 50%;
                animation: aladinn-spin 0.8s linear infinite;
            }
            @keyframes aladinn-spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    },

    bindEvents() {
        document.addEventListener('aladinn:module-loading', (e) => {
            const mod = e.detail?.module;
            if (mod) this.showLoading(mod);
        });

        document.addEventListener('aladinn:module-loaded', (e) => {
            const mod = e.detail?.module;
            if (mod) this.hideLoading(mod);
        });
    },

    showLoading(moduleKey) {
        if (this.loadingModules.has(moduleKey)) return;
        this.loadingModules.add(moduleKey);

        const item = document.createElement('div');
        item.className = 'aladinn-lazy-loader-item';
        item.id = 'aladinn-loader-' + moduleKey;
        
        const name = this.moduleNames[moduleKey] || moduleKey;
        
        const spinner = document.createElement('div');
        spinner.className = 'aladinn-flat-spinner';
        
        const text = document.createElement('span');
        text.textContent = 'Đang tải ' + name + '...';
        
        item.appendChild(spinner);
        item.appendChild(text);
        
        this.container.appendChild(item);
        
        // Trigger reflow for animation
        void item.offsetWidth;
        item.classList.add('show');
    },

    hideLoading(moduleKey) {
        if (!this.loadingModules.has(moduleKey)) return;
        this.loadingModules.delete(moduleKey);

        const item = document.getElementById('aladinn-loader-' + moduleKey);
        if (item) {
            item.classList.remove('show');
            setTimeout(() => {
                if (item.parentNode) item.parentNode.removeChild(item);
            }, 200); // Wait for transition
        }
    }
};
