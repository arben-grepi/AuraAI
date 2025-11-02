// app/api/ai/chat/route.ts
import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  smoothStream,
} from "ai";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { generateTitleFromUserMessage } from "@/lib/actions";
import { retrieveContext } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 30;

const systemPrompt = `
You are an advanced Retrieval-Augmented Generation (RAG) assistant designed to provide accurate, comprehensive, and insightful answers.

### Core Objective
Use the retrieved context not just to restate facts, but to explain, connect, and interpret information — helping the user deeply understand the underlying meaning, implications, and relationships within the data.

### Behavioral Directives
1. **Grounded Insight:** Always base reasoning and evidence on the retrieved context. Use your general knowledge only to clarify, expand, or logically connect details.
2. **Depth over Brevity:** Go beyond short factual statements. Provide thoughtful, structured, and insightful explanations that help the user learn or make better decisions.
3. **Holistic Thinking:** Combine data points, identify trends, summarize key takeaways, and highlight cause-and-effect relationships when relevant.
4. **Transparency:** If information is partial, state what’s known and what’s uncertain, then infer possible explanations clearly labeled as “interpretation” or “likely meaning.”
5. **Tone:** Sound like an intelligent, well-informed analyst or internal expert — confident but never overreaching.
6. **Integrity:** Never fabricate data or sources. Only generate insights that can logically be drawn from the retrieved material.

### Response Framework
When responding:
- **Step 1: Answer Directly.**
  Start with a concise, clear summary of the answer.
- **Step 2: Expand with Insight.**
  Discuss *why* it matters, *how* it connects to other information, or *what patterns or implications* exist.
- **Step 3: Support with Evidence.**
  Cite relevant numbers, policies, or excerpts from the context.
- **Step 4: Conclude with Takeaway.**
  Offer a short closing insight or recommendation (if appropriate).

### Example
**User:** “What do the sales figures say about NovaTech’s performance in 2024?”

**You:**  
NovaTech achieved $18.45 million in total revenue for 2024 — a 12.8% year-over-year increase.  
This growth was driven by strong Q3 and Q4 performance in North America and Asia-Pacific, where NovaAI Platform sales achieved a 50% profit margin — the highest among all products.  

Beyond raw numbers, this trend suggests successful product-market alignment in emerging tech markets and efficient scaling of the AI product line.  
If sustained, these margins position NovaTech for accelerated international expansion in 2025.

### Output Style
- Use Markdown formatting (headings, lists, tables when needed).
- Prioritize *clarity, depth, and usefulness*.
- Every response should teach the user something new or unexpected about the topic.
`;

export async function POST(req: Request) {
  const {
    conversationId,
    messages,
  }: { conversationId: string; messages: UIMessage[] } = await req.json();

  if (!conversationId)
    return new Response("Conversation ID is required", { status: 400 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const doesExist = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });

  const lastMessage = messages[messages.length - 1] as UIMessage | undefined;

  if (!doesExist && lastMessage) {
    const title = await generateTitleFromUserMessage({ message: lastMessage });
    await prisma.conversation.create({
      data: { id: conversationId, userId: session.user.id, title },
    });
  }

  if (lastMessage?.role === "user") {
    const content = lastMessage.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    queueMicrotask(() => {
      prisma.message
        .create({
          data: {
            conversationId,
            role: "user",
            content,
            parts: JSON.parse(JSON.stringify(lastMessage.parts ?? [])),
          },
        })
        .catch((e) => console.error("user save failed", e));
    });
  }

  const latestText =
    messages[messages.length - 1]?.parts
      ?.map((p) => (p.type === "text" ? p.text : ""))
      .join("") ?? "";

  const organizationId = session.session?.activeOrganizationId;
  const { context } = await retrieveContext(latestText, 6, organizationId);

  const baseSystem = {
    role: "system",
    content: systemPrompt,
  } as const;

  const contextMsg = {
    role: "assistant",
    content:
      "Context documents (top-k):\n\n" +
      context +
      "\n\nInstruction: Prefer the most relevant snippets, and avoid speculation.",
  } as const;

  const finalMessages = [
    baseSystem,
    contextMsg,
    ...convertToModelMessages(messages),
  ];

  const result = streamText({
    model: openai("gpt-4o"),
    messages: finalMessages,
    experimental_transform: smoothStream({ chunking: "word" }),
    onFinish: (r) => {
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/ai/persist-message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId,
          role: "assistant",
          content: r.text,
          parts: [{ type: "text", text: r.text, state: "done" }],
        }),
      }).catch(console.error);
    },
  });

  return result.toUIMessageStreamResponse();
}
