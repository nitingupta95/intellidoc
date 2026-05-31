import { getEncoding } from 'js-tiktoken';

const tokenizer = getEncoding('cl100k_base');

export interface TextChunk {
  text: string;
  pageNum: number;
  chunkIdx: number;
  tokenCount: number;
}

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

export class RecursiveCharacterTextSplitter {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];

  constructor(
    chunkSize: number = 512,
    chunkOverlap: number = 64,
    separators: string[] = DEFAULT_SEPARATORS
  ) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.separators = separators;
  }

  private countTokens(text: string): number {
    return tokenizer.encode(text).length;
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];
    let separator = separators[0] || "";
    let newSeparators = separators;

    for (const sep of separators) {
      if (sep === "") {
        separator = sep;
        break;
      }
      if (text.includes(sep)) {
        separator = sep;
        newSeparators = separators.slice(separators.indexOf(sep) + 1);
        break;
      }
    }

    const splits = separator ? text.split(separator) : [text];

    let currentChunk = "";

    for (const split of splits) {
      const splitWithSep = currentChunk ? separator + split : split;
      if (this.countTokens(currentChunk + splitWithSep) <= this.chunkSize) {
        currentChunk += splitWithSep;
      } else {
        if (currentChunk) {
          finalChunks.push(currentChunk);
        }
        
        // If the current single split is still larger than chunk size, recurse on it
        if (this.countTokens(split) > this.chunkSize) {
          if (newSeparators.length > 0) {
            finalChunks.push(...this.splitTextRecursive(split, newSeparators));
          } else {
            // No more separators, hard slice by characters (approximate)
            // Just push it for now, or chunk it forcefully
            const encoded = tokenizer.encode(split);
            for (let i = 0; i < encoded.length; i += this.chunkSize) {
              const slice = encoded.slice(i, i + this.chunkSize);
              finalChunks.push(tokenizer.decode(slice));
            }
          }
          currentChunk = "";
        } else {
          currentChunk = split;
        }
      }
    }

    if (currentChunk) {
      finalChunks.push(currentChunk);
    }

    return finalChunks;
  }

  private addOverlap(chunks: string[]): string[] {
    if (this.chunkOverlap <= 0 || chunks.length < 2) return chunks;

    const overlappedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let current = chunks[i];
      if (i > 0) {
        // Find overlap from the previous chunk
        const prev = chunks[i - 1];
        const prevTokens = tokenizer.encode(prev);
        const overlapTokens = prevTokens.slice(-this.chunkOverlap);
        const overlapText = tokenizer.decode(overlapTokens);
        current = overlapText + current;
      }
      overlappedChunks.push(current);
    }
    return overlappedChunks;
  }

  public split(text: string, pageNum: number, startChunkIdx: number = 0): TextChunk[] {
    const rawChunks = this.splitTextRecursive(text, this.separators);
    const overlapped = this.addOverlap(rawChunks);
    
    // Validate final token counts
    return overlapped.map((c, i) => {
      let finalStr = c;
      let tkCount = this.countTokens(finalStr);
      
      // Strict hard limit if overlap pushed it over
      if (tkCount > this.chunkSize + this.chunkOverlap) {
        const tks = tokenizer.encode(finalStr);
        finalStr = tokenizer.decode(tks.slice(0, this.chunkSize));
        tkCount = this.countTokens(finalStr);
      }

      return {
        text: finalStr,
        pageNum,
        chunkIdx: startChunkIdx + i,
        tokenCount: tkCount,
      };
    });
  }
}
