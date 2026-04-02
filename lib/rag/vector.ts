// Ollama nomic-embed-text produces 768-dimensional vectors.
// All embeddings in the DB use this single dimension.
const VECTOR_DIMENSION = 768;

export function getExpectedVectorDimension(): number {
  return VECTOR_DIMENSION;
}

/** @deprecated Use getExpectedVectorDimension() */
export const EXPECTED_VECTOR_DIMENSION = 768;

export function validateVector(vec: number[]): void {
  if (!Array.isArray(vec)) {
    throw new Error("Vector must be an array");
  }
  if (vec.length !== VECTOR_DIMENSION) {
    throw new Error(
      `Vector dimension mismatch: expected ${VECTOR_DIMENSION} (nomic-embed-text), got ${vec.length}. ` +
      `Ensure all documents are embedded with the configured Ollama embedding model.`,
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
