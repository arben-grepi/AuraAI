import { getChatModel } from "@/lib/ai-provider";
import { generateText } from "ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const { text } = await generateText({
    model: getChatModel(),
    prompt: prompt,
    temperature: 0.7,
  });

  return NextResponse.json({ text });
}
