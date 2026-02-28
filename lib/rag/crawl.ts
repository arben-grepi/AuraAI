import * as cheerio from "cheerio";

export interface CrawledPage {
  url: string;
  title: string;
  content: string;
}

const MAX_PAGES = 50;
const CRAWL_TIMEOUT_MS = 10_000;
const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "nav",
  "footer",
  "header",
  "aside",
  "[role=navigation]",
  "[role=banner]",
  "[role=contentinfo]",
  ".nav",
  ".navbar",
  ".footer",
  ".sidebar",
  ".menu",
  ".cookie-banner",
  ".ad",
  ".ads",
  ".advertisement",
];

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    // Only follow http/https
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Strip hash and trailing slash
    url.hash = "";
    let normalized = url.toString();
    if (normalized.endsWith("/") && url.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

function extractText($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $(STRIP_SELECTORS.join(",")).remove();

  // Try to find main content area first
  const mainContent =
    $("main").text() ||
    $("article").text() ||
    $('[role="main"]').text() ||
    $("#content").text() ||
    $(".content").text();

  const text = mainContent || $("body").text();

  // Clean up whitespace: collapse runs of whitespace, trim lines
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

function extractLinks(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  origin: string,
): string[] {
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized) return;
    try {
      const url = new URL(normalized);
      if (url.origin === origin) {
        // Skip common non-content paths
        const lower = url.pathname.toLowerCase();
        if (
          lower.match(
            /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot|pdf|zip|tar|gz)$/,
          )
        )
          return;
        links.push(normalized);
      }
    } catch {
      // skip invalid
    }
  });
  return links;
}

async function fetchPage(
  url: string,
): Promise<{ html: string; contentType: string } | null> {
  try {
    console.log(`[crawl] Fetching: ${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KommunAIBot/1.0; +https://kommun.ai)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      console.log(`[crawl] Skipped (non-HTML content-type: ${contentType}): ${url}`);
      return null;
    }

    const html = await response.text();
    console.log(`[crawl] Fetched OK (${html.length} bytes): ${url}`);
    return { html, contentType };
  } catch (err) {
    console.log(`[crawl] Fetch failed: ${url} — ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

export type CrawlProgressCallback = (event: {
  type: "crawling" | "crawled" | "skipped";
  url: string;
  pagesFound: number;
  pagesCrawled: number;
}) => void;

/**
 * Crawl a website starting from the given URL.
 * BFS, same-origin only, up to MAX_PAGES pages.
 */
export async function crawlWebsite(
  startUrl: string,
  onProgress?: CrawlProgressCallback,
  maxPages: number = MAX_PAGES,
): Promise<CrawledPage[]> {
  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const pages: CrawledPage[] = [];

  console.log(`[crawl] Starting crawl: ${startUrl} (max ${maxPages} pages)`);

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    onProgress?.({
      type: "crawling",
      url,
      pagesFound: visited.size + queue.length,
      pagesCrawled: pages.length,
    });

    const result = await fetchPage(url);
    if (!result) {
      onProgress?.({
        type: "skipped",
        url,
        pagesFound: visited.size + queue.length,
        pagesCrawled: pages.length,
      });
      continue;
    }

    const $ = cheerio.load(result.html);
    const title =
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      url;
    const content = extractText($);

    // Only keep pages with meaningful content (> 100 chars after cleanup)
    if (content.length > 100) {
      pages.push({ url, title, content });
      console.log(`[crawl] Kept page (${content.length} chars): ${url} — "${title}"`);
    } else {
      console.log(`[crawl] Skipped (only ${content.length} chars of content): ${url}`);
    }

    // Extract and queue new links
    const links = extractLinks($, url, origin);
    console.log(`[crawl] Found ${links.length} same-origin links on: ${url}`);
    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) {
        queue.push(link);
      }
    }

    onProgress?.({
      type: "crawled",
      url,
      pagesFound: visited.size + queue.length,
      pagesCrawled: pages.length,
    });
  }

  console.log(`[crawl] Done. ${pages.length} pages kept, ${visited.size} URLs visited, ${queue.length} URLs remaining in queue`);
  return pages;
}
