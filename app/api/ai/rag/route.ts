import OpenAI from "openai";
const client = new OpenAI();

const vector_store = await client.vectorStores.create({
  name: "Support FAQ",
});

export async function POST(req: Request) {}
