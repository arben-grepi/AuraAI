import "dotenv/config";
import { Client } from "pg";
import OpenAI from "openai";
import crypto from "crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const DATABASE_URL = process.env.DATABASE_URL!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const EMBEDDING_MODEL = "text-embedding-3-small";
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 300;

const toVector = (vec: number[]) => `'[${vec.join(",")}]'::vector`;

async function main() {
  if (!DATABASE_URL || !OPENAI_API_KEY) {
    throw new Error("Missing DATABASE_URL or OPENAI_API_KEY");
  }

  const text = `NovaTech Solutions Inc.
--- Sales and Financial Overview 2024 ---

1. General Financial Summary
   - Total Revenue: $18,450,000
   - Net Profit: $3,275,000
   - Gross Margin: 44%
   - Operating Expenses: $6,950,000
   - Year-over-Year Growth: 12.8%

2. Sales by Quarter
   Q1 2024: $4,150,000 (12,400 units) - Strong Q1 due to NovaCRM 2.0 launch
   Q2 2024: $4,560,000 (13,200 units) - Strong B2B demand in Europe
   Q3 2024: $4,850,000 (14,050 units) - Expansion into Singapore & India
   Q4 2024: $4,890,000 (14,400 units) - Record holiday sales

3. Sales by Product Line
   - NovaCRM Cloud: 23,000 units | $7,300,000 revenue | 46% margin
   - NovaAnalytics: 15,800 units | $5,200,000 revenue | 38% margin
   - NovaAI Platform: 9,600 units | $4,500,000 revenue | 50% margin
   - Support & Services: — | $1,450,000 revenue | 30% margin

4. Regional Breakdown
   - North America: $7.9M revenue (43%)
   - Europe: $5.2M revenue (28%)
   - Asia-Pacific: $4.3M revenue (23%)
   - Other Regions: $1.0M revenue (6%)

5. Top Performing Sales Representatives
   - Sarah Thompson | North America | $1,450,000 sales | 94 deals | 28% conversion
   - Michael Chen | Asia-Pacific | $1,120,000 sales | 82 deals | 25% conversion
   - Laura Perez | Europe | $980,000 sales | 77 deals | 22% conversion
   - David Brown | North America | $920,000 sales | 69 deals | 20% conversion
   - Anna Lindström | Europe | $875,000 sales | 65 deals | 19% conversion

6. Department Performance
   - Sales: 35 employees | $3,200,000 budget | 104% KPI achievement
   - Marketing: 18 employees | $1,500,000 budget | 97% KPI achievement
   - Engineering: 42 employees | $4,600,000 budget | 91% KPI achievement
   - Customer Support: 25 employees | $1,200,000 budget | 88% KPI achievement
   - HR & Admin: 12 employees | $750,000 budget | 95% KPI achievement

7. Notable Highlights
   - NovaAI Platform achieved the highest profitability (50% margin)
   - Sales conversion rate improved 4% from 2023
   - Customer churn dropped from 9.5% to 7.8%
   - Employee retention rate: 93%
   - Planned 2025 expansion into South America and the Middle East

--- End of Document ---
`.trim();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const docs = await splitter.createDocuments(
    [text],
    [{ source: "NovaTech 2024", docType: "sales-financial" }],
  );
  const chunks = docs.map((d) => d.pageContent);

  if (chunks.length === 0) {
    console.log("No chunks produced; aborting.");
    return;
  }
  console.log(`Chunks: ${chunks.length}`);

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const emb = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: chunks,
  });

  if (!emb.data?.length) throw new Error("No embeddings returned");

  const pg = new Client({ connectionString: DATABASE_URL });
  await pg.connect();

  const resourceId = crypto.randomUUID();
  try {
    await pg.query("BEGIN");

    await pg.query(`INSERT INTO "resources" ("id") VALUES ($1)`, [resourceId]);

    const hasMetadataColumn = false;

    const rowsSql: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    for (let i = 0; i < emb.data.length; i++) {
      const id = crypto.randomUUID();
      const content = chunks[i];
      const vector = toVector(emb.data[i].embedding as number[]);

      if (hasMetadataColumn) {
        const metadata = docs[i].metadata ?? {};
        rowsSql.push(`($${p++}, $${p++}, ${vector}, $${p++}, $${p++}::jsonb)`);
        params.push(id, content, resourceId, JSON.stringify(metadata));
      } else {
        rowsSql.push(`($${p++}, $${p++}, ${vector}, $${p++})`);
        params.push(id, content, resourceId);
      }
    }

    const sql = hasMetadataColumn
      ? `INSERT INTO "embeddings" ("id","content","embedding","resource_id","metadata")
         VALUES ${rowsSql.join(",")}`
      : `INSERT INTO "embeddings" ("id","content","embedding","resource_id")
         VALUES ${rowsSql.join(",")}`;

    await pg.query(sql, params);
    await pg.query("COMMIT");

    console.log(`Ingested ${chunks.length} chunks into resource ${resourceId}`);
  } catch (e) {
    await pg.query("ROLLBACK");
    throw e;
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
