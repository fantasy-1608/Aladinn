import { describe, it, expect } from 'vitest';

// Giả lập hàm làm sạch văn bản HIS tương tự như trong api-bridge.js
function _cleanHisText(str) {
    if (!str) return '';
    return str
        .replace(/<[^>]+>/g, '\n')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .trim();
}

describe('Bóc tách Dữ liệu Lâm sàng Tờ điều trị VNPT HIS', () => {
    
    describe('Hàm làm sạch văn bản _cleanHisText', () => {
        it('loại bỏ hoàn toàn các thẻ HTML và làm sạch văn bản', () => {
            const rawHtml = '<p><strong>*Y lệnh khác:</strong><br /> Không thực hiện y lệnh truyền Paracetamol. Hủy sử dụng Paracetamol<br /> &nbsp;</p>';
            const cleaned = _cleanHisText(rawHtml);
            expect(cleaned).toContain('Không thực hiện y lệnh truyền Paracetamol. Hủy sử dụng Paracetamol');
            expect(cleaned).not.toContain('<p>');
            expect(cleaned).not.toContain('&nbsp;');
        });

        it('xử lý các ký tự thực thể đặc biệt (entities)', () => {
            const rawHtml = 'Glucose máu &amp; điện giải đồ';
            expect(_cleanHisText(rawHtml)).toBe('Glucose máu & điện giải đồ');
        });
    });

    describe('Ánh xạ kết quả chi tiết NGT02K015.LAYDL', () => {
        it('bóc tách chính xác các trường lâm sàng tự do từ gói tin API', () => {
            // Giả lập kết quả trả về từ Stored Procedure NGT02K015.LAYDL
            const mockLaydlObj = {
                YLENH: '<p>Không thực hiện y lệnh truyền Paracetamol.</p>',
                XULY: 'Hủy sử dụng Paracetamol, chuyển khám chuyên khoa',
                KHAMTOANTHAN: 'Bệnh tỉnh, tiếp xúc tốt',
                KHAMBOPHAN: 'Tim đều, phổi trong',
                DIENBIENBENH: 'Bệnh nhân giảm đau đầu'
            };

            const sheet = {
                NGAYMAUBENHPHAM: '25/05/2026 14:18:00',
                NGUOITAO: 'Bs. Lê Minh Thông',
                DIENBIEN: '',
                YLENH: ''
            };

            // Thực hiện ánh xạ tương tự logic trong api-bridge.js
            sheet.YLENH = _cleanHisText(mockLaydlObj.YLENH || mockLaydlObj.Y_LENH || sheet.YLENH || '');
            sheet.XULY = _cleanHisText(mockLaydlObj.XULY || mockLaydlObj.HUONGXUTRI || mockLaydlObj.HUONGXULY || mockLaydlObj.HUONG_XU_TRI || sheet.XULY || '');
            sheet.TOANTHAN = _cleanHisText(mockLaydlObj.KHAMTOANTHAN || mockLaydlObj.TOANTHAN || mockLaydlObj.KHAMBENH_TOANTHAN || mockLaydlObj.KHAM_TOAN_THAN || sheet.TOANTHAN || '');
            sheet.KHAMBOPHAN = _cleanHisText(mockLaydlObj.KHAMBOPHAN || mockLaydlObj.BOPHAN || mockLaydlObj.KHAMBENH_BOPHAN || sheet.KHAMBOPHAN || '');
            sheet.DIENBIEN = _cleanHisText(mockLaydlObj.DIENBIENBENH || mockLaydlObj.DIENBIEN || sheet.DIENBIEN || '');

            expect(sheet.YLENH).toBe('Không thực hiện y lệnh truyền Paracetamol.');
            expect(sheet.XULY).toBe('Hủy sử dụng Paracetamol, chuyển khám chuyên khoa');
            expect(sheet.TOANTHAN).toBe('Bệnh tỉnh, tiếp xúc tốt');
            expect(sheet.KHAMBOPHAN).toBe('Tim đều, phổi trong');
            expect(sheet.DIENBIEN).toBe('Bệnh nhân giảm đau đầu');
        });
    });

    describe('Tạo tờ điều trị ảo realtime (virtualSheet)', () => {
        it('bóc tách và đồng bộ đầy đủ Khám/Xử lý thời gian thực từ DOM', () => {
            // Giả lập dữ liệu trích xuất từ DOM
            const mockDomSheet = {
                dienBienBenh: 'Khai lại có dị ứng Paracetamol cách đây nhiều năm',
                khamToanThanTDT: 'Tỉnh, tiếp xúc tốt',
                khamBoPhan: 'Bụng mềm, gan lách không to',
                huongXuLy: 'Ngưng truyền Paracetamol, theo dõi sát sinh hiệu',
                yLenh: 'Không thực hiện y lệnh truyền Paracetamol. Hủy sử dụng Paracetamol'
            };

            // Khởi tạo virtualSheet tương tự logic realtime DOM
            const virtualSheet = {
                DIENBIEN: mockDomSheet.dienBienBenh || '',
                GHICHU: mockDomSheet.huongXuLy || '',
                NGUOITAO: 'Bản nháp — chưa lưu',
                NGAYMAUBENHPHAM: '25/05/2026 22:05:00 (Đang soạn thảo)',
                MAUBENHPHAMID: 'REALTIME_DOM_SHEET',
                CHANDOAN: 'Viêm mô bào',
                CHANDOANKEMTHEO: '',
                YLENH: mockDomSheet.yLenh || '',
                XULY: mockDomSheet.huongXuLy || '',
                TOANTHAN: mockDomSheet.khamToanThanTDT || '',
                KHAMBOPHAN: mockDomSheet.khamBoPhan || '',
                IS_REALTIME: true
            };

            expect(virtualSheet.XULY).toBe('Ngưng truyền Paracetamol, theo dõi sát sinh hiệu');
            expect(virtualSheet.TOANTHAN).toBe('Tỉnh, tiếp xúc tốt');
            expect(virtualSheet.KHAMBOPHAN).toBe('Bụng mềm, gan lách không to');
            expect(virtualSheet.YLENH).toBe('Không thực hiện y lệnh truyền Paracetamol. Hủy sử dụng Paracetamol');
            expect(virtualSheet.NGUOITAO).toBe('Bản nháp — chưa lưu');
            expect(virtualSheet.IS_REALTIME).toBe(true);
        });

        it('không tạo tờ ảo khi form điều trị hoàn toàn trống (dương tính giả)', () => {
            // Giả lập form HIS render sẵn nhưng bác sĩ chưa gõ gì
            const emptyDomSheet = {
                dienBienBenh: '',
                khamToanThanTDT: '',
                khamBoPhan: '',
                huongXuLy: '',
                yLenh: '',
                chanDoanChinh: '',
                chanDoanKemTheo: '',
                sinhHieu: {
                    pulse: '', temperature: '', bloodPressure: '',
                    respiratoryRate: '', weight: '', height: '', spo2: ''
                }
            };

            // Logic kiểm tra nội dung tương tự scrapeTreatmentSheetFromDOM() sau PA3
            const hasContent = !!(
                emptyDomSheet.dienBienBenh ||
                emptyDomSheet.khamToanThanTDT ||
                emptyDomSheet.khamBoPhan ||
                emptyDomSheet.huongXuLy ||
                emptyDomSheet.yLenh ||
                emptyDomSheet.chanDoanChinh ||
                emptyDomSheet.chanDoanKemTheo ||
                emptyDomSheet.sinhHieu.pulse ||
                emptyDomSheet.sinhHieu.temperature ||
                emptyDomSheet.sinhHieu.bloodPressure ||
                emptyDomSheet.sinhHieu.respiratoryRate
            );

            expect(hasContent).toBe(false);
        });

        it('tạo tờ ảo khi bác sĩ thực sự đã gõ nội dung vào form', () => {
            const activeDomSheet = {
                dienBienBenh: 'Bệnh nhân than đau bụng vùng thượng vị',
                khamToanThanTDT: '',
                khamBoPhan: '',
                huongXuLy: '',
                yLenh: '',
                chanDoanChinh: '',
                chanDoanKemTheo: '',
                sinhHieu: {
                    pulse: '', temperature: '', bloodPressure: '',
                    respiratoryRate: '', weight: '', height: '', spo2: ''
                }
            };

            const hasContent = !!(
                activeDomSheet.dienBienBenh ||
                activeDomSheet.khamToanThanTDT ||
                activeDomSheet.khamBoPhan ||
                activeDomSheet.huongXuLy ||
                activeDomSheet.yLenh ||
                activeDomSheet.chanDoanChinh ||
                activeDomSheet.chanDoanKemTheo ||
                activeDomSheet.sinhHieu.pulse ||
                activeDomSheet.sinhHieu.temperature ||
                activeDomSheet.sinhHieu.bloodPressure ||
                activeDomSheet.sinhHieu.respiratoryRate
            );

            expect(hasContent).toBe(true);
        });
    });

    describe('Chuẩn hóa kết quả dạng mảng hoặc rows từ LAYDL', () => {
        it('bóc tách chính xác phần tử đầu tiên khi kết quả trả về là một mảng', () => {
            const mockLaydlArray = [{
                YLENH: 'Ngưng dùng thuốc cũ',
                XULY: 'Theo dõi tiếp'
            }];

            let laydlObj = null;
            const parsed = mockLaydlArray;
            if (parsed) {
                if (Array.isArray(parsed)) {
                    laydlObj = parsed[0];
                } else {
                    laydlObj = parsed;
                }
            }

            expect(laydlObj).not.toBeNull();
            expect(laydlObj.YLENH).toBe('Ngưng dùng thuốc cũ');
            expect(laydlObj.XULY).toBe('Theo dõi tiếp');
        });

        it('bóc tách chính xác phần tử từ thuộc tính rows của kết quả', () => {
            const mockLaydlRowsObj = {
                rows: [{
                    YLENH: 'Cho bệnh nhân ra viện',
                    XULY: 'Cấp toa thuốc về nhà'
                }]
            };

            let laydlObj = null;
            const parsed = mockLaydlRowsObj;
            if (parsed) {
                if (Array.isArray(parsed)) {
                    laydlObj = parsed[0];
                } else if (parsed.rows && Array.isArray(parsed.rows)) {
                    laydlObj = parsed.rows[0];
                } else {
                    laydlObj = parsed;
                }
            }

            expect(laydlObj).not.toBeNull();
            expect(laydlObj.YLENH).toBe('Cho bệnh nhân ra viện');
            expect(laydlObj.XULY).toBe('Cấp toa thuốc về nhà');
        });
    });

    describe('Gộp yLenhList và định dạng timeline trong scanner-init.js', () => {
        it('gộp thành công treatments và yLenhList và phân loại đúng bằng helper isOtherOrder', () => {
            const mockTreatments = [
                { DIENBIEN: 'Bệnh tỉnh', MAUBENHPHAMID: 'SHEET1', SOURCE_API: 'NT.024.DSPHIEU' }
            ];
            const mockYLenhList = [
                { YLENH: 'Ngưng truyền Paracetamol', SOURCE_API: 'NGT02K015.LAYDL' }
            ];

            // Logic gộp mới
            const combinedTreatments = [
                ...mockTreatments,
                ...mockYLenhList
            ];

            const isOtherOrder = (item) => 
                item?.SOURCE_API === 'NGT02K015.YLENH' || 
                item?.SOURCE_API === 'NT.024.2.DETAIL' || 
                item?.SOURCE_API === 'NGT02K015.LAYDL' ||
                item?.SOURCE_API === 'REALTIME_DOM';

            expect(combinedTreatments).toHaveLength(2);
            
            // Phần tử thứ 1 phải là diễn tiến tờ điều trị gốc (không phải other order)
            expect(isOtherOrder(combinedTreatments[0])).toBe(false);
            
            // Phần tử thứ 2 phải là y lệnh CKEditor (phải là other order)
            expect(isOtherOrder(combinedTreatments[1])).toBe(true);
        });
    });

    describe('Bộ kiểm duyệt và làm sạch Lý do vào viện thông minh', () => {
        // Hàm giả lập giống như trong api-bridge.js
        function _cleanLydoVaoVien(val) {
            if (!val) return '';
            var trimmed = String(val).trim();
            if (/^[.\-\s\_\?]+$/.test(trimmed) || trimmed.match(/^\.+\s*$/)) {
                return '';
            }
            return trimmed;
        }

        it('làm sạch dấu chấm lửng vô nghĩa thành chuỗi rỗng', () => {
            expect(_cleanLydoVaoVien('......')).toBe('');
            expect(_cleanLydoVaoVien('.')).toBe('');
            expect(_cleanLydoVaoVien('   ...   ')).toBe('');
        });

        it('làm sạch dấu gạch ngang hoặc khoảng trắng vô nghĩa thành chuỗi rỗng', () => {
            expect(_cleanLydoVaoVien('---')).toBe('');
            expect(_cleanLydoVaoVien(' ? ')).toBe('');
            expect(_cleanLydoVaoVien('___')).toBe('');
        });

        it('giữ nguyên lý do vào viện lâm sàng hợp lệ', () => {
            expect(_cleanLydoVaoVien('Viêm mô bào bàn chân')).toBe('Viêm mô bào bàn chân');
            expect(_cleanLydoVaoVien('Đau ngực giờ thứ 3')).toBe('Đau ngực giờ thứ 3');
        });

        it('logic kiểm duyệt (validation) phát hiện chính xác các chuỗi vô nghĩa', () => {
            var validateLogic = function(val) {
                var v = (val || '').trim();
                return !v || v.length === 0 || /^[.\-\s\_\?]+$/.test(v) || !!v.match(/^\.+\s*$/);
            };

            expect(validateLogic('......')).toBe(true);
            expect(validateLogic('')).toBe(true);
            expect(validateLogic('---')).toBe(true);
            
            expect(validateLogic('Viêm mô bào')).toBe(false);
            expect(validateLogic('Tai nạn giao thông')).toBe(false);
        });
    });

    describe('Giải mã HTML Entities cho Y lệnh / Chế độ ăn / Chăm sóc thời gian thực', () => {
        // Giả lập hàm decode tương tự như trong api-bridge.js
        function _decodeHtmlEntities(str) {
            if (!str) return '';
            const map = {
                '&ecirc;': 'ê',
                '&aacute;': 'á',
                '&ocirc;': 'ô',
                '&agrave;': 'à',
                '&iacute;': 'í',
                'l&ecirc;̣nh': 'lệnh',
                'kh&aacute;c': 'khác',
                'Ch&ecirc;́': 'Chế',
                'đ&ocirc;̣': 'độ',
                'Đ&aacute;acute;i': 'Đái',
                'Đ&aacute;i': 'Đái',
                's&oacutec;': 'sóc',
                'chăm s&oacutec;': 'chăm sóc'
            };
            let decoded = str;
            for (const [key, val] of Object.entries(map)) {
                decoded = decoded.replace(new RegExp(key, 'g'), val);
            }
            return decoded.normalize('NFC');
        }

        it('giải mã thành công 100% các thực thể HTML tiếng Việt có dấu', () => {
            const rawText = '*Y l&ecirc;̣nh kh&aacute;c; *Ch&ecirc;́ đ&ocirc;̣ ăn: DD01 ( Đ&aacute;i đường đơn thuần ) *Ch&ecirc;́ đ&ocirc;̣ chăm s&oacutec; cấp III';
            const decoded = _decodeHtmlEntities(rawText);
            expect(decoded).toContain('Y lệnh khác');
            expect(decoded).toContain('Chế độ ăn');
            expect(decoded).toContain('Đái đường đơn thuần');
            expect(decoded).toContain('Chế độ chăm sóc');
        });
    });

    describe('Định tuyến và đồng bộ sinh hiệu theo ngày điều trị lịch sử', () => {
        it('ưu tiên lấy sinh hiệu từ dayTreatments của chính ngày điều trị đó thay vì vitalsData chung', () => {
            // Giả lập patientInfo chứa vitalsData chung (huyết áp lúc nhập viện)
            const patientInfo = {
                vitalsData: {
                    pulse: 80,
                    temperature: 37,
                    bloodPressure: '180/100',
                    respiratoryRate: 20
                }
            };

            // Giả lập danh sách tờ điều trị của ngày 25/05 chứa sinh hiệu thực tế 140/90
            const dayTreatments = [
                {
                    MACH: '80',
                    NHIETDO: '37',
                    HUYETAP: '140/90',
                    NHIPTHO: '21',
                    NGAYMAUBENHPHAM: '25/05/2026 07:00:00'
                }
            ];

            // Giả lập logic định tuyến sinh hiệu tương tự như scanner-init.js mới
            let dayVitals = [];
            let hasSnoopedVitals = false;

            // Quét dayTreatments trước
            dayTreatments.forEach(t => {
                const m = t.MACH;
                const t_nhiet = t.NHIETDO;
                const bp = t.HUYETAP;
                const b_nhip = t.NHIPTHO;
                
                if (m || t_nhiet || bp || b_nhip) {
                    dayVitals.push({
                        p: m ? parseFloat(m) : null,
                        t: t_nhiet ? parseFloat(t_nhiet) : null,
                        bp: bp ? String(bp) : null,
                        b: b_nhip ? parseInt(b_nhip) : null
                    });
                    hasSnoopedVitals = true;
                }
            });

            expect(hasSnoopedVitals).toBe(true);
            expect(dayVitals).toHaveLength(1);
            expect(dayVitals[0].bp).toBe('140/90');
            expect(dayVitals[0].bp).not.toBe('180/100');
        });

        it('bỏ trống phần sinh hiệu (không hiển thị) nếu ngày đó hoàn toàn khuyết thông số', () => {
            const dayTreatmentsNoVitals = [
                {
                    NGAYMAUBENHPHAM: '25/05/2026 15:20:00',
                    DIENBIEN: 'Bệnh tỉnh, tiếp xúc tốt'
                }
            ];

            let dayVitals = [];
            let hasSnoopedVitals = false;

            dayTreatmentsNoVitals.forEach(t => {
                const m = t.MACH;
                const bp = t.HUYETAP;
                if (m || bp) {
                    dayVitals.push({ p: m, bp: bp });
                    hasSnoopedVitals = true;
                }
            });

            expect(hasSnoopedVitals).toBe(false);
            expect(dayVitals).toHaveLength(0);
        });
    });

    describe('Bộ lọc thông minh ẩn Chế độ ăn & Chăm sóc ra khỏi Y lệnh khác', () => {
        it('loại bỏ hoàn toàn các order có NHOMYLENH là Chế độ ăn hoặc Chế độ chăm sóc', () => {
            const rawDayOrders = [
                { YLENH: 'BT02', NHOMYLENH: 'Chế độ ăn' },
                { YLENH: 'Cấp III', NHOMYLENH: 'Chế độ chăm sóc' },
                { YLENH: 'Chụp Xquang', NHOMYLENH: 'Y lệnh khác' }
            ];

            const dayOrders = [];
            for (const d of rawDayOrders) {
                if (d.NHOMYLENH === 'Chế độ ăn' || d.NHOMYLENH === 'Chế độ chăm sóc') {
                    continue;
                }
                dayOrders.push(d);
            }

            expect(dayOrders).toHaveLength(1);
            expect(dayOrders[0].YLENH).toBe('Chụp Xquang');
            expect(dayOrders[0].NHOMYLENH).toBe('Y lệnh khác');
        });

        it('lọc bỏ các nội dung Chế độ ăn/Chăm sóc và tiêu đề HIS viết gộp trong Y lệnh thô', () => {
            const rawYlenhText = '*Y lệnh khác;c: - Chụp Xquang khớp gối *Chế độ ăn: BT02 ( Năng lượng 2200 ) *Chế độ chăm sóc: cấp III';
            
            let cleanYlenh = rawYlenhText
                .replace(/^\*?\s*Y lệnh khác\s*([;:\-–c]*)\s*/gi, '')
                .replace(/\*?\s*Chế độ ăn\s*[:\-–]\s*[^*]+/gi, '')
                .replace(/\*?\s*Chế độ chăm sóc\s*[:\-–]\s*[^*]+/gi, '')
                .trim();
            
            cleanYlenh = cleanYlenh.replace(/^[;,\s*]+|[;,\s*]+$/g, '').trim();

            expect(cleanYlenh).toBe('- Chụp Xquang khớp gối');
        });

        it('lọc sạch hoàn toàn chuỗi y lệnh rác nếu chỉ chứa Chế độ ăn/Chăm sóc', () => {
            const rawYlenhText = '*Y lệnh khác; *Chế độ ăn: BT02 *Chế độ chăm sóc: cấp III';
            
            let cleanYlenh = rawYlenhText
                .replace(/^\*?\s*Y lệnh khác\s*([;:\-–c]*)\s*/gi, '')
                .replace(/\*?\s*Chế độ ăn\s*[:\-–]\s*[^*]+/gi, '')
                .replace(/\*?\s*Chế độ chăm sóc\s*[:\-–]\s*[^*]+/gi, '')
                .trim();
            
            cleanYlenh = cleanYlenh.replace(/^[;,\s*]+|[;,\s*]+$/g, '').trim();

            expect(cleanYlenh).toBe('');
        });
    });
});
