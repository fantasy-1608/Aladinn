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
