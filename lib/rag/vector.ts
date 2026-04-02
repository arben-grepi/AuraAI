// Dimension is determined by the active embedding model:
//   openai (text-embedding-3-small) → 1 536
//   ollama (nomic-embed-text)       → 768
// ALL embeddings in the DB must use the same provider — mixing dimensions is not possible.
const DIMENSION_BY_PROVIDER: Record<string, number> = {
  openai: 1536,
  ollama: 768,
};

export function getExpectedVectorDimension(): number {
  const provider = process.env.AI_PROVIDER ?? "openai";
  return DIMENSION_BY_PROVIDER[provider] ?? 1536;
}

/** @deprecated Use getExpectedVectorDimension() */
export const EXPECTED_VECTOR_DIMENSION = 1536;

export function validateVector(vec: number[]): void {
  if (!Array.isArray(vec)) {
    throw new Error("Vector must be an array");
  }
  const expected = getExpectedVectorDimension();
  if (vec.length !== expected) {
    throw new Error(
      `Vector dimension mismatch: expected ${expected} (AI_PROVIDER=${process.env.AI_PROVIDER ?? "openai"}), got ${vec.length}. ` +
      `Check that your DB column matches the active embedding model, then re-index all documents.`,
    );
  }
  for (let i = 0; i < vec.length; i++) {
    const val = vec[i];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new Error(`Invalid vector value at index ${i}: ${val}`);
    }
  }
}

export function toPgVectorLiteral(vec: number[]): string {
  validateVector(vec);
  const sanitized = vec.map((v) => {
    if (!Number.isFinite(v)) {
      throw new Error(`Invalid vector value: ${v}`);
    }
    return v;
  });
  return `'[${sanitized.join(",")}]'::vector`;
}
