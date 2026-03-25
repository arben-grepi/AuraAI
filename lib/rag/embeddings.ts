import { embed, embedMany } from "ai";
import { getEmbeddingModel } from "@/lib/ai-provider";

const EMBED_BATCH_SIZE = 50;

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.replace(/\n/g, " ");
  const model = getEmbeddingModel();

  const { embedding } = await embed({ model, value: input });
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const inputs = texts.map((text) => text.replace(/\n/g, " "));
  const model = getEmbeddingModel();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < inputs.length; i += EMBED_BATCH_SIZE) {
    const batch = inputs.slice(i, i + EMBED_BATCH_SIZE);
    const { embeddings } = await embedMany({ model, values: batch });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
