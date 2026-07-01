/**
 * RAG 引擎 — 文档分块 + 智谱 Embedding + 向量搜索
 *
 * 架构：
 *  文件系统 → 分块(Chunk) → Embedding API(智谱) → 内存向量库 → 余弦相似度搜索
 *
 * 用法：
 *   import { RAGEngine } from './rag-engine.js';
 *   const rag = new RAGEngine(apiKey);
 *   await rag.indexPath('./docs');
 *   const results = await rag.search('你的问题', 5);
 */

import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

/** 分块大小（字符数），约 500 个中文字符 */
const CHUNK_SIZE = 800;
/** 分块重叠（字符数），防止语义断裂 */
const CHUNK_OVERLAP = 100;

export class RAGEngine {
  /** chunkId → { text, embedding, source, chunkIndex } */
  #chunks = new Map();

  /** API Key */
  #apiKey;

  /** 索引的根路径（用于展示） */
  #rootPath = '';

  constructor(apiKey) {
    this.#apiKey = apiKey;
  }

  // ========== 公开方法 ==========

  /** 索引指定路径下的所有文本文件 */
  async indexPath(rootPath, pattern = '**/*.{md,txt,ts,tsx,js,jsx,json,css,html}') {
    this.#rootPath = rootPath;
    const files = await glob(pattern, {
      cwd: rootPath,
      ignore: ['node_modules/**', 'dist/**', '.git/**', '*.db'],
      nodir: true,
    });

    console.log(`🔍 找到 ${files.length} 个文件待索引`);

    const allChunks = [];
    for (const file of files) {
      const fullPath = path.join(rootPath, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.trim().length < 10) continue; // 跳过空文件
        const chunks = this.#chunkText(content, file);
        allChunks.push(...chunks);
      } catch (err) {
        console.warn(`⚠️ 跳过文件 ${file}: ${err.message}`);
      }
    }

    console.log(`📝 分块完成：${allChunks.length} 个文本块`);

    // 批量获取 Embedding（每批 16 个，避免 API 限流）
    const BATCH_SIZE = 16;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.text);
      const embeddings = await this.#getEmbeddings(texts);

      for (let j = 0; j < batch.length; j++) {
        this.#chunks.set(batch[j].id, {
          text: batch[j].text,
          embedding: embeddings[j],
          source: batch[j].source,
          chunkIndex: batch[j].chunkIndex,
        });
      }

      const pct = Math.min(100, Math.round(((i + BATCH_SIZE) / allChunks.length) * 100));
      console.log(`🧮 Embedding 进度: ${pct}% (${Math.min(i + BATCH_SIZE, allChunks.length)}/${allChunks.length})`);
    }

    console.log(`✅ 索引完成：${this.#chunks.size} 个向量已入库`);
    return { files: files.length, chunks: this.#chunks.size };
  }

  /** 搜索最相关的文档片段 */
  async search(query, topK = 5) {
    if (this.#chunks.size === 0) {
      return { query, results: [], message: '索引为空，请先运行 rag_index_path 索引文件' };
    }

    // 获取查询的 Embedding
    const [queryEmbedding] = await this.#getEmbeddings([query]);

    // 计算余弦相似度
    const scored = [];
    for (const [id, chunk] of this.#chunks) {
      const similarity = this.#cosineSimilarity(queryEmbedding, chunk.embedding);
      scored.push({ id, ...chunk, score: similarity });
    }

    // 排序取 TopK
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK).map(({ embedding, ...rest }) => rest);

    return {
      query,
      totalChunks: this.#chunks.size,
      results: top,
    };
  }

  /** 列出已索引的文件 */
  listIndexed() {
    const sources = new Set();
    for (const [, chunk] of this.#chunks) {
      sources.add(chunk.source);
    }
    return {
      rootPath: this.#rootPath,
      totalChunks: this.#chunks.size,
      files: Array.from(sources).sort(),
    };
  }

  /** 清空索引 */
  clear() {
    const count = this.#chunks.size;
    this.#chunks.clear();
    return { cleared: count };
  }

  // ========== 内部方法 ==========

  /** 将文本切分为重叠的块 */
  #chunkText(text, source) {
    const chunks = [];
    let index = 0;
    let start = 0;

    while (start < text.length) {
      let end = start + CHUNK_SIZE;
      if (end < text.length) {
        // 尝试在换行符处断开，避免切断句子
        const searchEnd = Math.min(end + 200, text.length);
        const breakPoint = text.lastIndexOf('\n', searchEnd);
        if (breakPoint > start + CHUNK_SIZE / 2) {
          end = breakPoint;
        }
      }

      const chunkText = text.slice(start, Math.min(end, text.length)).trim();
      if (chunkText.length > 0) {
        chunks.push({
          id: `${source}#${index}`,
          text: chunkText,
          source,
          chunkIndex: index,
        });
        index++;
      }

      start = end - CHUNK_OVERLAP;
      if (start >= text.length) break;
      // 防止死循环
      if (start <= 0 && index > 0) start = text.length;
    }

    return chunks;
  }

  /** 调用智谱 Embedding API */
  async #getEmbeddings(texts) {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.#apiKey}`,
      },
      body: JSON.stringify({
        model: 'embedding-2',
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API 失败: ${response.status}`);
    }

    const data = await response.json();
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  /** 余弦相似度 */
  #cosineSimilarity(a, b) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
