import { ollama } from 'ai-sdk-ollama';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { prompt } = await req.json();

    const { text } = await generateText({
        model: ollama('llama3:8b'),
        prompt: prompt,
        temperature: 0.7,
    })

    return NextResponse.json({ text });
}