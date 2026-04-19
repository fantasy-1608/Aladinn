const fs = require('fs');
let code = fs.readFileSync('popup/popup.js', 'utf8');

const showErrorBlock = `
        function showError(msg) {
            let container = document.querySelector('.action-grid');
            let err = document.getElementById('aladinn-popup-err');
            if (!err) {
                err = document.createElement('div');
                err.id = 'aladinn-popup-err';
                err.style.cssText = 'grid-column: 1 / -1; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; font-size: 13px; text-align: center; margin-top: 8px; font-weight: 500; animation: fadeSlideUp 0.3s;';
                container.parentNode.insertBefore(err, container.nextSibling);
            }
            err.textContent = msg;
            setTimeout(() => { if (err) err.remove(); }, 3000);
        }
`;

// Inject showError function before sendScannerAction
code = code.replace(/function sendScannerAction/, showErrorBlock + '\n    function sendScannerAction');

// Replace alerts
code = code.replace(/alert\('Vui lòng mở trang VNPT HIS nội trú'\);/g, "showError('⚠️ Vui lòng mở trang VNPT HIS nội trú');");
code = code.replace(/alert\('Vui lòng mở trang VNPT HIS'\);/g, "showError('⚠️ Vui lòng mở trang duyệt Bệnh án VNPT HIS');");

// Also let's fix DOMContentLoaded issue just in case
code = code.replace(/document\.addEventListener\('DOMContentLoaded', async \(\) => \{/, "async function initPopup() {\n");
code = code.replace(/\}\);\s*$/, "}\n\nif (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', initPopup);\n} else {\n    initPopup();\n}\n");

fs.writeFileSync('popup/popup.js', code);
