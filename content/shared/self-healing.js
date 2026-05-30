/* global module */
/**
 * VNPT HIS Extension v4.0.1
 * Module: Self-Healing DOM Engine
 * 
 * Provides robust semantic layout matching algorithms to locate inputs/textareas
 * by adjacent labels, placeholders, or title attributes in case the static IDs fail.
 */
(function() {
    'use strict';

    // Helper: Normalize Vietnamese string to lowercase, without accents, trimmed, and simplified spacing
    function normalizeText(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese accents
            .replace(/[đĐ]/g, 'd')
            .replace(/[^a-z0-9\s]/g, ' ') // replace special chars with space
            .replace(/\s+/g, ' ')
            .trim();
    }

    var CLINICAL_DICTIONARY = {
        // Hoi Chan (Consultation) Form
        'trichBienBan': ['trich bien ban', 'trich bb hoi chan', 'trich bien ban hoi chan', 'trich bien ban lam viec'],
        'lyDoHoiChan': ['ly do hoi chan', 'ly do', 'yeu cau hoi chan', 'ly do hoi chan/hoi y'],
        'yeuCauHoiChan': ['yeu cau hoi chan', 'yeu cau', 'noi dung yeu cau'],
        'tomTatTieuSuBenh': ['tom tat tieu su benh', 'tieu su benh', 'tien su benh', 'tien su'],
        'tomTatTTVaoVien': ['tom tat tt luc vao vien', 'tinh trang luc vao vien', 'luc vao vien', 'tinh trang vao vien'],
        'tomTatTTHienTai': ['tom tat tt hien tai', 'tinh trang hien tai', 'tt hien tai', 'tinh trang nguoi benh hien tai', 'tinh trang luc hoi chan'],
        'benhSu': ['benh su', 'dien bien benh', 'tien su benh', 'qua trinh benh ly'],
        'quaTrinhDieuTriCS': ['qua trinh dieu tri cs', 'qua trinh dieu tri', 'qua trinh benh ly', 'dien bien lam sang', 'qua trinh dieu tri va cham soc'],
        'ketLuanChanDoan': ['ket luan chan doan', 'chan doan', 'kết luận chẩn đoán', 'nguyen nhan', 'tien luong', 'chan doan xac dinh'],
        'yKienThanhVien': ['y kien thanh vien', 'y kien cua cac thanh vien', 'y kien', 'y kien thao luan'],
        'phuongPhapDieuTri': ['phuong phap dieu tri', 'pp dieu tri', 'huong dieu tri', 'phuong phap dieu tri phau thuat'],
        'chamSoc': ['cham soc', 'che do cham soc', 'huong dan cham soc', 'cham soc va theo doi'],
        'ketLuan': ['ket luan', 'ket luan hoi chan', 'y kien thong nhat'],
        'huongDieuTri': ['huong dieu tri tiep theo', 'huong dieu tri', 'huong tiep theo'],
        'deNghi': ['de nghi', 'kien nghi', 'de xuat', 'y kien de nghi'],

        // Chuyen Vien (Transfer) Form
        'dauHieuLamSang': ['dau hieu lam sang', 'trieu chung lam sang', 'lam sang', 'dau hieu', 'tinh trang luc vao vien'],
        'quaTrinhBenhLy': ['qua trinh benh ly', 'dien bien benh', 'benh su'],
        'ketQuaCLS': ['ket qua can lam sang', 'can lam sang', 'ket qua cls', 'xet nghiem', 'chuan doan hinh anh'],
        'tinhTrangNguoiBenh': ['tinh trang nguoi benh', 'tinh trang benh nhan', 'tinh trang luc chuyen', 'tinh trang luc ra vien'],
        'thuoc': ['thuoc', 'thuoc dieu tri', 'thuoc da dung', 'thuoc su dung', 'phuong phap su dung thuoc'],
        
        // Nutrition Form (DD-03)
        'weight': ['can nang', 'weight', 'trong luong', 'can nang (kg)'],
        'height': ['chieu cao', 'height', 'chieu cao (cm)'],
        'bmi': ['bmi', 'chi so khoi co the', 'chi so bmi'],
        'sutCan': ['sut can', 'sut can khong mong muon'],
        'bmiThap': ['bmi thap', 'bmi < 18.5'],
        'teoCo': ['teo co', 'co bap beo xop', 'teo co/beo xop'],
        'phuNgoaiVi': ['phu ngoai vi', 'phu', 'phu chan'],
        'benhLyTieuHoa': ['benh ly tieu hoa', 'duong tieu hoa', 'tieu hoa'],
        'anUongGiamSut': ['an uong giam sut', 'giam an uong', 'an uong kem'],
        'boSungMieng': ['bo sung dinh duong duong mieng', 'bo sung dinh duong', 'dinh duong mieng']
    };

    var SelfHealingEngine = {
        normalizeText: normalizeText,
        CLINICAL_DICTIONARY: CLINICAL_DICTIONARY,

        /**
         * Finds the closest input/textarea/select element that matches a set of label keywords.
         * @param {HTMLElement|Document} root - The scope to search in
         * @param {string[]} keywords - List of normalized keywords to search for
         * @param {string} targetType - Type of target element ('input', 'textarea', 'select', 'checkbox', 'any')
         * @returns {HTMLElement|null} The best matching input/textarea/select element
         */
        findSemanticField: function(root, keywords, targetType) {
            var doc = root || document;
            if (!keywords || keywords.length === 0) return null;
            if (!targetType) targetType = 'any';

            var normalizedKeywords = keywords.map(normalizeText);

            // Step 1: Query all candidate labels or elements containing text in the DOM
            var candidates = [];
            var elements = doc.querySelectorAll('label, span, th, td, div, p');
            
            var i, j, k, c, el, text, normText, maxScore, kw, forId, target, nestedInput, current, depth, parent, inputs, inp;
            var placeholder, name, id, title, searchStr, normSearch;

            for (i = 0; i < elements.length; i++) {
                el = elements[i];
                // Ignore elements that have nested elements to avoid duplicate matching outer elements
                if (el.children.length > 5) continue; 
                
                text = el.textContent || '';
                if (!text || text.trim().length > 150) continue; // Skip large text blocks

                normText = normalizeText(text);
                
                // Let's compute a match score for this label
                maxScore = 0;
                for (k = 0; k < normalizedKeywords.length; k++) {
                    kw = normalizedKeywords[k];
                    if (normText === kw) {
                        maxScore = Math.max(maxScore, 100); // Exact match
                    } else if (normText.indexOf(kw) === 0) {
                        maxScore = Math.max(maxScore, 80);  // Prefix match
                    } else if (normText.indexOf(kw) !== -1) {
                        maxScore = Math.max(maxScore, 50);  // Contains match
                    }
                }

                if (maxScore > 0) {
                    candidates.push({ element: el, score: maxScore, text: text });
                }
            }

            // Sort candidates by score descending
            candidates.sort(function(a, b) { return b.score - a.score; });

            // Step 2: For each label candidate, find the nearest associated input field
            for (c = 0; c < candidates.length; c++) {
                var labelEl = candidates[c].element;
                
                // Case A: Label has a "for" attribute pointing to an element
                if (labelEl.tagName.toLowerCase() === 'label') {
                    forId = labelEl.getAttribute('for');
                    if (forId) {
                        target = doc.getElementById(forId);
                        if (target && isTargetElement(target, targetType)) {
                            return target;
                        }
                    }
                }

                // Case B: Input is nested inside the label itself
                nestedInput = labelEl.querySelector('input, textarea, select');
                if (nestedInput && isTargetElement(nestedInput, targetType)) {
                    return nestedInput;
                }

                // Case C: Check siblings in the parent elements
                current = labelEl;
                depth = 0;
                while (current && depth < 3) {
                    parent = current.parentElement;
                    if (parent) {
                        inputs = parent.querySelectorAll('input, textarea, select');
                        for (j = 0; j < inputs.length; j++) {
                            inp = inputs[j];
                            if (inp !== labelEl && isTargetElement(inp, targetType)) {
                                return inp;
                            }
                        }
                    }
                    current = parent;
                    depth++;
                }
            }

            // Step 3: Fallback - Search in placeholders or title attributes or name/id of input fields directly
            var allInputs = doc.querySelectorAll('input, textarea, select');
            var directCandidates = [];

            for (i = 0; i < allInputs.length; i++) {
                inp = allInputs[i];
                if (!isTargetElement(inp, targetType)) continue;

                placeholder = inp.getAttribute('placeholder') || '';
                name = inp.getAttribute('name') || '';
                id = inp.getAttribute('id') || '';
                title = inp.getAttribute('title') || '';

                searchStr = [placeholder, name, id, title].join(' ');
                normSearch = normalizeText(searchStr);

                maxScore = 0;
                for (k = 0; k < normalizedKeywords.length; k++) {
                    kw = normalizedKeywords[k];
                    if (normSearch.indexOf(kw) !== -1) {
                        maxScore = Math.max(maxScore, 40); // Direct match fallback score
                    }
                }

                if (maxScore > 0) {
                    directCandidates.push({ element: inp, score: maxScore });
                }
            }

            if (directCandidates.length > 0) {
                directCandidates.sort(function(a, b) { return b.score - a.score; });
                return directCandidates[0].element;
            }

            return null;
        },

        /**
         * Resolves a key (from mapping) to keywords using the clinical dictionary or custom keywords, 
         * and searches for the element using normal select first, then falls back to semantic matching.
         * @param {HTMLElement|Document} root - Root element/document
         * @param {string} fieldIdStr - Pipe-separated possible IDs (e.g. 'txtTOMTAT_TIEUSUBENH')
         * @param {string} mappingKey - Key in clinicalData (e.g. 'tomTatTieuSuBenh')
         * @returns {HTMLElement|null} The resolved DOM element
         */
        resolveElement: function(root, fieldIdStr, mappingKey) {
            var doc = root || document;

            // 1. Try traditional lookup by ID/name first
            if (fieldIdStr) {
                var ids = fieldIdStr.split('|');
                for (var i = 0; i < ids.length; i++) {
                    var currId = ids[i].trim();
                    if (!currId) continue;
                    
                    // Standard selectors or names
                    var el = doc.getElementById(currId) || doc.querySelector('[name="' + currId + '"]');
                    if (el) return el;
                    
                    // Try exact selector fallback if it starts with # or .
                    try {
                        var queryEl = doc.querySelector(currId);
                        if (queryEl) return queryEl;
                    } catch (_e) {}
                }
            }

            // 2. Fall back to semantic self-healing matching
            console.log("[Self-Healing] Standard selector failed for key '" + mappingKey + "' (ID string: '" + fieldIdStr + "'). Starting semantic healing fallback...");
            
            // Get keywords for this mapping key
            var keywords = CLINICAL_DICTIONARY[mappingKey] || [];
            
            // If the fieldIdStr has some clean names, use them as keywords too
            if (fieldIdStr) {
                var parts = fieldIdStr.split('|').map(function(p) {
                    return p.replace(/^(txt|cbo|cbb|btn|checkbox)/i, '');
                });
                keywords = keywords.concat(parts);
            }

            // Determine expected element type
            var expectedType = 'any';
            if (fieldIdStr) {
                var lowerStr = fieldIdStr.toLowerCase();
                if (lowerStr.indexOf('checkbox') !== -1 || lowerStr.indexOf('chk') !== -1) {
                    expectedType = 'checkbox';
                } else if (lowerStr.indexOf('cbo') !== -1 || lowerStr.indexOf('cbb') !== -1 || lowerStr.indexOf('select') !== -1) {
                    expectedType = 'select';
                }
            }

            var found = this.findSemanticField(doc, keywords, expectedType);
            if (found) {
                console.log("[Self-Healing] Successfully matched field '" + mappingKey + "' semantically to element:", found);
            } else {
                console.warn("[Self-Healing] Failed to match field '" + mappingKey + "' semantically.");
            }

            return found;
        }
    };

    function isTargetElement(el, targetType) {
        if (!el) return false;
        var tagName = el.tagName.toLowerCase();
        
        if (targetType === 'input') {
            return tagName === 'input' && el.type !== 'checkbox' && el.type !== 'radio';
        }
        if (targetType === 'checkbox') {
            return tagName === 'input' && (el.type === 'checkbox' || el.type === 'radio');
        }
        if (targetType === 'select') {
            return tagName === 'select';
        }
        if (targetType === 'textarea') {
            return tagName === 'textarea';
        }
        
        // 'any'
        return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    }

    // Export to global scope
    if (typeof window !== 'undefined') {
        window.SelfHealingEngine = SelfHealingEngine;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { SelfHealingEngine: SelfHealingEngine };
    }
})();
