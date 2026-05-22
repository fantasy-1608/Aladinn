/**
 * 🧞 Aladinn v2 — Lightweight Text Search (Zero Dependencies)
 * 
 * Thay thế Orama bằng bộ tìm kiếm text tự viết.
 * Sử dụng TF-IDF đơn giản + cosine similarity.
 * Không cần cài đặt bất kỳ package nào.
 */

/**
 * Tokenize Vietnamese text (basic word splitting + normalization).
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/**
 * Simple in-memory document store with TF-IDF search.
 */
export class MiniSearch {
  constructor() {
    this.documents = [];
    this.idf = new Map();
  }

  /**
   * Add a document to the index.
   * @param {Object} doc - Document with arbitrary fields
   * @param {string[]} searchFields - Fields to index for search
   */
  add(doc, searchFields = ['content', 'title', 'section']) {
    const searchableText = searchFields
      .map(f => doc[f] || '')
      .join(' ');
    const tokens = tokenize(searchableText);
    const tf = new Map();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }
    // Normalize TF by document length
    for (const [key, val] of tf) {
      tf.set(key, val / tokens.length);
    }
    this.documents.push({ ...doc, _tokens: tokens, _tf: tf, _id: this.documents.length });
    this._rebuildIDF();
  }

  _rebuildIDF() {
    this.idf.clear();
    const N = this.documents.length;
    const docFreq = new Map();
    for (const doc of this.documents) {
      const uniqueTokens = new Set(doc._tokens);
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }
    for (const [token, df] of docFreq) {
      this.idf.set(token, Math.log(N / df));
    }
  }

  /**
   * Search documents by query text.
   * @param {string} query
   * @param {number} limit
   * @returns {Array<{document: Object, score: number}>}
   */
  search(query, limit = 5) {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores = [];
    for (const doc of this.documents) {
      let score = 0;
      for (const qt of queryTokens) {
        const tf = doc._tf.get(qt) || 0;
        const idf = this.idf.get(qt) || 0;
        score += tf * idf;
      }
      if (score > 0) {
        const { _tokens, _tf, _id, ...cleanDoc } = doc;
        scores.push({ document: cleanDoc, score });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  count() {
    return this.documents.length;
  }
}
