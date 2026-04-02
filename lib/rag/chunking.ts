/**
 * Sentence-aware text chunking with character offset tracking.
 *
 * Chunks are built by grouping sentences up to TARGET_CHUNK_CHARS,
 * with OVERLAP_SENTENCES sentence overlap between consecutive chunks.
 * Each chunk records its start/end character offsets in the original text
 * so we can highlight the exact passage in the source panel later.
 */

const TARGET_CHUNK_CHARS = 1200; // ~600 tokens for nomic-embed-text (2 048-token BERT context)
const OVERLAP_SENTENCES = 2;

// Hard safety cap for nomic-embed-text (nomic-bert architecture).
// Although Ollama reports num_ctx=8192, the underlying BERT model has a TRUE
// context of 2 048 tokens. BERT's WordPiece tokeniser is much denser than GPT
// BPE: Finnish compound words and financial tables can reach ~2 chars/token.
// 1 500 chars ÷ 2 chars/token = 750 tokens — well under 2 048 in all cases.
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

/**
 * Break a single long text segment into sub-segments at word boundaries so
 * each sub-segment is at most MAX_CHUNK_CHARS characters.  This prevents a
 * single "sentence" (e.g. an entire table row or a bullet list) from
 * producing an embedding chunk that exceeds the model's context window.
 */
function splitLongSegment(
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
    // Back up to the last space so we don't cut mid-word (unless no space found)
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
    pos = end + 1; // +1 to skip the space we split on
  }

  return parts;
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
      // A single "sentence" from a table/list can be huge; split it to stay
      // within the embedding model's context window.
      sentences.push(...splitLongSegment(sentenceText, lastIndex));
    }
    // Skip whitespace between sentences
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after the last split point
  const remaining = text.slice(lastIndex).trim();
  if (remaining) {
    sentences.push(...splitLongSegment(remaining, lastIndex));
  }

  // Fallback: if no sentence boundaries found, treat whole text as one sentence
  if (sentences.length === 0 && text.trim()) {
    sentences.push(...splitLongSegment(text.trim(), 0));
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
