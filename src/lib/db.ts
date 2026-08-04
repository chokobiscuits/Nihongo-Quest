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

function getClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazily constructed. Building the client at module scope meant that merely
 * importing this file threw when DATABASE_URL was absent, which broke
 * `next build`: page-data collection imports every route, including ones that
 * never query. The proxy defers connecting until the first property access,
 * so a build with no database env still succeeds and only a real query fails.
 */
export const prisma = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
