#!/usr/bin/env node
/**
 * 🧞 Aladinn CDS — NHIC Drug Interaction Crawler
 * 
 * Cào dữ liệu tương tác thuốc từ tuongtacthuoc.nhic.vn
 * Chỉ cào các tương tác giữa các thuốc có trong kho bệnh viện (raw_drugs.json)
 * Sử dụng cơ chế Rate Limit, Retry và Checkpoint để chạy an toàn và ổn định.
 * 
 * Cách dùng:
 * 1. Chạy bình thường (cào toàn bộ):
 *    node scripts/crawl_nhic_ddi.cjs
 * 2. Chạy thử nghiệm (dry-run giới hạn số hoạt chất):
 *    node scripts/crawl_nhic_ddi.cjs --limit 5
 * 3. Chạy tiếp tục từ checkpoint cuối:
 *    node scripts/crawl_nhic_ddi.cjs --resume
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bỏ qua chứng chỉ SSL không hợp lệ của server

const CDS_DATA = path.join(__dirname, '../public/cds-data');
const SCRATCH_DIR = path.join(__dirname, '../scratch');
const PROGRESS_FILE = path.join(SCRATCH_DIR, 'crawl_progress.json');
const OUTPUT_FILE = path.join(CDS_DATA, 'nhic_ddi_rules.json');
const PAGE_HTML_PATH = path.join(__dirname, '../scratch/page.html');

// Cấu hình Crawler
const CONCURRENCY_LIMIT = 3; // Số lượng request đồng thời tối đa
const REQUEST_DELAY = 200;   // Khoảng nghỉ giữa các request (ms)
const MAX_RETRIES = 3;       // Số lần thử lại tối đa khi lỗi mạng

// Đảm bảo các thư mục tồn tại
if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });
if (!fs.existsSync(CDS_DATA)) fs.mkdirSync(CDS_DATA, { recursive: true });

// ============= UTILS: HTML DECODER & NORMALIZER =============

function decodeHtmlEntities(str) {
    if (!str) return '';
    return str
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function normalizeIngredient(str) {
    if (!str || str === '-') return [];
    
    // Tách các hoạt chất phối hợp bởi +, /, ;, ',', and, và
    const parts = str.split(/[\+\/;,]|\band\b|\b(và)\b/gi);
    const results = [];
    
    for (let part of parts) {
        if (!part) continue;
        let clean = part.toLowerCase();
        clean = clean.replace(/\([^)]*\)/g, ''); // Bỏ ngoặc đơn
        clean = clean.replace(/\d+\s*(mg|mcg|ml|g|%)/gi, ''); // Bỏ hàm lượng
        clean = clean.replace(/\b(tablets|tablet|syrup|capsules|capsule|suspension|injection|infusion|solution|cream|ointment|gel|drop|drops|usp|bp|as\s+[\w\s]+)\b/gi, '');
        clean = clean.replace(/\d+/g, ''); // Bỏ số lẻ
        clean = clean.replace(/^[-.\s]+|[-.\s]+$/g, '');
        if (clean && clean.length > 2) {
            results.push(clean);
        }
    }
    return results;
}

function fuzzyNormalize(str) {
    return str
        .toLowerCase()
        .replace(/ine$/g, 'in')
        .replace(/y/g, 'i')
        .replace(/x/g, 'cs')
        .replace(/ph/g, 'f')
        .replace(/th/g, 't')
        .replace(/ch/g, 'c')
        .replace(/(.)\1/g, '$1') // Co các ký tự kép như ll -> l, ss -> s
        .replace(/\s+/g, '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Khử dấu tiếng Việt
}

// ============= HTTPS REQUEST PROMISE WRAPPER =============

function makeRequest(urlPath) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'tuongtacthuoc.nhic.vn',
            port: 443,
            path: urlPath,
            method: 'GET',
            secureProtocol: 'TLS_method',
            ciphers: 'DEFAULT@SECLEVEL=1', // Tương thích với SSL cũ của server
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': '*/*',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP Status ${res.statusCode} for ${urlPath}`));
                }
            });
        });

        req.on('error', (err) => { reject(err); });
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error(`Timeout requesting ${urlPath}`));
        });
        req.end();
    });
}

async function requestWithRetry(urlPath, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await makeRequest(urlPath);
        } catch (err) {
            console.warn(`[Retry Warning] Lần thử ${attempt}/${retries} thất bại cho ${urlPath}: ${err.message}`);
            if (attempt === retries) throw err;
            await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
        }
    }
}

// ============= MAIN CRAWLER LOGIC =============

async function run() {
    const args = process.argv.slice(2);
    const dryRunLimitIndex = args.indexOf('--limit');
    const limit = dryRunLimitIndex > -1 ? parseInt(args[dryRunLimitIndex + 1]) : null;
    const resume = args.includes('--resume');

    console.log("🧞 Khởi động NHIC Drug Interaction Crawler...");

    // 1. Load NHIC supported ingredients list
    if (!fs.existsSync(PAGE_HTML_PATH)) {
        console.error(`❌ Không tìm thấy file gốc ${PAGE_HTML_PATH}. Hãy đảm bảo bạn đã tải page.html vào thư mục scratch.`);
        process.exit(1);
    }
    const pageHtml = fs.readFileSync(PAGE_HTML_PATH, 'utf8');
    const nhicIngredients = [];
    const nhicKeyMap = new Map(); // fuzzy -> original
    const ingredientRegex = /class="HoatChatTuongTacID" data-key="([^"]+)"/g;
    let match;
    while ((match = ingredientRegex.exec(pageHtml)) !== null) {
        const val = match[1].trim();
        if (val) {
            nhicIngredients.push(val);
            nhicKeyMap.set(fuzzyNormalize(val), val);
        }
    }
    console.log(`- Loaded ${nhicIngredients.length} hoạt chất được NHIC hỗ trợ.`);

    // 2. Load hospital stock drugs
    const hospitalDrugsFile = path.join(CDS_DATA, 'drug_generic.json');
    if (!fs.existsSync(hospitalDrugsFile)) {
        console.error(`❌ Không tìm thấy file kho thuốc ${hospitalDrugsFile}.`);
        process.exit(1);
    }
    const genericMapJson = JSON.parse(fs.readFileSync(hospitalDrugsFile, 'utf8'));
    const hospitalActiveIngredients = new Set(Object.keys(genericMapJson));
    console.log(`- Trích xuất được ${hospitalActiveIngredients.size} hoạt chất thô.`);

    // 3. Map hospital ingredients to NHIC ingredients
    const targetNhicIngredients = new Set();
    const hospitalToNhicMap = new Map(); // hospital -> nhic

    for (const hospHc of hospitalActiveIngredients) {
        const fuzzyHosp = fuzzyNormalize(hospHc);
        // Tìm khớp chính xác hoặc fuzzy
        if (nhicKeyMap.has(fuzzyHosp)) {
            const nhicName = nhicKeyMap.get(fuzzyHosp);
            targetNhicIngredients.add(nhicName);
            hospitalToNhicMap.set(hospHc, nhicName);
            continue;
        }
        
        // Thử tìm kiểu chứa nhau (substring)
        let found = false;
        for (const nhicName of nhicIngredients) {
            const fuzzyNhic = fuzzyNormalize(nhicName);
            if (fuzzyNhic.includes(fuzzyHosp) || fuzzyHosp.includes(fuzzyNhic)) {
                targetNhicIngredients.add(nhicName);
                hospitalToNhicMap.set(hospHc, nhicName);
                found = true;
                break;
            }
        }
    }

    const crawlQueue = Array.from(targetNhicIngredients).sort();
    console.log(`- Đã tìm thấy khớp ${crawlQueue.length} hoạt chất chuẩn trong CSDL NHIC để cào.`);

    // Áp dụng giới hạn dry-run
    let activeQueue = crawlQueue;
    if (limit) {
        activeQueue = crawlQueue.slice(0, limit);
        console.log(`⚠️ DRY-RUN MODE: Chỉ cào ${limit} hoạt chất đầu tiên.`);
    }

    // 4. Load Checkpoint / Resume
    let progress = {
        completedIngredients: {},
        interactions: {}, // Map của UID -> interaction object
        currentIndex: 0
    };

    if (resume && fs.existsSync(PROGRESS_FILE)) {
        try {
            progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
            console.log(`🔄 Khôi phục tiến trình từ checkpoint. Đã hoàn thành ${Object.keys(progress.completedIngredients).length} hoạt chất.`);
        } catch (e) {
            console.warn("⚠️ Không thể đọc file checkpoint, bắt đầu lại từ đầu.");
        }
    }

    // Danh sách hoạt chất thực tế cần cào
    const remainingIngredients = activeQueue.filter(hc => !progress.completedIngredients[hc]);
    console.log(`- Số lượng hoạt chất cần cào còn lại: ${remainingIngredients.length}`);

    // Hàm lưu checkpoint
    const saveCheckpoint = () => {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
    };

    // Hàm helper chạy cào chi tiết tương tác theo hàng đợi
    const batchSearch = async (ingredients) => {
        let activeRequests = 0;
        let index = 0;

        return new Promise((resolve) => {
            const next = async () => {
                if (index >= ingredients.length && activeRequests === 0) {
                    return resolve();
                }

                while (activeRequests < CONCURRENCY_LIMIT && index < ingredients.length) {
                    const currentHc = ingredients[index++];
                    activeRequests++;
                    
                    console.log(`[Crawl] Đang tìm kiếm [${index}/${ingredients.length}]: ${currentHc}...`);
                    
                    // Thao tác cào
                    crawlSingleIngredient(currentHc, progress, targetNhicIngredients)
                        .then(() => {
                            progress.completedIngredients[currentHc] = true;
                            saveCheckpoint();
                            console.log(`[Success] Hoàn thành: ${currentHc}`);
                        })
                        .catch(err => {
                            console.error(`[Error] Thất bại khi cào ${currentHc}:`, err.message);
                        })
                        .finally(() => {
                            activeRequests--;
                            // Khoảng nghỉ giữa các request
                            setTimeout(next, REQUEST_DELAY);
                        });
                }
            };
            next();
        });
    };

    // 5. Khởi chạy hàng loạt
    const startTime = Date.now();
    await batchSearch(remainingIngredients);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n🎉 Hoàn thành cào danh sách tương tác trong ${duration}s.`);
    
    // 6. Cào chi tiết xử trí cho các tương tác thu thập được
    const allInteractions = Object.values(progress.interactions);
    // Lọc lấy các tương tác có đầy đủ UID và chưa có chi tiết xử trí
    const pendingDetails = allInteractions.filter(inter => inter.uid && !inter.management);
    console.log(`- Tổng số tương tác cặp: ${allInteractions.length}`);
    console.log(`- Số tương tác cần cào thêm chi tiết (Cơ chế & Xử trí): ${pendingDetails.length}`);

    if (pendingDetails.length > 0) {
        console.log(`\n⏳ Bắt đầu cào chi tiết cơ chế & xử trí cho ${pendingDetails.length} cặp tương tác...`);
        let detailCount = 0;
        
        // Cào chi tiết tuần tự/song song giới hạn
        let activeDetailRequests = 0;
        let detailIndex = 0;

        await new Promise((resolve) => {
            const nextDetail = async () => {
                if (detailIndex >= pendingDetails.length && activeDetailRequests === 0) {
                    return resolve();
                }

                while (activeDetailRequests < CONCURRENCY_LIMIT && detailIndex < pendingDetails.length) {
                    const inter = pendingDetails[detailIndex++];
                    activeDetailRequests++;
                    
                    console.log(`[Detail] [${detailIndex}/${pendingDetails.length}] Cào chi tiết: ${inter.pairText}...`);
                    
                    crawlInteractionDetails(inter.uid)
                        .then(details => {
                            // Cập nhật thông tin chi tiết vào object chính
                            const key = inter.uid;
                            if (progress.interactions[key]) {
                                progress.interactions[key].mechanism = details.mechanism || 'Không có thông tin cơ chế';
                                progress.interactions[key].management = details.management || 'Theo dõi lâm sàng';
                            }
                            detailCount++;
                            if (detailCount % 10 === 0) saveCheckpoint(); // Lưu tiến trình mỗi 10 dòng
                        })
                        .catch(err => {
                            console.error(`[Error Detail] Lỗi cặp ${inter.pairText}:`, err.message);
                        })
                        .finally(() => {
                            activeDetailRequests--;
                            setTimeout(nextDetail, REQUEST_DELAY);
                        });
                }
            };
            nextDetail();
        });
        saveCheckpoint();
        console.log(`✅ Đã cào thành công chi tiết cho ${detailCount} tương tác.`);
    }

    // 7. Xuất file JSON kết quả theo đúng cấu trúc của Aladinn CDS
    const finalRules = Object.values(progress.interactions).map((inter, idx) => {
        // Ánh xạ mức độ tương tác sang severity chuẩn
        let severity = 'moderate';
        const rawSeverity = inter.rawSeverity ? inter.rawSeverity.toLowerCase() : '';
        if (rawSeverity.includes('chống chỉ định')) {
            severity = 'high'; // hoặc critical
        } else if (rawSeverity.includes('nghiêm trọng')) {
            severity = 'high';
        } else if (rawSeverity.includes('trung bình') || rawSeverity.includes('ý nghĩa')) {
            severity = 'moderate';
        } else if (rawSeverity.includes('nhẹ') || rawSeverity.includes('theo dõi')) {
            severity = 'minor';
        }

        // Tạo rule code
        const codeA = fuzzyNormalize(inter.drugA).substring(0, 8).toUpperCase();
        const codeB = fuzzyNormalize(inter.drugB).substring(0, 8).toUpperCase();
        const ruleCode = `DDI-NHIC-${codeA}-${codeB}-${String(idx + 1).padStart(3, '0')}`;

        return {
            rule_code: ruleCode,
            generic_a: inter.drugA.toLowerCase(),
            generic_b: inter.drugB.toLowerCase(),
            severity: severity,
            evidence_level: 'high', // Mặc định CSDL Bộ Y Tế có độ tin cậy cao
            clinical_effect: inter.consequence || `Tương tác giữa ${inter.drugA} và ${inter.drugB}`,
            mechanism: inter.mechanism || '',
            recommendation: inter.management || 'Cân nhắc lâm sàng khi phối hợp.',
            nhic_uid: inter.uid,
            nhic_severity_raw: inter.rawSeverity,
            is_active: true,
            version: "1.0.0",
            _source: "CSDL Tuong Tac Thuoc - Bo Y Te (NHIC)"
        };
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalRules, null, 2) + '\n', 'utf8');
    console.log(`\n🚀 HOÀN TẤT! Đã ghi ${finalRules.length} quy tắc tương tác vào file:`);
    console.log(`👉 ${OUTPUT_FILE}`);
}

// ============= CRAWL SINGLE INGREDIENT LIST =============

async function crawlSingleIngredient(ingredientName, progress, targetNhicIngredients) {
    const urlPath = `/Home/TraCuuMotHoatChat?strHoatChatTuongTac=${encodeURIComponent(ingredientName)}`;
    const html = await requestWithRetry(urlPath);
    
    // Parse các dòng tương tác
    const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    
    while ((match = trRegex.exec(html)) !== null) {
        const content = match[1];
        if (content.includes('FunctionCallView')) {
            // Lấy UID
            const uidMatch = content.match(/FunctionCallView\s*\(\s*'([^']+)'/);
            const uid = uidMatch ? uidMatch[1] : '';
            if (!uid) continue;

            // Lấy tên cặp thuốc
            const pairRegex = /<a[^>]*onclick="FunctionCallView[^>]*>([\s\S]*?)<\/a>/i;
            const pairMatch = content.match(pairRegex);
            let pairText = pairMatch ? pairMatch[1].replace(/<[^>]+>/g, '').trim() : '';
            pairText = decodeHtmlEntities(pairText);
            
            const drugs = pairText.split(/\s+-\s+/);
            const drugA = drugs[0] ? drugs[0].trim() : '';
            const drugB = drugs[1] ? drugs[1].trim() : '';
            if (!drugA || !drugB) continue;

            // Kiểm tra xem drugB có trong tập hoạt chất của bệnh viện không
            // (Chỉ cào tương tác nếu cả hai hoạt chất đều nằm trong tập kho bệnh viện chuẩn)
            let isDrugBMapped = false;
            for (const targetHc of targetNhicIngredients) {
                if (fuzzyNormalize(targetHc) === fuzzyNormalize(drugB)) {
                    isDrugBMapped = true;
                    break;
                }
            }
            
            if (!isDrugBMapped) {
                // Bỏ qua nếu drugB không thuộc danh mục kho bệnh viện
                continue;
            }

            // Lấy Mức độ & Hậu quả
            const tds = content.split(/<\/td>/i).map(td => td.replace(/<[^>]+>/g, '').trim()).map(decodeHtmlEntities);
            const rawSeverity = tds[3] ? tds[3].replace(/\s+/g, ' ').trim() : '';
            const consequence = tds[4] ? tds[4].replace(/\s+/g, ' ').trim() : '';

            // Lưu vào danh sách tương tác (tránh trùng lặp)
            const key = uid;
            if (!progress.interactions[key]) {
                progress.interactions[key] = {
                    uid,
                    pairText,
                    drugA,
                    drugB,
                    rawSeverity,
                    consequence
                };
            }
        }
    }
}

// ============= CRAWL INTERACTION DETAILS =============

async function crawlInteractionDetails(uid) {
    const urlPath = `/Home/ViewReadXMLDecode?UID=${uid}&par=0`;
    const jsonStr = await requestWithRetry(urlPath);
    
    let resultHtml = '';
    try {
        const arr = JSON.parse(jsonStr);
        resultHtml = arr[1] || '';
    } catch (e) {
        throw new Error(`Parse JSON failed for UID ${uid}: ${e.message}`);
    }

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    const details = { mechanism: '', management: '' };

    while ((match = trRegex.exec(resultHtml)) !== null) {
        const content = match[1];
        const tds = content.split(/<\/td>/i).map(td => td.replace(/<[^>]+>/g, '').trim()).map(decodeHtmlEntities);
        if (tds.length >= 2) {
            const key = tds[0].trim();
            const value = tds[1].trim();
            if (key === 'Cơ chế tương tác') {
                details.mechanism = value.replace(/\r\n/g, '\n').trim();
            } else if (key === 'Xử trí tương tác') {
                details.management = value.replace(/\r\n/g, '\n').trim();
            }
        }
    }
    
    return details;
}

// Chạy Crawler
run().catch(err => {
    console.error("❌ Lỗi nghiêm trọng khi chạy Crawler:", err);
    process.exit(1);
});
