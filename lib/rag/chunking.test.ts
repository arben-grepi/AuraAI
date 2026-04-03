import {
  resetEmbeddingTokenizerCacheForTests,
} from "@/lib/rag/embedding-tokenizer";
import { chunkContentWithOffsets } from "@/lib/rag/chunking";

describe("chunkContentWithOffsets (char fallback)", () => {
  beforeEach(() => {
    process.env.AURA_DISABLE_EMBEDDING_TOKENIZER = "1";
    resetEmbeddingTokenizerCacheForTests();
  });

  it("returns one chunk for short prose", async () => {
    const chunks = await chunkContentWithOffsets(
      "Hello world. This is a second sentence.",
    );
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].text).toContain("Hello");
    expect(chunks[0].startOffset).toBeGreaterThanOrEqual(0);
    expect(chunks[0].endOffset).toBeGreaterThan(chunks[0].startOffset);
  });

  it("splits very long segments without sentence boundaries", async () => {
    const long = "x".repeat(4000);
    const chunks = await chunkContentWithOffsets(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(1500);
    }
  });

  it("handles Finnish-style compounds and dense text without throwing", async () => {
    const text =
      "Talousarvioesitys vuodelle 2025. " +
      "Rakennemuutos".repeat(80) +
      ". Seuraava kappale alkaa tästä.";
    const chunks = await chunkContentWithOffsets(text);
    expect(chunks.length).toBeGreaterThan(0);
    const joined = chunks.map((c) => c.text).join(" ");
    expect(joined.length).toBeGreaterThan(100);
  });
});
