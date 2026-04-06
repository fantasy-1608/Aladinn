/**
 * 🧞 Aladinn — Self-Update Checker
 * Kiểm tra phiên bản mới từ GitHub Releases
 * Hoạt động hoàn toàn trong background service worker
 */

// ⚠️ CẤU HÌNH: Thay bằng repo GitHub của bạn
const UPDATE_CONFIG = {
    // GitHub repo format: owner/repo
    githubRepo: 'fantasy-1608/Aladinn',
    
    // Kiểm tra mỗi 4 giờ (ms)
    checkInterval: 4 * 60 * 60 * 1000,
    
    // Fallback: file update.json trên GitHub Pages
    // Format: https://<owner>.github.io/<repo>/update.json
    // Nếu bạn không dùng GitHub Pages, để null
    updateJsonUrl: null
};

/**
 * So sánh version semver đơn giản (1.0.0 < 1.1.0 < 2.0.0)
 * @returns {number} -1 nếu a < b, 0 nếu a == b, 1 nếu a > b
 */
function compareVersions(a, b) {
    const pa = a.replace(/^v/, '').split('.').map(Number);
    const pb = b.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const va = pa[i] || 0;
        const vb = pb[i] || 0;
        if (va < vb) return -1;
        if (va > vb) return 1;
    }
    return 0;
}

/**
 * Lấy version hiện tại từ manifest
 */
function getCurrentVersion() {
    return chrome.runtime.getManifest().version;
}

/**
 * Kiểm tra update từ GitHub Releases API
 */
async function checkForUpdate() {
    try {
        const currentVersion = getCurrentVersion();
        
        let latestRelease = null;

        // Thử GitHub Releases API trước
        try {
            const apiUrl = `https://api.github.com/repos/${UPDATE_CONFIG.githubRepo}/releases/latest`;
            const response = await fetch(apiUrl, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                latestRelease = {
                    version: data.tag_name.replace(/^v/, ''),
                    tagName: data.tag_name,
                    name: data.name || data.tag_name,
                    body: data.body || '',
                    downloadUrl: data.zipball_url,
                    htmlUrl: data.html_url,
                    publishedAt: data.published_at,
                    // Tìm file .zip trong assets
                    assetUrl: data.assets?.find(a => a.name.endsWith('.zip'))?.browser_download_url || null
                };
            }
        } catch (_apiErr) {
            console.log('[Aladinn Updater] GitHub API không khả dụng, thử fallback...');
        }

        // Fallback: update.json
        if (!latestRelease && UPDATE_CONFIG.updateJsonUrl) {
            try {
                const response = await fetch(UPDATE_CONFIG.updateJsonUrl);
                if (response.ok) {
                    const data = await response.json();
                    latestRelease = {
                        version: data.version,
                        tagName: `v${data.version}`,
                        name: data.name || `v${data.version}`,
                        body: data.changelog || '',
                        downloadUrl: data.downloadUrl || '',
                        htmlUrl: data.htmlUrl || '',
                        publishedAt: data.publishedAt || new Date().toISOString(),
                        assetUrl: data.downloadUrl || null
                    };
                }
            } catch (_fallbackErr) {
                console.log('[Aladinn Updater] Fallback update.json cũng không khả dụng');
            }
        }

        if (!latestRelease) {
            console.log('[Aladinn Updater] Không thể kiểm tra update');
            return null;
        }

        // So sánh version
        const comparison = compareVersions(currentVersion, latestRelease.version);
        
        if (comparison < 0) {
            // Có bản mới!
            const updateInfo = {
                currentVersion,
                newVersion: latestRelease.version,
                name: latestRelease.name,
                changelog: latestRelease.body,
                downloadUrl: latestRelease.assetUrl || latestRelease.downloadUrl,
                releaseUrl: latestRelease.htmlUrl,
                publishedAt: latestRelease.publishedAt,
                checkedAt: new Date().toISOString()
            };

            // Lưu vào storage
            await chrome.storage.local.set({ aladinn_update: updateInfo });

            // Hiện badge thông báo
            chrome.action.setBadgeText({ text: '⬆' });
            chrome.action.setBadgeBackgroundColor({ color: '#FF6B35' });
            chrome.action.setTitle({ 
                title: `🆕 Aladinn ${latestRelease.version} — Nhấn để cập nhật!` 
            });

            console.log(`[Aladinn Updater] 🆕 Phiên bản mới: ${latestRelease.version} (hiện tại: ${currentVersion})`);
            return updateInfo;
        } else {
            // Đã cập nhật mới nhất
            await chrome.storage.local.remove('aladinn_update');
            chrome.action.setBadgeText({ text: '' });
            chrome.action.setTitle({ 
                title: `Aladinn — VNPT HIS Assistant v${currentVersion}` 
            });
            console.log(`[Aladinn Updater] ✅ Đang dùng phiên bản mới nhất: ${currentVersion}`);
            return null;
        }
    } catch (err) {
        console.error('[Aladinn Updater] Lỗi kiểm tra update:', err);
        return null;
    }
}

/**
 * Lên lịch kiểm tra định kỳ bằng Chrome Alarms
 */
function scheduleUpdateCheck() {
    // Kiểm tra ngay khi cài/khởi động
    setTimeout(() => checkForUpdate(), 10000);

    // Lên lịch kiểm tra định kỳ (mỗi 4 giờ)
    chrome.alarms.create('aladinn-update-check', {
        periodInMinutes: UPDATE_CONFIG.checkInterval / 60000
    });
}

/**
 * Xử lý dismiss update (user bỏ qua bản cập nhật này)
 */
async function dismissUpdate(version) {
    await chrome.storage.local.set({ aladinn_update_dismissed: version });
    await chrome.storage.local.remove('aladinn_update');
    chrome.action.setBadgeText({ text: '' });
}

export { 
    checkForUpdate, 
    scheduleUpdateCheck, 
    dismissUpdate, 
    getCurrentVersion,
    UPDATE_CONFIG
};
