import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import path from "path";
import fs from "fs";
import os from "os";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { unitId } = await req.json();

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const unit = await prisma.unit.findFirst({ where: { id: unitId, userId: user.id } });
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  const photos: string[] = JSON.parse(unit.photos);
  if (!photos.length) return NextResponse.json({ error: "No photos to make video from" }, { status: 400 });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rently-"));

  try {
    // Download photos to tmp
    const localPaths: string[] = [];
    for (let i = 0; i < Math.min(photos.length, 20); i++) {
      const response = await fetch(photos[i]);
      const buffer = Buffer.from(await response.arrayBuffer());
      const localPath = path.join(tmpDir, `photo_${String(i).padStart(3, "0")}.jpg`);
      fs.writeFileSync(localPath, buffer);
      localPaths.push(localPath);
    }

    // Write ffmpeg input file list
    const listFile = path.join(tmpDir, "inputs.txt");
    const listContent = localPaths.map((p) => `file '${p}'\nduration 3`).join("\n") + `\nfile '${localPaths[localPaths.length - 1]}'`;
    fs.writeFileSync(listFile, listContent);

    const outputPath = path.join(tmpDir, "output.mp4");

    // Run ffmpeg to create slideshow
    const { execSync } = await import("child_process");
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${listFile}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=25" -c:v libx264 -preset fast -crf 23 -t 60 "${outputPath}"`,
      { stdio: "pipe" }
    );

    if (!fs.existsSync(outputPath)) {
      return NextResponse.json({ error: "FFmpeg not available on this server. Please install FFmpeg to enable video generation." }, { status: 500 });
    }

    const videoBuffer = fs.readFileSync(outputPath);
    const blob = await put(`${userId}/videos/${unitId}-${Date.now()}.mp4`, videoBuffer, {
      access: "public",
      contentType: "video/mp4",
    });

    await prisma.unit.update({ where: { id: unitId }, data: { videoUrl: blob.url } });

    return NextResponse.json({ videoUrl: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("ffmpeg") || message.includes("ENOENT")) {
      return NextResponse.json({ error: "FFmpeg is not installed on this server. Video generation requires FFmpeg." }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
