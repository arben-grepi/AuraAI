import { PrismaClient } from "../app/generated/prisma";

type GlobalWithPrisma = typeof globalThis & {
  prisma?: PrismaClient;
  __PRISMA_LOG_BOUND__?: boolean;
};

const g = globalThis as GlobalWithPrisma;

export const prisma =
  g.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log:
      process.env.NODE_ENV === "development"
        ? [
          { level: "warn", emit: "stdout" },
          { level: "error", emit: "stdout" },
        ]
        : [
          { level: "warn", emit: "stdout" },
          { level: "error", emit: "stdout" },
        ],
  });

if (process.env.NODE_ENV === "development" && !g.__PRISMA_LOG_BOUND__) {
  const minMs = Number(process.env.PRISMA_QUERY_MIN_MS ?? 5); // only show slow-ish queries
  prisma.$on(
    "query" as unknown as never,
    (e: { duration: number; query: string; params: string }) => {
      if (
        typeof e.query === "string" &&
        e.query.trim().toUpperCase() === "SELECT 1"
      )
        return;
      if (typeof e.duration === "number" && e.duration < minMs) return;

      console.log("\n----------------------");
      console.log(`🕒 Duration: ${e.duration}ms`);
      console.log(`📝 Query:\n${e.query}`);
      console.log(`🔢 Params: ${e.params}`);
      console.log("----------------------\n");
    },
  );
  g.__PRISMA_LOG_BOUND__ = true;
}

if (!g.prisma) {
  prisma.$connect().catch((err: unknown) => {
    console.error("Failed to connect to database:", err);
  });
}

if (process.env.NODE_ENV !== "production") {
  g.prisma = prisma;
}

export default prisma;
