/**
 * Sentence-aware text chunking with character offset tracking.
 *
 * Chunks are built by grouping sentences up to TARGET_CHUNK_CHARS,
 * with OVERLAP_SENTENCES sentence overlap between consecutive chunks.
 * Each chunk records its start/end character offsets in the original text
 * so we can highlight the exact passage in the source panel later.
 */

const TARGET_CHUNK_CHARS = 2000; // ~500 tokens for nomic-embed-text
const OVERLAP_SENTENCES = 2;

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

/**
 * Split text into sentences, preserving character offsets.
 * Handles: ". ", "! ", "? " followed by uppercase, quote, or parenthesis.
 * Keeps the terminator with the sentence it ends.
 */
function splitSentencesWithOffsets(text: string): SentenceWithOffset[] {
  // Match sentence-ending punctuation followed by whitespace and a new-sentence start
  const splitPattern =
    /([.!?]+)\s+(?=[A-Z\u00C0-\u024F"'\u201C\u201D(])/g;

  const sentences: SentenceWithOffset[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = splitPattern.exec(text)) !== null) {
    // Include the punctuation in the current sentence
    const endIndex = match.index + match[1].length;
    const sentenceText = text.slice(lastIndex, endIndex).trim();
    if (sentenceText) {
      sentences.push({
        text: sentenceText,
        start: lastIndex,
        end: endIndex,
      });
    }
    // Skip whitespace between sentences
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after the last split point
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    sentences.push({
      text: remaining,
      start: lastIndex,
      end: text.length,
    });
  }

  // Fallback: if no sentence boundaries found, treat whole text as one sentence
  if (sentences.length === 0 && text.trim()) {
    sentences.push({ text: text.trim(), start: 0, end: text.length });
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

/**
 * Chunk text into sentence-grouped segments with offset tracking.
 * Each chunk is ~TARGET_CHUNK_CHARS with OVERLAP_SENTENCES sentence overlap.
 */
export function chunkContentWithOffsets(fullText: string): ChunkWithOffset[] {
  const sentences = splitSentencesWithOffsets(fullText);

  if (sentences.length === 0) return [];

  const chunks: ChunkWithOffset[] = [];
  let windowStart = 0;
  let chunkIndex = 0;

  while (windowStart < sentences.length) {
    // Accumulate sentences until we exceed target size
    let windowEnd = windowStart;
    let currentLength = 0;

    while (windowEnd < sentences.length) {
      const sentLen = sentences[windowEnd].text.length;
      // Always include at least one sentence
      if (currentLength + sentLen > TARGET_CHUNK_CHARS && windowEnd > windowStart) {
        break;
      }
      currentLength += sentLen + 1; // +1 for space joining
      windowEnd++;
    }

    chunks.push(buildChunk(sentences.slice(windowStart, windowEnd), chunkIndex++));

    // Advance, overlapping by OVERLAP_SENTENCES
    const advance = windowEnd - windowStart - OVERLAP_SENTENCES;
    windowStart += Math.max(advance, 1); // always advance at least 1 sentence
  }

  return chunks;
}

/**
 * Backwards-compatible wrapper — returns just the text strings.
 * Use chunkContentWithOffsets() for new code.
 */
export async function chunkContent(content: string): Promise<string[]> {
  return chunkContentWithOffsets(content.trim()).map((c) => c.text);
}
