/**
 * 🧞 Aladinn — Advanced Sign Module: UI
 * Modal "Giỏ hàng ký số" — hiển thị tất cả phiếu chưa ký cho 1 bệnh nhân
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.AdvancedSignUI = (function () {
    'use strict';

    const _Logger = window.Aladinn?.Logger;
    let modalElement = null;

    /**
     * Inject the ⚡ Advanced Sign button into the workflow panel
     */
    function injectAdvancedButton(onClick) {
        const startView = document.getElementById('his-start-view');
        if (!startView) return;
        if (document.getElementById('his-btn-advanced-sign')) return;

        const btn = document.createElement('button');
        btn.id = 'his-btn-advanced-sign';
        btn.className = 'his-btn his-btn-advanced';
        btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span>Ký số nâng cao</span>
        `;
        btn.addEventListener('click', onClick);

        // Insert after the start button
        const startBtn = document.getElementById('his-btn-start');
        if (startBtn && startBtn.parentNode) {
            startBtn.parentNode.insertBefore(btn, startBtn.nextSibling);
        } else {
            startView.appendChild(btn);
        }
    }

    /**
     * Show the Advanced Sign modal with document list
     */
    function showModal(patientInfo, documents, allDocuments, onConfirm) {
        hideModal();

        const AdvSign = window.Aladinn?.Sign?.AdvancedSign;
        const summary = AdvSign ? AdvSign.getDocumentSummary(allDocuments) : { total: 0, signed: 0, unsigned: 0 };

        modalElement = document.createElement('div');
        modalElement.id = 'his-advsign-modal';
        modalElement.className = 'his-advsign-overlay';

        const patientName = patientInfo?.tenbenhnhan || 'Bệnh nhân';
        const maba = patientInfo?.mabenhan || '';

        // Group unsigned docs by type
        const grouped = {};
        for (const doc of documents) {
            const type = doc.TENPHIEU || 'Khác';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(doc);
        }

        let docListHTML = '';
        let docIndex = 0;

        for (const [typeName, docs] of Object.entries(grouped)) {
            docListHTML += `<div class="his-advsign-group">
                <div class="his-advsign-group-header">
                    <span class="his-advsign-group-icon">📋</span>
                    <span class="his-advsign-group-name">${typeName}</span>
                    <span class="his-advsign-group-count">${docs.length}</span>
                </div>`;

            for (const doc of docs) {
                const creator = doc.NGUOITAO || 'Không rõ';
                const date = (doc.NGAYMAUBENHPHAM || '').split(' ')[0] || '';
                docListHTML += `
                <label class="his-advsign-item" data-doc-index="${docIndex}">
                    <input type="checkbox" class="his-advsign-check" data-idx="${docIndex}" checked>
                    <div class="his-advsign-item-info">
                        <span class="his-advsign-item-name">${doc.TENPHIEU || 'Phiếu'}</span>
                        <span class="his-advsign-item-meta">${creator} · ${date} · #${doc.SOPHIEU || ''}</span>
                    </div>
                    <span class="his-advsign-item-status his-advsign-unsigned">Chưa ký</span>
                </label>`;
                docIndex++;
            }

            docListHTML += '</div>';
        }

        if (documents.length === 0) {
            docListHTML = `
                <div class="his-advsign-empty">
                    <div class="his-advsign-empty-icon">✅</div>
                    <div class="his-advsign-empty-text">Không có phiếu nào cần ký!</div>
                    <div class="his-advsign-empty-sub">Tổng: ${summary.total} phiếu, đã ký: ${summary.signed}</div>
                </div>`;
        }

        modalElement.innerHTML = `
            <div class="his-advsign-modal">
                <div class="his-advsign-header">
                    <div class="his-advsign-header-left">
                        <svg class="his-advsign-bolt" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        <div>
                            <div class="his-advsign-title">Ký số Nâng cao</div>
                            <div class="his-advsign-subtitle">${patientName} ${maba ? '· BA: ' + maba : ''}</div>
                        </div>
                    </div>
                    <button class="his-advsign-close" id="his-advsign-close">✕</button>
                </div>

                <div class="his-advsign-stats">
                    <div class="his-advsign-stat">
                        <div class="his-advsign-stat-num">${summary.total}</div>
                        <div class="his-advsign-stat-label">Tổng phiếu</div>
                    </div>
                    <div class="his-advsign-stat his-advsign-stat-done">
                        <div class="his-advsign-stat-num">${summary.signed}</div>
                        <div class="his-advsign-stat-label">Đã ký</div>
                    </div>
                    <div class="his-advsign-stat his-advsign-stat-pending">
                        <div class="his-advsign-stat-num">${documents.length}</div>
                        <div class="his-advsign-stat-label">Cần ký (của bạn)</div>
                    </div>
                </div>

                <div class="his-advsign-toolbar">
                    <label class="his-advsign-selectall">
                        <input type="checkbox" id="his-advsign-selectall" checked>
                        <span>Chọn tất cả</span>
                    </label>
                    <span class="his-advsign-selected-count" id="his-advsign-count">${documents.length} phiếu</span>
                </div>

                <div class="his-advsign-list" id="his-advsign-list">
                    ${docListHTML}
                </div>

                <div class="his-advsign-footer">
                    <button class="his-btn his-btn-secondary" id="his-advsign-cancel">Đóng</button>
                    <button class="his-btn his-btn-primary his-btn-advanced-confirm" id="his-advsign-confirm" ${documents.length === 0 ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        <span>Bắt đầu ký ${documents.length} phiếu</span>
                    </button>
                </div>

                <div class="his-advsign-progress" id="his-advsign-progress" style="display:none">
                    <div class="his-advsign-progress-header">
                        <span id="his-advsign-progress-text">Đang ký...</span>
                        <span id="his-advsign-progress-count">0/${documents.length}</span>
                    </div>
                    <div class="his-advsign-progress-bar-container">
                        <div class="his-advsign-progress-bar" id="his-advsign-progress-bar"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalElement);
        requestAnimationFrame(() => modalElement.classList.add('visible'));

        // Bind events
        document.getElementById('his-advsign-close').addEventListener('click', hideModal);
        document.getElementById('his-advsign-cancel').addEventListener('click', hideModal);

        // Select all toggle
        const selectAllCb = document.getElementById('his-advsign-selectall');
        selectAllCb.addEventListener('change', () => {
            const checks = modalElement.querySelectorAll('.his-advsign-check');
            checks.forEach(c => c.checked = selectAllCb.checked);
            updateSelectedCount(documents);
        });

        // Individual checkbox
        modalElement.querySelectorAll('.his-advsign-check').forEach(cb => {
            cb.addEventListener('change', () => updateSelectedCount(documents));
        });

        // Confirm button
        if (documents.length > 0) {
            document.getElementById('his-advsign-confirm').addEventListener('click', () => {
                const selectedDocs = getSelectedDocuments(documents);
                if (selectedDocs.length === 0) return;
                if (onConfirm) onConfirm(selectedDocs);
            });
        }
    }

    function updateSelectedCount(_documents) {
        const checks = modalElement.querySelectorAll('.his-advsign-check:checked');
        const countEl = document.getElementById('his-advsign-count');
        const confirmBtn = document.getElementById('his-advsign-confirm');
        if (countEl) countEl.textContent = `${checks.length} phiếu`;
        if (confirmBtn) {
            confirmBtn.disabled = checks.length === 0;
            const span = confirmBtn.querySelector('span');
            if (span) span.textContent = `Bắt đầu ký ${checks.length} phiếu`;
        }
    }

    function getSelectedDocuments(documents) {
        const result = [];
        if (!modalElement) return result;
        const checks = modalElement.querySelectorAll('.his-advsign-check:checked');
        checks.forEach(cb => {
            const idx = parseInt(cb.dataset.idx, 10);
            if (!isNaN(idx) && documents[idx]) result.push(documents[idx]);
        });
        return result;
    }

    /**
     * Show progress in the modal
     */
    function showProgress(current, total, docName) {
        const progressEl = document.getElementById('his-advsign-progress');
        const footerEl = modalElement?.querySelector('.his-advsign-footer');
        if (progressEl) progressEl.style.display = 'block';
        if (footerEl) footerEl.style.display = 'none';

        const textEl = document.getElementById('his-advsign-progress-text');
        const countEl = document.getElementById('his-advsign-progress-count');
        const barEl = document.getElementById('his-advsign-progress-bar');

        if (textEl) textEl.textContent = docName ? `Đang ký: ${docName}` : 'Đang ký...';
        if (countEl) countEl.textContent = `${current}/${total}`;
        if (barEl) barEl.style.width = `${total > 0 ? (current / total * 100) : 0}%`;
    }

    /**
     * Mark a document item status in the modal
     */
    function updateDocStatus(index, status) {
        if (!modalElement) return;
        const item = modalElement.querySelector(`[data-doc-index="${index}"]`);
        if (!item) return;

        const statusEl = item.querySelector('.his-advsign-item-status');
        if (!statusEl) return;

        if (status === 'signed') {
            statusEl.textContent = '✓ Đã ký';
            statusEl.className = 'his-advsign-item-status his-advsign-signed';
            item.classList.add('his-advsign-item-done');
        } else if (status === 'failed') {
            statusEl.textContent = '✕ Lỗi';
            statusEl.className = 'his-advsign-item-status his-advsign-failed';
        } else if (status === 'signing') {
            statusEl.textContent = '⏳ Đang ký...';
            statusEl.className = 'his-advsign-item-status his-advsign-signing';
        }
    }

    function showCompletionMessage(stats) {
        const progressEl = document.getElementById('his-advsign-progress');
        if (progressEl) {
            const textEl = document.getElementById('his-advsign-progress-text');
            if (textEl) textEl.textContent = `✅ Hoàn thành! Ký: ${stats.completed}, Lỗi: ${stats.failed}`;
        }
    }

    function hideModal() {
        if (modalElement) {
            const elToRemove = modalElement;
            elToRemove.classList.remove('visible');
            modalElement = null; // Clear global ref immediately!
            setTimeout(() => {
                if (elToRemove && elToRemove.parentNode) {
                    elToRemove.parentNode.removeChild(elToRemove);
                }
            }, 300);
        }
    }

    function isModalOpen() {
        return !!modalElement;
    }

    /**
     * Show loading state while fetching documents
     */
    function showLoading(patientName) {
        hideModal();
        modalElement = document.createElement('div');
        modalElement.id = 'his-advsign-modal';
        modalElement.className = 'his-advsign-overlay';

        modalElement.innerHTML = `
            <div class="his-advsign-modal his-advsign-loading">
                <div class="his-advsign-header">
                    <div class="his-advsign-header-left">
                        <svg class="his-advsign-bolt his-advsign-bolt-spin" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                        <div>
                            <div class="his-advsign-title">Đang tìm phiếu...</div>
                            <div class="his-advsign-subtitle">${patientName || 'Bệnh nhân'}</div>
                        </div>
                    </div>
                </div>
                <div class="his-advsign-loading-body">
                    <div class="his-advsign-spinner"></div>
                    <div class="his-advsign-loading-text">Đang truy vấn hệ thống HIS...</div>
                </div>
            </div>
        `;

        document.body.appendChild(modalElement);
        requestAnimationFrame(() => modalElement.classList.add('visible'));
    }

    function showError(message) {
        const UI = window.Aladinn?.Sign?.UI;
        if (UI) UI.showToast(`❌ ${message}`);
        hideModal();
    }

    return {
        injectAdvancedButton,
        showModal,
        hideModal,
        isModalOpen,
        showLoading,
        showError,
        showProgress,
        updateDocStatus,
        showCompletionMessage
    };
})();

console.log('[Aladinn] 🧞 Advanced Sign UI loaded');
