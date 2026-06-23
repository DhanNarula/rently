import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import path from "path";
import fs from "fs";
import os from "os";
import { execSync } from "child_process";
import sharp from "sharp";

const FPS = 25;
const W = 1920;
const H = 1080;
const PHOTO_DURATION = 5;   // seconds each photo holds
const FADE = 0.8;            // crossfade overlap in seconds

// Five alternating Ken Burns motions
function kenBurns(i: number, frames: number): string {
  const variants = [
    // Zoom in from center
    `zoompan=z='min(zoom+0.0010,1.35)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // Zoom out to center
    `zoompan=z='if(lte(zoom,1.0),1.35,max(1.001,zoom-0.0010))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // Pan left → right
    `zoompan=z='1.25':x='min(iw*(0.25/zoom)+iw*0.0018*on,iw*0.28/zoom)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // Pan right → left
    `zoompan=z='1.25':x='max(iw*(0.06/zoom),iw*(0.28/zoom)-iw*0.0018*on)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    // Slow zoom in from bottom-left
    `zoompan=z='min(zoom+0.0010,1.35)':x='max(0,iw/2-(iw/zoom/2)-iw*0.07)':y='max(0,ih/2-(ih/zoom/2)+ih*0.05)':d=${frames}:s=${W}x${H}:fps=${FPS}`,
  ];
  return variants[i % variants.length];
}

// Locate the ffmpeg binary — Next.js doesn't inherit the shell PATH
function findFfmpeg(): string {
  for (const p of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]) {
    if (fs.existsSync(p)) return p;
  }
  return "ffmpeg";
}

// Build a 1920×220 PNG with property info using SVG → sharp
async function buildOverlay(
  rent: number,
  bedrooms: number,
  bathrooms: number,
  address: string,
  city: string,
  province: string,
): Promise<Buffer> {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const priceText  = esc(`$${rent.toLocaleString()}/mo`);
  const bedsText   = esc(bedrooms === 0 ? `Studio · ${bathrooms} bath` : `${bedrooms} bed · ${bathrooms} bath`);
  const locText    = esc(`${address}, ${city}, ${province}`);

  const svgW = W;
  const svgH = 220;

  const svg = `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="${svgW}" height="${svgH}" fill="url(#g)"/>
  <text x="72" y="88"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="72" font-weight="700" fill="white" opacity="1">${priceText}</text>
  <text x="74" y="146"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="40" font-weight="500" fill="white" opacity="0.9">${bedsText}</text>
  <text x="74" y="193"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-size="28" font-weight="400" fill="white" opacity="0.75">${locText}</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { unitId } = await req.json();

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const unit = await prisma.unit.findFirst({ where: { id: unitId, userId: user.id } });
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

    const photos: string[] = JSON.parse(unit.photos);
    if (!photos.length) return NextResponse.json({ error: "No photos to make video from" }, { status: 400 });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rently-"));

    try {
      // Download photos
      const localPaths: string[] = [];
      const limit = Math.min(photos.length, 15);
      for (let i = 0; i < limit; i++) {
        const res = await fetch(photos[i]);
        const buf = Buffer.from(await res.arrayBuffer());
        const p = path.join(tmpDir, `p${String(i).padStart(3, "0")}.jpg`);
        fs.writeFileSync(p, buf);
        localPaths.push(p);
      }

      // Build & write overlay PNG
      const overlayBuf = await buildOverlay(
        unit.rent, unit.bedrooms, unit.bathrooms,
        unit.address, unit.city, unit.province,
      );
      const overlayPath = path.join(tmpDir, "overlay.png");
      fs.writeFileSync(overlayPath, overlayBuf);

      const n = localPaths.length;
      const frames = PHOTO_DURATION * FPS;
      const totalDuration = PHOTO_DURATION + (n - 1) * (PHOTO_DURATION - FADE);

      // ── FFmpeg inputs ──────────────────────────────────────────────
      // Photos: looped as stills; overlay PNG looped forever (trimmed by video)
      const inputArgs: string[] = [];
      for (const p of localPaths) {
        inputArgs.push("-loop", "1", "-t", String(PHOTO_DURATION + 1), "-i", p);
      }
      inputArgs.push("-loop", "1", "-i", overlayPath);  // index n
      const overlayIdx = n;

      // ── Filter complex ─────────────────────────────────────────────
      const lines: string[] = [];

      // Scale-to-fill (crop, no letterbox) + Ken Burns per photo
      for (let i = 0; i < n; i++) {
        lines.push(
          `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
          `crop=${W}:${H},setsar=1,` +
          `${kenBurns(i, frames)}` +
          `[v${i}]`
        );
      }

      // Crossfade chain between photos
      let lastLabel = "v0";
      if (n > 1) {
        for (let i = 1; i < n; i++) {
          const offset = (i * (PHOTO_DURATION - FADE)).toFixed(3);
          const next = i === n - 1 ? "vmerged" : `xf${i}`;
          lines.push(
            `[${lastLabel}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset}[${next}]`
          );
          lastLabel = next;
        }
      }
      const baseLabel = n === 1 ? "v0" : "vmerged";
      const fadeOut = (totalDuration - 0.9).toFixed(3);

      // Color grading + vignette + fade in/out → composite the overlay bar
      lines.push(
        `[${baseLabel}]` +
        `fade=t=in:st=0:d=0.7,` +
        `fade=t=out:st=${fadeOut}:d=0.9,` +
        `eq=saturation=1.12:contrast=1.04:brightness=0.01,` +
        `vignette=angle=PI/4.5` +
        `[vgraded]`
      );

      // Overlay the info bar at the bottom
      lines.push(
        `[vgraded][${overlayIdx}:v]overlay=x=0:y=${H - 220}:shortest=1[out]`
      );

      const filterComplex = lines.join(";\n");
      const fcFile = path.join(tmpDir, "fc.txt");
      fs.writeFileSync(fcFile, filterComplex);

      const outputPath = path.join(tmpDir, "output.mp4");
      const ffmpeg = findFfmpeg();

      // Use -/filter_complex (FFmpeg 8+ preferred) with file to avoid quoting issues
      execSync(
        [
          `"${ffmpeg}" -y`,
          inputArgs.join(" "),
          `-/filter_complex "${fcFile}"`,
          `-map "[out]"`,
          `-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p`,
          `-t ${totalDuration.toFixed(3)}`,
          `"${outputPath}"`,
        ].join(" "),
        { stdio: "pipe", timeout: 300_000 }
      );

      if (!fs.existsSync(outputPath)) {
        return NextResponse.json({ error: "FFmpeg did not produce output." }, { status: 500 });
      }

      const videoBuffer = fs.readFileSync(outputPath);
      const blob = await put(
        `${userId}/videos/${unitId}-${Date.now()}.mp4`,
        videoBuffer,
        { access: "public", contentType: "video/mp4" }
      );

      await prisma.unit.update({ where: { id: unitId }, data: { videoUrl: blob.url } });
      return NextResponse.json({ videoUrl: blob.url });

    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("ENOENT")) {
      return NextResponse.json(
        { error: "FFmpeg not found. Run: brew install ffmpeg" },
        { status: 500 }
      );
    }
    console.error("generate-video error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
