/**
 * Kịch bản thử nghiệm Local LLM (Ollama)
 * Yêu cầu: Đã cài đặt Ollama (https://ollama.com) và chạy lệnh: `ollama run llama3`
 */

async function runLocalLLM() {
  console.log('🚀 Bắt đầu gửi yêu cầu tới Local LLM (Ollama)...');
  
  const rawClinicalText = `
    Bệnh nhân nam 45 tuổi, đau bụng hố chậu phải ngày thứ 2.
    Khám thấy ấn có phản ứng dội, sốt nhẹ 38 độ C.
    Bạch cầu tăng 12.000, Neutrophil 85%.
    Đề nghị: Siêu âm ổ bụng, theo dõi Viêm ruột thừa cấp.
  `;

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3', // Hoặc model y khoa bạn đã tải
        prompt: `Bạn là trợ lý bác sĩ. Hãy tóm tắt bệnh sử sau thành 3 gạch đầu dòng ngắn gọn:\n${rawClinicalText}`,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('\n✅ Kết quả từ Local LLM:\n');
    console.log(data.response);

  } catch (error) {
    console.error('❌ Lỗi kết nối Ollama:', error.message);
    console.log('💡 Mẹo: Hãy chắc chắn Ollama đang chạy ở port 11434');
  }
}

runLocalLLM();
