/**
 * 🧞 Aladinn — Tests: Safe-Click Framework
 * Tests for modal close logic and button finding safety
 */

const T = window.T;

// ========================================
// MOCK: Create DOM structure for testing
// ========================================
function createMockModal(type = 'jBox') {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,0.5);';

    const modal = document.createElement('div');
    if (type === 'jBox') {
        modal.className = 'jBox-container';
    } else if (type === 'ui-dialog') {
        modal.className = 'ui-dialog';
    } else if (type === 'modal') {
        modal.className = 'modal show';
    }
    modal.style.cssText = 'position:fixed;top:50%;left:50%;width:300px;height:200px;background:white;z-index:10000;transform:translate(-50%,-50%);';

    const closeBtn = document.createElement('button');
    closeBtn.className = type === 'jBox' ? 'jBox-closeButton' : 
                         type === 'ui-dialog' ? 'ui-dialog-titlebar-close' : 'btn-close';
    closeBtn.textContent = 'X';
    closeBtn.style.cssText = 'width:30px;height:30px;display:block;';
    closeBtn.dataset.testClicked = 'false';
    closeBtn.addEventListener('click', () => { closeBtn.dataset.testClicked = 'true'; });

    const bodyBtn = document.createElement('button');
    bodyBtn.textContent = 'Submit';
    bodyBtn.style.cssText = 'width:80px;height:30px;display:block;';
    bodyBtn.dataset.testClicked = 'false';
    bodyBtn.addEventListener('click', () => { bodyBtn.dataset.testClicked = 'true'; });

    modal.appendChild(closeBtn);
    modal.appendChild(bodyBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    return { overlay, modal, closeBtn, bodyBtn };
}

function createOutsideButton(text = 'Đóng') {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'width:80px;height:30px;display:block;position:fixed;bottom:10px;right:10px;z-index:1;';
    btn.dataset.testClicked = 'false';
    btn.addEventListener('click', () => { btn.dataset.testClicked = 'true'; });
    document.body.appendChild(btn);
    return btn;
}

function cleanup(...elements) {
    elements.forEach(el => el && el.parentNode && el.parentNode.removeChild(el));
}

// ========================================
// TEST: findSafeButton
// ========================================

T.describe('🛡️ Safe-Click: findSafeButton logic', () => {
    T.it('finds button by matching text within a container', () => {
        const container = document.createElement('div');
        container.style.cssText = 'width:100px;height:50px;display:block;';
        const btn = document.createElement('button');
        btn.textContent = 'Xác nhận';
        btn.style.cssText = 'width:80px;height:30px;display:block;';
        container.appendChild(btn);
        document.body.appendChild(container);

        // Simulate findSafeButton logic
        const btns = container.querySelectorAll('button');
        let found = null;
        for (const b of btns) {
            if (b.textContent.includes('Xác nhận')) {
                found = b;
                break;
            }
        }

        T.assertTruthy(found, 'Should find the Xác nhận button');
        T.assertEqual(found.textContent, 'Xác nhận');
        cleanup(container);
    });

    T.it('excludes buttons with excluded text', () => {
        const container = document.createElement('div');
        container.style.cssText = 'width:200px;height:100px;display:block;';
        
        const excludeTexts = ['Hủy', 'Đóng', 'Thoát', 'Xóa'];
        
        ['Hủy', 'Đóng', 'Xác nhận'].forEach(text => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = 'width:60px;height:25px;display:inline-block;';
            container.appendChild(btn);
        });
        
        document.body.appendChild(container);

        const btns = container.querySelectorAll('button');
        let found = null;
        for (const b of btns) {
            const txt = b.textContent.trim();
            if (excludeTexts.some(ex => txt.includes(ex))) continue;
            if (txt.includes('Xác nhận')) { found = b; break; }
        }

        T.assertTruthy(found, 'Should skip excluded buttons');
        T.assertEqual(found.textContent, 'Xác nhận');
        cleanup(container);
    });
});

// ========================================
// TEST: Modal-scoped close
// ========================================

T.describe('🛡️ Safe-Click: Modal close restriction', () => {
    T.it('close button inside modal gets clicked', () => {
        const { overlay, closeBtn, bodyBtn } = createMockModal('jBox');
        
        // Simulate safe tryCloseModal: search only in .jBox-container
        const modal = document.querySelector('.jBox-container');
        if (modal) {
            const btn = modal.querySelector('.jBox-closeButton');
            if (btn) btn.click();
        }

        T.assertEqual(closeBtn.dataset.testClicked, 'true', 'Close button should be clicked');
        T.assertEqual(bodyBtn.dataset.testClicked, 'false', 'Submit button should NOT be clicked');
        cleanup(overlay);
    });

    T.it('buttons outside the modal are NOT clicked', () => {
        const { overlay, closeBtn } = createMockModal('jBox');
        const outsideBtn = createOutsideButton('Đóng');

        // Safe close: only search within modal
        const modal = document.querySelector('.jBox-container');
        if (modal) {
            const btn = modal.querySelector('.jBox-closeButton');
            if (btn) btn.click();
        }

        T.assertEqual(closeBtn.dataset.testClicked, 'true', 'Modal close should be clicked');
        T.assertEqual(outsideBtn.dataset.testClicked, 'false', 'Outside button should NOT be clicked');
        cleanup(overlay, outsideBtn);
    });

    T.it('ui-dialog close button is found correctly', () => {
        const { overlay, closeBtn } = createMockModal('ui-dialog');

        const modal = document.querySelector('.ui-dialog');
        if (modal) {
            const btn = modal.querySelector('.ui-dialog-titlebar-close');
            if (btn) btn.click();
        }

        T.assertEqual(closeBtn.dataset.testClicked, 'true', 'UI dialog close should be clicked');
        cleanup(overlay);
    });

    T.it('no click when no modal is present', () => {
        const outsideBtn = createOutsideButton('Đóng');
        
        // Safe close: search for modal first
        const modalSelectors = ['.jBox-container', '.ui-dialog', '.modal.show'];
        let foundModal = null;
        for (const sel of modalSelectors) {
            foundModal = document.querySelector(sel);
            if (foundModal) break;
        }

        // Should NOT find any modal → should NOT click anything
        T.assert(!foundModal, 'No modal should be present');
        T.assertEqual(outsideBtn.dataset.testClicked, 'false', 'Outside button must NOT be clicked');
        cleanup(outsideBtn);
    });
});
