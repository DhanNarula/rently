import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// SQLite is file-based so a fresh client per module load is safe and avoids
// stale singleton issues during Turbopack hot reload.
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:prisma/dev.db" });
export const prisma = new PrismaClient({ adapter });
