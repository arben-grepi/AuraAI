import {
  cn,
  formatBytes,
  generateSlug,
  normalizeSlugParam,
  generateChunks,
  getSystemPrompt,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toContain("base");
    expect(cn("base", false && "hidden", "visible")).toContain("visible");
    expect(cn("base", false && "hidden", "visible")).not.toContain("hidden");
  });

  it("merges tailwind classes correctly", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatBytes", () => {
  it("formats 0 as 0 Byte", () => {
    expect(formatBytes(0)).toBe("0 Byte");
  });

  it("formats bytes", () => {
    expect(formatBytes(100)).toBe("100.00 Bytes");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1536)).toBe("1.50 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });
});

describe("generateSlug", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(generateSlug("My Org Name")).toBe("my-org-name");
  });

  it("handles single word", () => {
    expect(generateSlug("Acme")).toBe("acme");
  });
});

describe("normalizeSlugParam", () => {
  it("decodes URI component", () => {
    expect(normalizeSlugParam("my-org")).toBe("my-org");
    expect(normalizeSlugParam(encodeURIComponent("café"))).toBe("café");
  });

  it("normalizes unicode to NFC", () => {
    const nfd = "cafe\u0301";
    expect(normalizeSlugParam(nfd)).toBe("café");
  });
});

describe("generateChunks", () => {
  it("returns empty array for empty input", () => {
    expect(generateChunks("")).toEqual([]);
  });

  it("returns chunks for medium-length text", () => {
    const text = "First sentence. Second sentence. Third. Fourth. Fifth. ".repeat(20);
    const chunks = generateChunks(text, 1800, 300);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((c) => c.includes("First sentence"))).toBe(true);
  });

  it("splits long text into multiple chunks", () => {
    const long =
      "First. Second. Third. Fourth. Fifth. Sixth. Seventh. Eighth. Ninth. Tenth. ".repeat(
        50,
      );
    const chunks = generateChunks(long, 200, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("respects maxChars", () => {
    const text = "A. ".repeat(400);
    const chunks = generateChunks(text, 300, 50);
    chunks.forEach((c) => {
      expect(c.length).toBeLessThanOrEqual(400);
    });
  });
});

describe("getSystemPrompt", () => {
  it("includes organization name", () => {
    const prompt = getSystemPrompt("Acme");
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("knowledge-base assistant");
  });

  it("requires sources and forbids general knowledge as filler", () => {
    const prompt = getSystemPrompt("X");
    expect(prompt).toContain("[[1]]");
    expect(prompt).toContain("Knowledge base context");
    expect(prompt).toContain("No general knowledge");
  });
});
