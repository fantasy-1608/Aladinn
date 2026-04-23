(function() {
    const s = document.getElementById('aladinn-mock-context');
    if (!s) return;
    
    // Lưu lại state hiện tại
    window._oldPatientInfo = window.patientInfo;
    window._oldGbRowData = window.Gb_RowData;
    window._oldHosobenhanid = window.hosobenhanid;
    window._oldTiepnhanid = window.tiepnhanid;
    
    // Inject mock parameters từ data attributes
    window.patientInfo = {
        tiepnhanid: s.dataset.tiepnhanid,
        hosobenhanid: s.dataset.hosobenhanid,
        mabenhan: s.dataset.mabenhan
    };
    
    window.Gb_RowData = {
        TIEPNHANID: s.dataset.tiepnhanid,
        HOSOBENHANID: s.dataset.hosobenhanid,
        MAHOSOBENHAN: s.dataset.mabenhan
    };
    
    window.hosobenhanid = s.dataset.hosobenhanid;
    window.tiepnhanid = s.dataset.tiepnhanid;

    // Lắng nghe tín hiệu dọn dẹp môi trường
    window.addEventListener('ALADINN_RESTORE_MOCK', function() {
        if (window._oldPatientInfo !== undefined) window.patientInfo = window._oldPatientInfo;
        if (window._oldGbRowData !== undefined) window.Gb_RowData = window._oldGbRowData;
        if (window._oldHosobenhanid !== undefined) window.hosobenhanid = window._oldHosobenhanid;
        if (window._oldTiepnhanid !== undefined) window.tiepnhanid = window._oldTiepnhanid;
    });

    // SECURITY: Auto-restore watchdog — prevent stuck mock context
    setTimeout(() => {
        if (window.patientInfo?.tiepnhanid === s.dataset.tiepnhanid) {
            window.dispatchEvent(new Event('ALADINN_RESTORE_MOCK'));
            console.warn('[Aladinn Security] ⏱ Auto-restored mock context (30s safety timeout)');
        }
    }, 30000);
})();
