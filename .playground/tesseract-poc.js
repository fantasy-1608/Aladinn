import { createWorker } from 'tesseract.js';

/**
 * Kịch bản thử nghiệm Local OCR (Tesseract.js)
 * Sẽ tải tự động ngôn ngữ tiếng Việt (vie) trong lần chạy đầu tiên.
 */

async function runLocalOCR() {
  console.log('🚀 Bắt đầu khởi tạo máy quét hình ảnh ngoại tuyến (Tesseract)...');
  
  try {
    const worker = await createWorker('vie');
    
    // Lưu ý: Thay đổi đường dẫn tới ảnh kết quả xét nghiệm mẫu của bạn
    const testImageUrl = 'https://tesseract.projectnaptha.com/img/eng_bw.png'; // Ảnh mẫu tạm thời
    
    console.log(`📸 Đang phân tích hình ảnh: ${testImageUrl}`);
    const { data: { text } } = await worker.recognize(testImageUrl);
    
    console.log('\n✅ Kết quả quét văn bản:\n');
    console.log(text);
    
    await worker.terminate();
  } catch (error) {
    console.error('❌ Lỗi quét văn bản:', error.message);
  }
}

runLocalOCR();
