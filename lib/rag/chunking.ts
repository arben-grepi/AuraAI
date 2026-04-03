/**
 * Sentence-aware text chunking with character offset tracking.
 *
 * When an embedding tokenizer is available (Transformers.js, matching
 * `OLLAMA_EMBEDDING_MODEL`), chunks are sized by **token** counts up to the
 * model context minus a safety margin — so we use the full context window
 * without exceeding it. If the tokenizer cannot load, we fall back to the
 * previous character-based limits.
 */

import type { PreTrainedTokenizer } from "@xenova/transformers";
import { logOps } from "@/lib/ops-log";
import {
  countEmbeddingTokens,
  getHfTokenizerModelId,
  loadEmbeddingTokenizer,
  resolveMaxChunkTokens,
  resolveTargetChunkTokens,
} from "./embedding-tokenizer";

/** Fallback when tokenizer is unavailable (tests, CI, load failure). */
const TARGET_CHUNK_CHARS = 1200;
const OVERLAP_SENTENCES = 2;
const MAX_CHUNK_CHARS = 1500;

export interface ChunkWithOffset {
  text: string;
  startOffset: number;
  endOffset: number;
  index: number;
}

interface SentenceWithOffset {
  text: string;
  start: number;
  end: number;
}

function splitLongSegmentChars(
  text: string,
  startOffset: number,
): SentenceWithOffset[] {
  if (text.length <= MAX_CHUNK_CHARS) {
    return [{ text, start: startOffset, end: startOffset + text.length }];
  }

  const parts: SentenceWithOffset[] = [];
  let pos = 0;

  while (pos < text.length) {
    let end = Math.min(pos + MAX_CHUNK_CHARS, text.length);
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > pos) end = lastSpace;
    }
    const segment = text.slice(pos, end).trim();
    if (segment) {
      parts.push({
        text: segment,
        start: startOffset + pos,
        end: startOffset + end,
      });
    }
    pos = end + 1;
  }

  return parts;
}

/**
 * Largest `end` in [0, text.length] such that the tokenizer assigns
 * at most `maxTokens` tokens to `text.slice(0, end)` (monotonic in `end`).
 */
async function maxPrefixCharsWithinTokenBudget(
  text: string,
  maxTokens: number,
  tokenizer: PreTrainedTokenizer,
): Promise<number> {
  if (text.length === 0) return 0;
  if ((await countEmbeddingTokens(tokenizer, text)) <= maxTokens) {
    return text.length;
  }

  let lo = 0;
  let hi = text.length;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const n = await countEmbeddingTokens(tokenizer, text.slice(0, mid));
    if (n <= maxTokens) lo = mid;
    else hi = mid;
  }
  return lo;
}

function snapPrefixToWordBoundary(text: string, end: number): number {
  if (end <= 0 || end >= text.length) return end;
  const lastSpace = text.lastIndexOf(" ", end);
  return lastSpace > 0 ? lastSpace : end;
}

async function splitLongSegmentTokens(
  text: string,
  startOffset: number,
  tokenizer: PreTrainedTokenizer,
  maxTokens: number,
): Promise<SentenceWithOffset[]> {
  if ((await countEmbeddingTokens(tokenizer, text)) <= maxTokens) {
    return [{ text, start: startOffset, end: startOffset + text.length }];
  }

  const parts: SentenceWithOffset[] = [];
  let pos = 0;

  while (pos < text.length) {
    const rest = text.slice(pos);
    let takeChars = await maxPrefixCharsWithinTokenBudget(
      rest,
      maxTokens,
      tokenizer,
    );
    if (takeChars === 0) {
      takeChars = 1;
    } else if (takeChars < rest.length) {
      const snapped = snapPrefixToWordBoundary(rest, takeChars);
      if (snapped > 0) {
        const snappedText = rest.slice(0, snapped).trimEnd();
        if (
          snappedText.length > 0 &&
          (await countEmbeddingTokens(tokenizer, snappedText)) <= maxTokens
        ) {
          takeChars = snapped;
        }
      }
    }

    const rawSlice = rest.slice(0, takeChars);
    const segment = rawSlice.trim();
    if (segment) {
      const trimLead = rawSlice.length - rawSlice.trimStart().length;
      const segStart = startOffset + pos + trimLead;
      parts.push({
        text: segment,
        start: segStart,
        end: segStart + segment.length,
      });
    }
    pos += takeChars;
    while (pos < text.length && /\s/.test(text[pos]!)) pos++;
  }

  return parts.length > 0 ? parts : splitLongSegmentChars(text, startOffset);
}

async function splitSentencesWithOffsets(
  text: string,
  tokenizer: PreTrainedTokenizer | null,
  maxSegmentTokens: number | null,
): Promise<SentenceWithOffset[]> {
  const splitPattern =
    /([.!?]+)\s+(?=[A-Z\u00C0-\u024F"'\u201C\u201D(])/g;

  const sentences: SentenceWithOffset[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const splitSeg = async (
    sentenceText: string,
    absStart: number,
  ): Promise<void> => {
    if (!sentenceText) return;
    if (tokenizer && maxSegmentTokens != null) {
      sentences.push(
        ...(await splitLongSegmentTokens(
          sentenceText,
          absStart,
          tokenizer,
          maxSegmentTokens,
        )),
      );
    } else {
      sentences.push(...splitLongSegmentChars(sentenceText, absStart));
    }
  };

  while ((match = splitPattern.exec(text)) !== null) {
    const endIndex = match.index + match[1].length;
    const sentenceText = text.slice(lastIndex, endIndex).trim();
    if (sentenceText) {
      await splitSeg(sentenceText, lastIndex);
    }
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    await splitSeg(remaining, lastIndex);
  }

  if (sentences.length === 0 && text.trim()) {
    await splitSeg(text.trim(), 0);
  }

  return sentences;
}

function buildChunk(
  sentences: SentenceWithOffset[],
  index: number,
): ChunkWithOffset {
  return {
    text: sentences.map((s) => s.text).join(" "),
    startOffset: sentences[0].start,
    endOffset: sentences[sentences.length - 1].end,
    index,
  };
}

/** One structured line per chunking run — grep for `rag.chunking.complete`. No document text. */
function logChunkingComplete(
  inputCharCount: number,
  tokenizer: PreTrainedTokenizer | null,
  maxSegmentTokens: number | null,
  targetGroupTokens: number | null,
  chunkCount: number,
): void {
  if (tokenizer && maxSegmentTokens != null && targetGroupTokens != null) {
    logOps("rag.chunking.complete", {
      chunkingMode: "tokenizer",
      hfTokenizerId: getHfTokenizerModelId(),
      maxChunkTokens: maxSegmentTokens,
      targetChunkTokens: targetGroupTokens,
      chunkCount,
      inputChars: inputCharCount,
    });
  } else {
    logOps("rag.chunking.complete", {
      chunkingMode: "chars_fallback",
      chunkCount,
      inputChars: inputCharCount,
    });
  }
}

/**
 * Chunk text into sentence-grouped segments with offset tracking.
 * Uses tokenizer-based limits when available; otherwise character caps.
 */
export async function chunkContentWithOffsets(
  fullText: string,
): Promise<ChunkWithOffset[]> {
  const tokenizer = await loadEmbeddingTokenizer();
  const maxSegmentTokens = tokenizer
    ? resolveMaxChunkTokens(tokenizer)
    : null;
  const targetGroupTokens =
    tokenizer && maxSegmentTokens != null
      ? resolveTargetChunkTokens(maxSegmentTokens)
      : null;

  const sentences = await splitSentencesWithOffsets(
    fullText,
    tokenizer,
    maxSegmentTokens,
  );

  if (sentences.length === 0) {
    logChunkingComplete(
      fullText.length,
      tokenizer,
      maxSegmentTokens,
      targetGroupTokens,
      0,
    );
    return [];
  }

  const chunks: ChunkWithOffset[] = [];
  let windowStart = 0;
  let chunkIndex = 0;

  while (windowStart < sentences.length) {
    if (tokenizer && targetGroupTokens != null) {
      let windowEnd = windowStart;
      let joined = "";

      while (windowEnd < sentences.length) {
        const next = sentences[windowEnd].text;
        const candidate = joined ? `${joined} ${next}` : next;
        const tok = await countEmbeddingTokens(tokenizer, candidate);
        if (tok > targetGroupTokens && windowEnd > windowStart) break;
        joined = candidate;
        windowEnd++;
      }

      if (windowEnd === windowStart) {
        windowEnd = windowStart + 1;
      }

      chunks.push(
        buildChunk(sentences.slice(windowStart, windowEnd), chunkIndex++),
      );

      const advance = windowEnd - windowStart - OVERLAP_SENTENCES;
      windowStart += Math.max(advance, 1);
    } else {
      let windowEnd = windowStart;
      let currentLength = 0;

      while (windowEnd < sentences.length) {
        const sentLen = sentences[windowEnd].text.length;
        if (
          currentLength + sentLen > TARGET_CHUNK_CHARS &&
          windowEnd > windowStart
        ) {
          break;
        }
        currentLength += sentLen + 1;
        windowEnd++;
      }

      chunks.push(
        buildChunk(sentences.slice(windowStart, windowEnd), chunkIndex++),
      );

      const advance = windowEnd - windowStart - OVERLAP_SENTENCES;
      windowStart += Math.max(advance, 1);
    }
  }

  logChunkingComplete(
    fullText.length,
    tokenizer,
    maxSegmentTokens,
    targetGroupTokens,
    chunks.length,
  );

  return chunks;
}

/**
 * Backwards-compatible wrapper — returns just the text strings.
 */
export async function chunkContent(content: string): Promise<string[]> {
  const chunks = await chunkContentWithOffsets(content.trim());
  return chunks.map((c) => c.text);
}
