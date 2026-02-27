import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const requestSchema = z.object({
  url: z.url(),
});

const verificationResultSchema = z.object({
  safe: z.boolean(),
  reason: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { safe: false, reason: "Invalid URL format" },
        { status: 400 },
      );
    }

    const { url } = parsed.data;

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: verificationResultSchema,
      prompt: `Analyze this URL and determine if it is a safe, legitimate website suitable for use as a trusted knowledge source in a professional organization setting.

URL: ${url}

Rules:
- REJECT any URL that is associated with adult/pornographic content, gambling, malware, phishing, piracy, illegal activity, hate speech, or any other unsafe/inappropriate content.
- REJECT URLs with suspicious or deceptive domain patterns (e.g. typosquatting, homograph attacks).
- APPROVE URLs from well-known reputable domains (e.g. wikipedia.org, github.com, official documentation sites, news outlets, educational institutions, government sites, established businesses).
- APPROVE URLs that appear to be legitimate business, educational, or informational websites — even if you don't recognize the specific business. A normal company website (e.g. acme.com, atrinova.se) is safe by default.
- Only REJECT if there is a concrete reason to believe the site is harmful. Do NOT reject simply because a business is small or unfamiliar.

Respond with whether the URL is safe and a brief reason.`,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("[AI] Source verification failed", error);
    return NextResponse.json(
      { safe: false, reason: "Verification failed. Please try again." },
      { status: 500 },
    );
  }
}
