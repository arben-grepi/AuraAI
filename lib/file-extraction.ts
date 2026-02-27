import PDFParser from "pdf2json";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

/**
 * Strip null bytes and other characters that PostgreSQL's UTF-8 encoding rejects.
 * pdf2json sometimes produces \x00 in extracted text.
 */
function sanitizeForPostgres(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x00/g, "");
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

export async function extractTextFromTXT(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("utf8").trim();
}

// ---------------------------------------------------------------------------
// PDF — use pdf2json
// ---------------------------------------------------------------------------

export async function extractTextFromPDF(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData: unknown) => {
      const errorMessage =
        errData && typeof errData === "object" && "parserError" in errData
          ? String((errData as { parserError: unknown }).parserError)
          : "Unknown PDF parsing error";
      reject(new Error(`PDF parsing failed: ${errorMessage}`));
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        let text = "";

        try {
          text = pdfParser.getRawTextContent() || "";
        } catch {
          // fallback below
        }

        if (!text?.trim()) {
          const data = pdfData as unknown as Record<string, unknown>;
          if (data.Pages) {
            text = (
              data.Pages as Array<{
                Texts?: Array<{ R?: Array<{ T?: string }> }>;
              }>
            )
              .map((page) =>
                (page.Texts ?? [])
                  .map((textObj) =>
                    (textObj.R ?? [])
                      .map((r) => {
                        try {
                          return r.T ? decodeURIComponent(r.T) : "";
                        } catch {
                          return r.T ?? "";
                        }
                      })
                      .join(""),
                  )
                  .join(" "),
              )
              .filter(Boolean)
              .join("\n");
          }
        }

        if (!text?.trim()) {
          reject(
            new Error(
              "PDF contains no extractable text. This may be an image-based (scanned) PDF that requires OCR.",
            ),
          );
          return;
        }

        resolve(text.trim());
      } catch (error) {
        reject(
          new Error(
            `Failed to extract text from PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
          ),
        );
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

export async function extractTextFromDOCX(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value?.trim();

  if (!text) {
    throw new Error("DOCX file contains no extractable text.");
  }
  return text;
}

// ---------------------------------------------------------------------------
// XLSX / XLS / CSV — convert sheets to readable text with markdown tables
// ---------------------------------------------------------------------------

function csvToMarkdownTable(csv: string): string {
  const lines = csv
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  const rows = lines.map((line) => line.split(",").map((cell) => cell.trim()));
  const header = rows[0];
  const separator = header.map(() => "---");
  const mdRows = [header, separator, ...rows.slice(1)].map(
    (row) => `| ${row.join(" | ")} |`,
  );
  return mdRows.join("\n");
}

export async function extractTextFromSpreadsheet(
  file: File,
): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer);

  const sections = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const table = csvToMarkdownTable(csv);
    return workbook.SheetNames.length > 1 ? `## ${name}\n\n${table}` : table;
  });

  const text = sections.filter(Boolean).join("\n\n");
  if (!text.trim()) {
    throw new Error("Spreadsheet contains no extractable data.");
  }
  return text.trim();
}

// ---------------------------------------------------------------------------
// File type detection
// ---------------------------------------------------------------------------

const PLAIN_TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".html", ".xml"];
const PLAIN_TEXT_MIMES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
  "application/xml",
  "text/xml",
];

const DOCX_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const SPREADSHEET_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls"];

export function isPlainTextFile(file: File): boolean {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  return (
    PLAIN_TEXT_MIMES.some((m) => fileType === m) ||
    PLAIN_TEXT_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
}

function isDOCXFile(file: File): boolean {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  return (
    DOCX_MIMES.some((m) => fileType === m) || fileName.endsWith(".docx")
  );
}

function isSpreadsheetFile(file: File): boolean {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  return (
    SPREADSHEET_MIMES.some((m) => fileType === m) ||
    SPREADSHEET_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
}

function isPDFFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export function isSupportedRagFile(file: File): boolean {
  return (
    isPDFFile(file) ||
    isPlainTextFile(file) ||
    isDOCXFile(file) ||
    isSpreadsheetFile(file)
  );
}

export async function extractText(file: File): Promise<string> {
  let text: string;

  if (isPlainTextFile(file)) text = await extractTextFromTXT(file);
  else if (isPDFFile(file)) text = await extractTextFromPDF(file);
  else if (isDOCXFile(file)) text = await extractTextFromDOCX(file);
  else if (isSpreadsheetFile(file)) text = await extractTextFromSpreadsheet(file);
  else {
    throw new Error(
      `Unsupported file type: ${file.type || "unknown"}. Supported: .pdf, .txt, .md, .csv, .json, .html, .xml, .docx, .xlsx, .xls`,
    );
  }

  // Sanitize: remove null bytes that PostgreSQL UTF-8 encoding rejects
  return sanitizeForPostgres(text);
}
