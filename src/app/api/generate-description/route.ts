import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { address, city, province, rent, bedrooms, bathrooms, sqft, amenities } = await req.json();

  const amenityList = Array.isArray(amenities) ? amenities.join(", ") : amenities;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Write a compelling Facebook Marketplace rental listing for this property. Make it engaging, honest, and highlight the best features. Use a friendly, professional tone.

Property Details:
- Address: ${address}, ${city}, ${province}
- Rent: $${rent}/month
- Bedrooms: ${bedrooms}
- Bathrooms: ${bathrooms}
- Square footage: ${sqft ? sqft + " sqft" : "Not specified"}
- Amenities: ${amenityList || "None specified"}

Write ONLY the listing description (2-3 paragraphs). No title needed. Start directly with the description.`,
      },
    ],
  });

  const description = message.content[0].type === "text" ? message.content[0].text : "";

  const titleMessage = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `Write a short, attention-grabbing Facebook Marketplace listing title for a ${bedrooms} bed / ${bathrooms} bath rental at ${address}, ${city} for $${rent}/month. Max 80 characters. Return ONLY the title, nothing else.`,
      },
    ],
  });

  const title = titleMessage.content[0].type === "text" ? titleMessage.content[0].text.trim() : "";

  return NextResponse.json({ description, title });
}
