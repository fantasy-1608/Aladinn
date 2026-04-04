/**
 * HIS Voice Assistant - Speech Module
 * Speech recognition functionality
 */

// ========================================
// Initialize Speech Recognition
// ========================================
function initSpeechRecognition() {
    if (window.recognition) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    window.recognition = new SpeechRecognition();
    window.recognition.continuous = true;
    window.recognition.interimResults = true;
    window.recognition.lang = 'vi-VN';

    window.recognition.onstart = () => {
        window.isRecording = true;
        window.updateRecordingUI(true);
    };

    window.recognition.onend = () => {
        window.isRecording = false;
        window.updateRecordingUI(false);

        // Auto-restart if user hasn't stopped
        if (!window.shouldStopRecording) {
            setTimeout(() => {
                try {
                    window.recognition.start();
                    console.log('Auto-restarting speech recognition...');
                } catch (e) {
                    if (window.Aladinn?.Logger) {
                        window.Aladinn.Logger.warn('Voice', 'Local stream stop error:', e);
                    } else {
                        console.warn('[Aladinn/Voice] Stream stop error:', e);
                    }
                }
            }, 300);
        }
    };

    window.recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (finalTranscript || interimTranscript) {
            const currentFullText = window.transcript + finalTranscript + interimTranscript;
            document.getElementById('his-transcript').value = currentFullText;

            if (finalTranscript) {
                window.transcript += finalTranscript;
                window.saveData();
            }

            window.updateProcessBtnState();
        }
    };

    window.recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        window.showToast('Lỗi ghi âm: ' + event.error, true);
        window.isRecording = false;
        window.updateRecordingUI(false);
    };
}

// ========================================
// Toggle Recording
// ========================================
function toggleRecording() {
    if (window.isLocked) {
        window.showToast('Vui lòng mở khóa trước!', true);
        return;
    }

    if (window.isRecording) {
        window.shouldStopRecording = true;
        window.recognition?.stop();
    } else {
        window.shouldStopRecording = false;
        if (!window.recognition) initSpeechRecognition();
        try {
            window.recognition?.start();
        } catch (e) {
            window.showToast('Không thể bắt đầu ghi âm', true);
        }
    }
}

// ========================================
// Update Recording UI
// ========================================
function updateRecordingUI(recording) {
    const btn = document.getElementById('his-record-btn');
    const icon = document.getElementById('his-record-icon');

    if (!btn || !icon) return;

    if (recording) {
        btn.classList.add('recording');
        icon.innerHTML = ICONS.stop;
    } else {
        btn.classList.remove('recording');
        icon.innerHTML = ICONS.mic;
    }
}

// ========================================
// Global Exports (Voice Module)
// ========================================
window.initSpeechRecognition = initSpeechRecognition;
window.toggleRecording = toggleRecording;
window.updateRecordingUI = updateRecordingUI;
