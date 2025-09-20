import { PrismaClient } from "../app/generated/prisma";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Ensure connection is established once
if (!globalForPrisma.prisma) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$connect().catch((error: any) => {
    console.error("Failed to connect to database:", error);
  });
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
