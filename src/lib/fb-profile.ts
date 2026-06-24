import path from "path";
import os from "os";
import fs from "fs";

export function getProfileDir(clerkId: string): string {
  const dir = path.join(os.homedir(), ".rently", "fb-profiles", clerkId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
