import { getEncoding } from 'js-tiktoken';
import type { TextChunk } from './textSplitter';

const tokenizer = getEncoding('cl100k_base');

export type SupportedLanguage = 'typescript' | 'python' | 'javascript' | 'go' | 'rust';

const BOUNDARY_REGEX: Record<SupportedLanguage, RegExp> = {
  typescript: /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type)\s+[A-Za-z0-9_]+/m,
  javascript: /^(?:export\s+)?(?:async\s+)?(?:function|class)\s+[A-Za-z0-9_]+/m,
  python: /^def\s+[A-Za-z0-9_]+\s*\(|^class\s+[A-Za-z0-9_]+:/m,
  go: /^func\s+(?:\([A-Za-z0-9_\s*]+\)\s*)?[A-Za-z0-9_]+\s*\(/m,
  rust: /^(?:pub\s+)?(?:async\s+)?(?:fn|struct|enum|trait|impl)\s+[A-Za-z0-9_]+/m,
};

export class CodeSplitter {
  maxTokens: number;
  language: SupportedLanguage;

  constructor(language: SupportedLanguage, maxTokens: number = 700) {
    this.language = language;
    this.maxTokens = maxTokens;
  }

  private countTokens(text: string): number {
    return tokenizer.encode(text).length;
  }

  public split(text: string, filePath: string, startChunkIdx: number = 0): TextChunk[] {
    const regex = BOUNDARY_REGEX[this.language] || BOUNDARY_REGEX.javascript;
    
    // Split text by lines
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentBlock: string[] = [];

    for (const line of lines) {
      if (regex.test(line)) {
        if (currentBlock.length > 0) {
          chunks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
      }
      currentBlock.push(line);
    }
    
    if (currentBlock.length > 0) {
      chunks.push(currentBlock.join('\n'));
    }

    const finalChunks: TextChunk[] = [];
    let chunkIdx = startChunkIdx;
    
    for (const chunk of chunks) {
      const header = `// File: ${filePath} (${this.language})\n`;
      let content = chunk;
      let totalText = header + content;
      let tokenCount = this.countTokens(totalText);

      // If a single function/class is larger than our maxTokens, truncate it and note truncation
      if (tokenCount > this.maxTokens) {
        const tks = tokenizer.encode(totalText);
        // Reserve space for the note
        const truncationNote = "\n\n...[Content Truncated]...";
        const noteTokens = this.countTokens(truncationNote);
        const truncatedSlice = tks.slice(0, this.maxTokens - noteTokens);
        
        totalText = tokenizer.decode(truncatedSlice) + truncationNote;
        tokenCount = this.countTokens(totalText);
      }

      finalChunks.push({
        text: totalText,
        pageNum: 1, // Code doesn't have pages
        chunkIdx: chunkIdx++,
        tokenCount,
      });
    }

    return finalChunks;
  }
}
