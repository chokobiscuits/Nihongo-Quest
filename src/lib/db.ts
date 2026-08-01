import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 takes a driver adapter rather than a connection URL. We point it at
 * the pooled (pgbouncer) Supabase connection; migrations use DIRECT_URL via
 * prisma.config.ts instead, since pgbouncer cannot run them.
 *
 * Single-user app: no per-request auth context, no RLS, no schema-per-tenant
 * concerns. This is intentionally simpler than a multi-tenant setup.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
