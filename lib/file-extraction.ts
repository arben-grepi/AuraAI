import PDFParser from "pdf2json";

export async function extractTextFromTXT(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = buffer.toString("utf8").trim();
  return text;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData: unknown) => {
      const errorMessage =
        errData && typeof errData === "object" && "parserError" in errData
          ? String((errData as { parserError: unknown }).parserError)
          : "Unknown PDF parsing error";
      reject(
        new Error(
          `PDF parsing failed with both methods. pdf2json error: ${errorMessage}. This PDF may be image-based (scanned) and require OCR.`,
        ),
      );
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      try {
        let text = "";

        try {
          text = pdfParser.getRawTextContent() || "";
        } catch (e) {
          console.warn("getRawTextContent failed:", e);
        }

        const data = pdfData as unknown as Record<string, unknown>;
        if ((!text || text.trim().length === 0) && data.Pages) {
          const extractedText = (
            data.Pages as Array<{
              Texts?: Array<{ R?: Array<{ T?: string }>; T?: string }>;
            }>
          )
            .map((page) => {
              if (page.Texts && Array.isArray(page.Texts)) {
                return page.Texts.map((textObj) => {
                  if (textObj.R && Array.isArray(textObj.R)) {
                    return textObj.R.map((r) => {
                      try {
                        const t = r.T || "";
                        if (t) {
                          try {
                            return decodeURIComponent(t);
                          } catch {
                            return t;
                          }
                        }
                        return "";
                      } catch {
                        return "";
                      }
                    }).join("");
                  }
                  if (textObj.T) {
                    try {
                      return decodeURIComponent(textObj.T);
                    } catch {
                      return textObj.T || "";
                    }
                  }
                  return "";
                }).join(" ");
              }
              return "";
            })
            .filter(Boolean)
            .join("\n");

          if (extractedText && extractedText.trim().length > 0) {
            text = extractedText;
          }
        }

        if (!text || text.trim().length === 0) {
          try {
            const parserAny = pdfParser as {
              getFormFields?: () => Array<{ value?: unknown; V?: unknown }>;
            };
            if (
              parserAny.getFormFields &&
              typeof parserAny.getFormFields === "function"
            ) {
              const fields = parserAny.getFormFields();
              if (fields && Array.isArray(fields) && fields.length > 0) {
                const fieldsText = fields
                  .map((f) => (f.value ?? f.V ?? "").toString())
                  .filter(Boolean)
                  .join(" ");
                if (fieldsText.trim().length > 0) {
                  text = fieldsText;
                }
              }
            }
          } catch {}
        }

        if (!text || text.trim().length === 0) {
          const pages = data.Pages as Array<{ Texts?: unknown }> | undefined;
          console.log("PDF extraction failed. Data structure:", {
            hasPages: !!pages,
            pagesCount: pages?.length ?? 0,
            hasTexts: !!pages?.[0]?.Texts,
          });

          reject(
            console.error(
              "PDF contains no extractable text. This may be an image-based (scanned) PDF that requires OCR to extract text. Please ensure your PDF has selectable text. You can verify by trying to select text in a PDF viewer.",
            ),
          );
          return;
        }
        resolve(text.trim());
      } catch (error) {
        reject(
          new Error(
            `Failed to extract text from PDF: ${
              error instanceof Error ? error.message : "Unknown error"
            }. The PDF may be corrupted, password-protected, or image-based.`,
          ),
        );
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

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

export function isPlainTextFile(file: File): boolean {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  return (
    PLAIN_TEXT_MIMES.some((m) => fileType === m) ||
    PLAIN_TEXT_EXTENSIONS.some((ext) => fileName.endsWith(ext))
  );
}

export function isSupportedRagFile(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const isPDF = file.type === "application/pdf" || fileName.endsWith(".pdf");
  return isPDF || isPlainTextFile(file);
}

export async function extractText(file: File): Promise<string> {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  const isPDF = fileType === "application/pdf" || fileName.endsWith(".pdf");

  if (isPlainTextFile(file)) {
    return extractTextFromTXT(file);
  }
  if (isPDF) {
    return extractTextFromPDF(file);
  }
  throw new Error(
    `Unsupported file type: ${file.type || "unknown"}. Supported: .pdf, .txt, .md, .csv, .json, .html, .xml`,
  );
}
