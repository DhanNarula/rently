import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { existsSync, copyFileSync } from "fs";
import path from "path";

function getDbUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  // Use a remote libsql/Turso URL directly if provided
  if (envUrl && !envUrl.startsWith("file:")) return envUrl;

  if (process.env.VERCEL) {
    // Vercel's Lambda root is read-only; copy schema'd file to writable /tmp
    const tmpPath = "/tmp/rently.db";
    if (!existsSync(tmpPath)) {
      const bundled = path.join(process.cwd(), "prisma", "dev.db");
      if (existsSync(bundled)) copyFileSync(bundled, tmpPath);
    }
    return `file:${tmpPath}`;
  }

  return envUrl ?? "file:prisma/dev.db";
}

const adapter = new PrismaLibSql({ url: getDbUrl() });
export const prisma = new PrismaClient({ adapter });
