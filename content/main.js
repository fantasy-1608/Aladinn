// ── Font Injection (content scripts cannot use relative CSS paths for fonts) ──
(function injectFonts() {
    const unicode = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-0301,U+0303,U+0309,U+0323,U+0340-0341,U+1EA0-1EF9,U+2000-206F,U+2074,U+20AB,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    const interUrl = chrome.runtime.getURL('assets/fonts/inter-latin.woff2');
    const outfitUrl = chrome.runtime.getURL('assets/fonts/outfit-latin.woff2');
    const style = document.createElement('style');
    style.textContent = `
        @font-face { font-family:'Inter'; font-style:normal; font-weight:400 600; font-display:swap; src:url('${interUrl}') format('woff2'); unicode-range:${unicode}; }
        @font-face { font-family:'Outfit'; font-style:normal; font-weight:400 700; font-display:swap; src:url('${outfitUrl}') format('woff2'); unicode-range:${unicode}; }
    `;
    document.head.appendChild(style);
})();

import './debug-init.js';
import '../shared/constants.js';
import '../shared/logger.js';
import '../shared/error-handler.js';
import '../shared/command-bus.js';
import '../shared/utils.js';
import '../shared/storage.js';
import '../shared/crypto.js';
import '../shared/api-key-service.js';
import '../shared/ai-cost.js';
import '../shared/his-core.js';
import '../shared/his-selectors.js';
import '../shared/event-bus.js';
import '../shared/messaging.js';
import '../shared/patient-observer.js';
import '../shared/ui-components.js';
import '../shared/diagnostic.js';
import './scanner/index.js';
import './sign/index.js';
import './voice/index.js';
import './cds/index.js';
import './content.js';
import '../shared/styles/his-base.css';
import '../styles/aladinn-core.css';
import '../styles/aladinn-scanner.css';
import '../styles/aladinn-voice.css';
import '../styles/aladinn-sign.css';
import { initTemplateEngine } from './template/template-engine.js';

// Khởi tạo các module tiện ích
setTimeout(() => {
    initTemplateEngine();
}, 1000);
