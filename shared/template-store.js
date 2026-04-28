/**
 * template-store.js
 * Quản lý kho mẫu bệnh án (mặc định và cá nhân)
 */

const DEFAULT_TEMPLATES = [
    {
        id: 'tpl_1',
        shortcut: 'tiepsuc',
        title: 'Bệnh tỉnh, tiếp xúc tốt',
        content: 'Bệnh tỉnh, tiếp xúc tốt. Da niêm hồng. Tuyến giáp không to, hạch ngoại vi không sờ chạm.'
    },
    {
        id: 'tpl_2',
        shortcut: 'tim',
        title: 'Khám tim',
        content: 'Lồng ngực cân đối, không sẹo mổ cũ. T1, T2 đều rõ, không nghe âm thổi bệnh lý.'
    },
    {
        id: 'tpl_3',
        shortcut: 'phoi',
        title: 'Khám phổi',
        content: 'Rì rào phế nang êm dịu 2 phế trường, không rale.'
    },
    {
        id: 'tpl_4',
        shortcut: 'bung',
        title: 'Khám bụng',
        content: 'Bụng mềm, di động đều theo nhịp thở. Gan lách không sờ chạm. Ấn không điểm đau khu trú.'
    },
    {
        id: 'tpl_5',
        shortcut: 'dandokhambenh',
        title: 'Dặn dò chung',
        content: 'Uống thuốc theo toa. Tái khám sau khi hết thuốc hoặc khi có dấu hiệu bất thường (sốt, đau nhiều, nôn ói...). Ăn uống đầy đủ dinh dưỡng, nghỉ ngơi hợp lý.'
    }
];

export const TemplateStore = {
    async getTemplates() {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.local) {
                // Fallback for non-extension env (local testing)
                resolve(DEFAULT_TEMPLATES);
                return;
            }
            
            chrome.storage.local.get(['aladinn_templates'], (result) => {
                if (result.aladinn_templates && result.aladinn_templates.length > 0) {
                    resolve(result.aladinn_templates);
                } else {
                    // Initialize with defaults if empty
                    this.saveTemplates(DEFAULT_TEMPLATES);
                    resolve(DEFAULT_TEMPLATES);
                }
            });
        });
    },

    async saveTemplates(templates) {
        return new Promise((resolve) => {
            if (!chrome || !chrome.storage || !chrome.storage.local) {
                resolve(true);
                return;
            }
            chrome.storage.local.set({ 'aladinn_templates': templates }, () => {
                resolve(true);
            });
        });
    },

    async addTemplate(title, shortcut, content) {
        const templates = await this.getTemplates();
        const newTpl = {
            id: 'tpl_' + Date.now(),
            title,
            shortcut,
            content
        };
        templates.push(newTpl);
        await this.saveTemplates(templates);
        return newTpl;
    },

    async removeTemplate(id) {
        let templates = await this.getTemplates();
        templates = templates.filter(t => t.id !== id);
        await this.saveTemplates(templates);
        return true;
    }
};
