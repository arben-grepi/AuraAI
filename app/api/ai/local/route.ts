import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const { prompt } = await req.json();

    const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: prompt,
        temperature: 0.7,
    })

    return NextResponse.json({ text });
}
