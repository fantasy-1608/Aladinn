/**
 * 🧞 Aladinn v2 — RAG Pipeline (Zero-Dependency Version)
 * 
 * Sử dụng MiniSearch (TF-IDF) thay cho Orama.
 * Không cần npm install — chạy ngay trên Node.js hoặc trình duyệt.
 */

import { MiniSearch } from './mini-search.js';

/**
 * Tạo mới một RAG database.
 * @returns {MiniSearch}
 */
export function createProtocolDB() {
  return new MiniSearch();
}

/**
 * Chia văn bản dài thành chunks có overlap.
 */
export function chunkText(text, chunkSize = 600, overlap = 100) {
  if (!text || text.length <= chunkSize) return [text].filter(Boolean);
  
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const bestBreak = Math.max(lastPeriod, lastNewline);
      if (bestBreak > start + chunkSize * 0.5) {
        end = bestBreak + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks.filter(c => c.length > 20);
}

/**
 * Tách văn bản theo heading markdown.
 */
function splitBySections(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentHeading = '';
  let currentContent = [];
  
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
  }
  return sections.length > 0 ? sections : [{ heading: '', content: text }];
}

/**
 * Nạp phác đồ vào database.
 */
export function ingestProtocol(db, protocol) {
  const { title, content, source = '', icd_codes = '', department = '' } = protocol;
  if (!content || !title) throw new Error('[RAG] Phác đồ phải có title và content');
  
  const sections = splitBySections(content);
  let totalChunks = 0;
  
  for (const section of sections) {
    const chunks = chunkText(section.content);
    for (let i = 0; i < chunks.length; i++) {
      db.add({
        title,
        section: section.heading || title,
        content: chunks[i],
        source,
        icd_codes,
        department,
        chunk_index: totalChunks + i
      });
      totalChunks++;
    }
  }
  return totalChunks;
}

/**
 * Tra cứu phác đồ.
 */
export function queryProtocol(db, query, options = {}) {
  const { limit = 5 } = options;
  const results = db.search(query, limit);
  return results.map(hit => ({
    title: hit.document.title,
    section: hit.document.section,
    content: hit.document.content,
    source: hit.document.source,
    icd_codes: hit.document.icd_codes,
    score: hit.score,
    chunk_index: hit.document.chunk_index
  }));
}

/**
 * Xây dựng prompt cho LLM với RAG context.
 */
export function buildRAGPrompt(question, ragResults) {
  if (!ragResults || ragResults.length === 0) {
    return `Câu hỏi: ${question}\n\nLưu ý: Không tìm thấy phác đồ nội bộ liên quan.`;
  }
  const contextBlocks = ragResults
    .map((r, i) => `[Nguồn ${i + 1}: ${r.title} — ${r.section}]\n${r.content}`)
    .join('\n\n---\n\n');
  
  return `Dựa trên các phác đồ điều trị nội bộ bệnh viện sau đây, hãy trả lời câu hỏi của bác sĩ.

== PHÁC ĐỒ NỘI BỘ ==
${contextBlocks}

== CÂU HỎI ==
${question}

== QUY TẮC ==
- Ưu tiên thông tin từ phác đồ nội bộ trên
- Nếu phác đồ không đề cập, ghi rõ "Phác đồ nội bộ không đề cập, tham khảo: ..."
- Ghi rõ nguồn [Nguồn X] khi trích dẫn
- Trả lời bằng tiếng Việt, ngắn gọn, chuyên nghiệp`;
}

/**
 * Thống kê DB.
 */
export function getDBStats(db) {
  return { totalChunks: db.count() };
}
