import { embed, embedMany } from "ai";
import { ollama } from "ai-sdk-ollama";

export async function generateEmbedding(text: string) {
  const input = text.replace("/n", " ");

  const { embedding } = await embed({
    model: ollama.embedding("nomic-embed-text"),
    value: input,
  });

  return embedding;
}

export async function generateEmbeddings(texts: string[]) {
  const inputs = texts.map((text) => text.replace("/n", " "));

  const { embeddings } = await embedMany({
    model: ollama.embedding("nomic-embed-text"),
    values: inputs,
  });

  return embeddings;
}
