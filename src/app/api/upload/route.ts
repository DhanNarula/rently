import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

  const uploads = await Promise.all(
    files.map(async (file) => {
      const uid = randomBytes(6).toString("hex");
      const blob = await put(`${userId}/${uid}-${file.name}`, file, {
        access: "public",
      });
      return blob.url;
    })
  );

  return NextResponse.json({ urls: uploads });
}
