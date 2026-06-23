import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { address, city, province, rent, bedrooms, bathrooms, sqft, amenities, availableFrom } = await req.json();

    const amenityList = Array.isArray(amenities) && amenities.length > 0 ? amenities.join(", ") : "None specified";
    const bedroomLabel = bedrooms === 0 ? "Studio" : `${bedrooms} bedroom${bedrooms > 1 ? "s" : ""}`;
    const availabilityLine = availableFrom
      ? `Available from: ${new Date(availableFrom).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}`
      : "Availability: Immediate / flexible";

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Write a compelling Facebook Marketplace rental listing. Return ONLY a JSON object with two fields: "title" (max 80 characters, attention-grabbing, include move-in date if provided) and "description" (2–3 paragraphs, friendly and professional, mention move-in date naturally). No markdown, no explanation — raw JSON only.

Property Details:
- Address: ${address}, ${city}, ${province}
- Rent: $${rent}/month
- Bedrooms: ${bedroomLabel}
- Bathrooms: ${bathrooms}
- Square footage: ${sqft ? sqft + " sqft" : "Not specified"}
- Amenities: ${amenityList}
- ${availabilityLine}

Return format exactly:
{"title": "...", "description": "..."}`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    // strip markdown code fences if model adds them
    const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(jsonStr);

    return NextResponse.json({
      title: (parsed.title || "").slice(0, 80),
      description: parsed.description || "",
    });
  } catch (e) {
    console.error("generate-description error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed" },
      { status: 500 }
    );
  }
}
