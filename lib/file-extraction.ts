import PDFParser from "pdf2json";

/**
 * Extract text from a TXT file
 */
export async function extractTextFromTXT(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = buffer.toString("utf8").trim();
  return text;
}

/**
 * Extract text from a PDF file using pdf2json
 * Note: This function must only be used in server-side code (API routes, server components)
 */
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

        // Method 1: Try getRawTextContent() from parser
        try {
          text = pdfParser.getRawTextContent() || "";
        } catch (e) {
          console.warn("getRawTextContent failed:", e);
        }

        // Method 2: Extract from pdfData.Pages structure (most reliable)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = pdfData as any;
        if ((!text || text.trim().length === 0) && data.Pages) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const extractedText = data.Pages.map((page: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (page.Texts && Array.isArray(page.Texts)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return page.Texts.map((textObj: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (textObj.R && Array.isArray(textObj.R)) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return textObj.R.map((r: any) => {
                    try {
                      // Try decoding the text (may be URI encoded)
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
                // Fallback: try direct T property
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((textObj as any).T) {
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return decodeURIComponent((textObj as any).T);
                  } catch {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (textObj as any).T || "";
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

        // Method 3: Try getFormFields if available (checking as any since type may not be accurate)
        if (!text || text.trim().length === 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parserAny = pdfParser as any;
            if (
              parserAny.getFormFields &&
              typeof parserAny.getFormFields === "function"
            ) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fields = parserAny.getFormFields();
              if (fields && Array.isArray(fields) && fields.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fieldsText = fields
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((f: any) => (f.value || f.V || "").toString())
                  .filter(Boolean)
                  .join(" ");
                if (fieldsText.trim().length > 0) {
                  text = fieldsText;
                }
              }
            }
          } catch {
            // Ignore - method may not be available
          }
        }

        if (!text || text.trim().length === 0) {
          // Log debug info to help diagnose
          console.log("PDF extraction failed. Data structure:", {
            hasPages: !!data.Pages,
            pagesCount: data.Pages?.length || 0,
            hasTexts: !!data.Pages?.[0]?.Texts,
          });

          reject(
            new Error(
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

/**
 * Extract text from a file (PDF or TXT)
 * Note: This function must only be used in server-side code (API routes, server components)
 */
export async function extractText(file: File): Promise<string> {
  const isTXT = file.type === "text/plain" || file.name.endsWith(".txt");
  const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");

  if (isTXT) {
    return extractTextFromTXT(file);
  } else if (isPDF) {
    return extractTextFromPDF(file);
  } else {
    throw new Error(
      `Unsupported file type: ${file.type || "unknown"}. Only .txt and .pdf files are supported.`,
    );
  }
}
