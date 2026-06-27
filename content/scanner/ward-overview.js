/**
 * Tổng quan khoa — quét tuần tự chẩn đoán từ tờ điều trị mới nhất.
 * Chỉ đọc dữ liệu trong bảng bệnh nhân hiện tại, không lưu PHI và không gọi AI.
 */

import {
    scanPatientsSequentially,
    WARD_OVERVIEW_LIMITS
} from './ward-overview-core.js';

let activeRun = null;

function extractCellText(row, selector) {
    try {
        return window.VNPTSelectors?.utils?.getText?.(row, selector)?.trim() || '';
    } catch (_) {
        return '';
    }
}

function collectCurrentWardRows() {
    const rowSelector = window.VNPTSelectors?.patientGrid?.rows || '#grdBenhNhan tr.jqgrow';
    const cells = window.VNPTSelectors?.patientGrid?.cells || {};
    return Array.from(document.querySelectorAll(rowSelector))
        .filter(row => row.id)
        .map(row => ({
            rowId: row.id,
            patientName: extractCellText(row, cells.name) || 'Bệnh nhân',
            room: extractCellText(row, cells.room),
            rowElement: row
        }));
}

function ensureWardOverviewStyles() {
    if (document.getElementById('aladinn-ward-overview-styles')) return;
    const style = document.createElement('style');
    style.id = 'aladinn-ward-overview-styles';
    style.textContent = `
        .aladinn-ward-overview{width:min(860px,calc(100vw - 32px));max-height:88vh;padding:0;border:1px solid #2d509a;color:#263238;background:#fff;font-family:Inter,"Segoe UI",sans-serif}
        .aladinn-ward-overview::backdrop{background:rgba(15,23,42,.52)}
        .ward-overview-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:16px 18px;background:#2d509a;color:#fff}
        .ward-overview-header h2{font-size:18px;margin:0 0 4px}.ward-overview-header p{font-size:12px;margin:0;opacity:.9}
        .ward-overview-close{border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer}
        .ward-overview-body{padding:16px 18px;overflow:auto;max-height:calc(88vh - 126px)}
        .ward-overview-notice{padding:10px 12px;border-left:4px solid #f59e0b;background:#fff8e1;font-size:13px;line-height:1.5}
        .ward-overview-progress{margin:14px 0}.ward-overview-progress progress{width:100%;height:12px}
        .ward-overview-status{font-size:13px;margin-top:6px;color:#455a64}
        .ward-overview-actions{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #ddd}
        .ward-overview-btn{border:1px solid #2d509a;background:#fff;color:#2d509a;padding:8px 14px;font-weight:600;cursor:pointer}
        .ward-overview-btn.primary{background:#2d509a;color:#fff}.ward-overview-btn:disabled{opacity:.55;cursor:not-allowed}
        .ward-overview-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
        .ward-overview-stat{border:1px solid #d9e2ef;padding:10px;text-align:center}.ward-overview-stat strong{display:block;font-size:20px}
        .ward-overview-group{margin-top:14px}.ward-overview-group h3{font-size:14px;margin:0 0 8px}
        .ward-overview-list{list-style:none;padding:0;margin:0;display:grid;gap:6px}
        .ward-overview-item{border:1px solid #ddd;padding:9px 10px;font-size:13px;line-height:1.45}
        .ward-overview-item button{border:0;background:transparent;color:#2d509a;font-weight:700;padding:0;cursor:pointer;text-align:left}
        .ward-overview-diagnosis{display:block;margin-top:3px}.ward-overview-reason{display:block;color:#8a4b08;font-size:12px;margin-top:2px}
        @media(max-width:620px){.ward-overview-summary{grid-template-columns:repeat(2,1fr)}}
        @media(prefers-reduced-motion:reduce){.aladinn-ward-overview *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(style);
}

function createWardOverviewDialog(rows) {
    document.getElementById('aladinn-ward-overview')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'aladinn-ward-overview';
    dialog.className = 'aladinn-ward-overview';
    dialog.setAttribute('aria-labelledby', 'ward-overview-title');
    dialog.innerHTML = `
        <header class="ward-overview-header">
            <div><h2 id="ward-overview-title">Tổng quan khoa</h2><p>Chẩn đoán từ tờ điều trị mới nhất</p></div>
            <button type="button" class="ward-overview-close" aria-label="Đóng">×</button>
        </header>
        <div class="ward-overview-body">
            <div class="ward-overview-notice">Quét tối đa ${WARD_OVERVIEW_LIMITS.maxPatients} bệnh nhân, tuần tự 1 bệnh nhân/lần và nghỉ ${WARD_OVERVIEW_LIMITS.delayMs / 1000} giây giữa các lượt. Không gửi dữ liệu ra ngoài HIS.</div>
            <div class="ward-overview-progress" hidden><progress max="${Math.min(rows.length, WARD_OVERVIEW_LIMITS.maxPatients)}" value="0"></progress><div class="ward-overview-status" aria-live="polite"></div></div>
            <div class="ward-overview-results"></div>
        </div>
        <footer class="ward-overview-actions">
            <button type="button" class="ward-overview-btn cancel" hidden>Dừng quét</button>
            <button type="button" class="ward-overview-btn primary start">Bắt đầu quét ${Math.min(rows.length, WARD_OVERVIEW_LIMITS.maxPatients)} bệnh nhân</button>
        </footer>
    `;
    document.body.appendChild(dialog);
    return dialog;
}

function appendPatientItem(list, item) {
    const li = document.createElement('li');
    li.className = 'ward-overview-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${item.patientName}${item.room ? ` — ${item.room}` : ''}`;
    button.addEventListener('click', () => {
        item.rowElement?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        item.rowElement?.click?.();
    });
    const diagnosis = document.createElement('span');
    diagnosis.className = 'ward-overview-diagnosis';
    diagnosis.textContent = item.latestDiagnosis || 'Không lấy được chẩn đoán';
    const reason = document.createElement('span');
    reason.className = 'ward-overview-reason';
    reason.textContent = `${item.latestTreatmentDate || 'Không rõ ngày'} — ${item.classification.reason}`;
    li.append(button, diagnosis, reason);
    list.appendChild(li);
}

function renderWardOverviewResults(container, results) {
    container.replaceChildren();
    const levels = ['attention', 'monitor', 'missing', 'routine'];
    const labels = {
        attention: 'Cần chú ý', monitor: 'Cần theo dõi',
        missing: 'Thiếu dữ liệu', routine: 'Các ca còn lại'
    };
    const groups = Object.fromEntries(levels.map(level => [level, results.filter(item => item.classification.level === level)]));
    const summary = document.createElement('div');
    summary.className = 'ward-overview-summary';
    levels.forEach(level => {
        const stat = document.createElement('div');
        stat.className = 'ward-overview-stat';
        stat.innerHTML = `<strong>${groups[level].length}</strong><span>${labels[level]}</span>`;
        summary.appendChild(stat);
    });
    container.appendChild(summary);
    levels.forEach(level => {
        if (groups[level].length === 0) return;
        const section = document.createElement('section');
        section.className = 'ward-overview-group';
        const heading = document.createElement('h3');
        heading.textContent = `${labels[level]} (${groups[level].length})`;
        const list = document.createElement('ul');
        list.className = 'ward-overview-list';
        groups[level].forEach(item => appendPatientItem(list, item));
        section.append(heading, list);
        container.appendChild(section);
    });
}

async function runWardOverviewScan(dialog, rows, controller) {
    const progressWrap = dialog.querySelector('.ward-overview-progress');
    const progress = dialog.querySelector('progress');
    const status = dialog.querySelector('.ward-overview-status');
    const resultsContainer = dialog.querySelector('.ward-overview-results');
    progressWrap.hidden = false;
    status.textContent = 'Đang chuẩn bị quét...';

    const results = await scanPatientsSequentially(rows, ({ rowId }) => (
        window.VNPTMessaging.sendRequest(
            'REQ_FETCH_LATEST_TREATMENT_DIAGNOSIS',
            { rowId },
            WARD_OVERVIEW_LIMITS.requestTimeoutMs
        )
    ), {
        signal: controller.signal,
        onProgress: ({ completed, total, row }) => {
            progress.value = completed;
            status.textContent = `Đã quét ${completed}/${total}: ${row.patientName}`;
        }
    });

    renderWardOverviewResults(resultsContainer, results);
    if (results.stoppedForSafety) status.textContent = 'Đã dừng an toàn sau 3 lỗi liên tiếp. Không tiếp tục gọi HIS.';
    else if (results.cancelled) status.textContent = `Đã dừng theo yêu cầu. Có ${results.length} kết quả.`;
    else status.textContent = `Hoàn tất ${results.length} bệnh nhân.`;
    return results;
}

export function showWardOverview() {
    const existing = document.getElementById('aladinn-ward-overview');
    if (existing?.open) { existing.focus(); return; }
    const rows = collectCurrentWardRows();
    if (rows.length === 0) {
        window.VNPTRealtime?.showToast?.('Không tìm thấy danh sách bệnh nhân nội trú để quét.', 'warning');
        return;
    }

    ensureWardOverviewStyles();
    const dialog = createWardOverviewDialog(rows);
    const startButton = dialog.querySelector('.start');
    const cancelButton = dialog.querySelector('.cancel');
    const closeButton = dialog.querySelector('.ward-overview-close');
    const close = () => { activeRun?.abort(); activeRun = null; dialog.close(); dialog.remove(); };
    closeButton.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    cancelButton.addEventListener('click', () => activeRun?.abort());
    startButton.addEventListener('click', async () => {
        if (activeRun) return;
        activeRun = new AbortController();
        startButton.disabled = true;
        cancelButton.hidden = false;
        try { await runWardOverviewScan(dialog, rows, activeRun); }
        finally { activeRun = null; cancelButton.hidden = true; startButton.hidden = true; }
    });
    dialog.showModal();
}

window.Aladinn = window.Aladinn || {};
window.Aladinn.Scanner = window.Aladinn.Scanner || {};
window.Aladinn.Scanner.showWardOverview = showWardOverview;
