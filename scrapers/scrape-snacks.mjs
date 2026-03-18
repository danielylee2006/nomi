import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT_LISTING_URL =
  "https://www.yami.com/en/c/snack-beverage/1?page=1&cat_id=1&sort_by=3&search_origin=user";
const OUTPUT_PATH = path.resolve(process.cwd(), "snack-catalog.json");
const FAILURE_PATH = path.resolve(process.cwd(), "snack-catalog.failures.json");
const BACKFILL_STATE_PATH = path.resolve(process.cwd(), "snack-catalog.backfill-state.json");
const PRODUCT_CONCURRENCY = Number.parseInt(process.env.YAMI_PRODUCT_CONCURRENCY ?? "", 10) || 4;
const CHECKPOINT_EVERY = Number.parseInt(process.env.YAMI_CHECKPOINT_EVERY ?? "", 10) || 10;
const RETRY_LIMIT = 2;
const REQUEST_TIMEOUT_MS = 45_000;
const PAGE_LIMIT = Number.parseInt(process.env.YAMI_PAGE_LIMIT ?? "", 10) || 34;
const PRODUCT_LIMIT = Number.parseInt(process.env.YAMI_PRODUCT_LIMIT ?? "", 10) || null;
const REFRESH_MISSING_HIGHLIGHTS = /^(1|true|yes)$/i.test(
  String(process.env.YAMI_REFRESH_MISSING_HIGHLIGHTS || "")
);
const DIRECT_BACKFILL = process.env.YAMI_DIRECT_BACKFILL !== "false";
const HEADLESS = process.env.YAMI_HEADLESS === "true";
const BROWSER_CHANNEL = process.env.YAMI_BROWSER_CHANNEL || undefined;
const USE_CDP = process.env.YAMI_USE_CDP !== "false";
const DEBUG_URL = process.env.YAMI_CDP_URL || "http://127.0.0.1:9222";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtmlTags(html) {
  return html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|tr|h\d|nav|ul|ol)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/th>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "");
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function linesFromHtml(html) {
  return stripHtmlTags(html)
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeProductUrl(url) {
  const normalized = new URL(url, "https://www.yami.com");
  normalized.hash = "";

  const allowedParams = ["page", "cat_id", "sort_by", "search_origin"];
  for (const key of [...normalized.searchParams.keys()]) {
    if (!allowedParams.includes(key) && normalized.pathname.includes("/en/p/")) {
      normalized.searchParams.delete(key);
    }
  }

  return normalized.toString();
}

function extractItemNumberFromUrl(url) {
  const pathnameMatch = new URL(url).pathname.match(/\/(\d+)(?:\/)?$/);
  return pathnameMatch ? pathnameMatch[1] : null;
}

function extractPaginationCount(html) {
  const matches = [...html.matchAll(/\/en\/c\/snack-beverage\/1\?page=(\d+)&cat_id=1/gi)];
  const pageNumbers = matches
    .map((match) => Number.parseInt(match[1], 10))
    .filter((value) => Number.isFinite(value));

  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
}

function buildListingUrl(pageNumber) {
  const url = new URL(ROOT_LISTING_URL);
  url.searchParams.set("page", String(pageNumber));
  return url.toString();
}

function extractListingProductUrls(html) {
  const productUrls = new Map();
  const matches = [...html.matchAll(/href="([^"]*\/en\/p\/[^"]+)"/gi)];

  for (const match of matches) {
    const rawUrl = decodeHtmlEntities(match[1]);
    const absoluteUrl = new URL(rawUrl, "https://www.yami.com");
    const href = absoluteUrl.toString();

    if (!/bu_type=category_tree|track=category-/i.test(href)) {
      continue;
    }

    const itemNumber = extractItemNumberFromUrl(href);
    if (!itemNumber) {
      continue;
    }

    productUrls.set(itemNumber, normalizeProductUrl(href));
  }

  return [...productUrls.values()];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );

  return results;
}

async function mapWithPageWorkers(items, concurrency, setupPage, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    const page = await setupPage();

    try {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(page, items[currentIndex], currentIndex);
      }
    } finally {
      await page.close();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  );

  return results;
}

async function readJsonIfPresent(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2));
  await fs.rename(tempPath, filePath);
}

async function fetchText(url, attempt = 0) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      referer: ROOT_LISTING_URL
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if ((response.status === 429 || response.status >= 500) && attempt < RETRY_LIMIT) {
    await sleep(500 * (attempt + 1));
    return fetchText(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} for ${url}`);
  }

  return response.text();
}

async function fetchJson(url, attempt = 0) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json,text/plain,*/*",
      "accept-language": "en-US,en;q=0.9",
      referer: ROOT_LISTING_URL
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if ((response.status === 429 || response.status >= 500) && attempt < RETRY_LIMIT) {
    await sleep(500 * (attempt + 1));
    return fetchJson(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`JSON request failed with ${response.status} for ${url}`);
  }

  return response.json();
}

function extractJsonLdProduct(html) {
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];

  for (const match of scripts) {
    try {
      const payload = JSON.parse(decodeHtmlEntities(match[1].trim()));
      const values = Array.isArray(payload) ? payload : [payload];
      const product = values.find((value) => value?.["@type"] === "Product");
      if (product) {
        return product;
      }
    } catch {
      // Ignore malformed structured data blocks and continue.
    }
  }

  return null;
}

function extractHeading(html) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? cleanText(stripHtmlTags(match[1])) : null;
}

function extractPageTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return null;
  }

  return cleanText(stripHtmlTags(match[1])).replace(/\s+\|\s+Yami\s*$/i, "") || null;
}

function extractMetaContent(html, attribute, value) {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${value}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    "i"
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+${attribute}=["']${value}["'][^>]*>`,
    "i"
  );

  const match = html.match(pattern) ?? html.match(reversePattern);
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function extractCategoryFromKeywords(html) {
  const keywords = extractMetaContent(html, "name", "keywords");
  if (!keywords) {
    return null;
  }

  const parts = keywords
    .split(",")
    .map((part) => cleanText(part))
    .filter(Boolean);
  const yamiIndex = parts.findIndex((part) => /^Yami\.com$/i.test(part));

  if (yamiIndex >= 1) {
    return parts[yamiIndex - 1];
  }

  return null;
}

function extractBrandLink(html) {
  const match = html.match(/<a[^>]+href="[^"]*\/en\/b\/[^"]*\/(\d+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!match) {
    return { brandId: null, brandName: null };
  }

  return {
    brandId: match[1],
    brandName: cleanText(stripHtmlTags(match[2]))
  };
}

function extractBreadcrumbCategory(html) {
  const navMatch = html.match(/<nav[^>]*breadcrumb[^>]*>([\s\S]*?)<\/nav>/i);
  if (!navMatch) {
    return null;
  }

  const breadcrumbLinks = [...navMatch[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => cleanText(stripHtmlTags(match[1])))
    .filter(Boolean);

  return breadcrumbLinks.length > 0 ? breadcrumbLinks[breadcrumbLinks.length - 1] : null;
}

function extractBrandOrigin(lines) {
  for (const line of lines) {
    const tabMatch = line.match(/^Brand Origin\s+(.+)$/i);
    if (tabMatch) {
      return tabMatch[1].trim();
    }
  }

  const index = lines.findIndex((line) => /^Brand Origin$/i.test(line));
  if (index !== -1 && lines[index + 1]) {
    return lines[index + 1];
  }

  return null;
}

function extractCountryFromDescription(description) {
  if (!description) {
    return null;
  }

  const producedMatch = description.match(/\b(?:Produced|Made)\s+in\s+([A-Za-z][A-Za-z\s&-]+?)(?:[,.]|$)/i);
  return producedMatch ? producedMatch[1].trim() : null;
}

function extractImageUrl(productSchema, html) {
  if (Array.isArray(productSchema?.image) && productSchema.image[0]) {
    return productSchema.image[0];
  }

  const imgMatch = html.match(/<img[^>]+src="([^"]+cdn\.yamibuy\.net[^"]+)"[^>]*Product Detail/i);
  return imgMatch ? decodeHtmlEntities(imgMatch[1]) : null;
}

function extractImageUrls(productSchema, html, domImageUrls = []) {
  const imageUrls = [];

  if (Array.isArray(productSchema?.image)) {
    imageUrls.push(...productSchema.image);
  } else if (typeof productSchema?.image === "string") {
    imageUrls.push(productSchema.image);
  }

  imageUrls.push(...domImageUrls);

  const ogImage =
    extractMetaContent(html, "property", "og:image") ??
    extractMetaContent(html, "name", "og:image");
  if (ogImage) {
    imageUrls.push(ogImage);
  }

  const fallbackPrimary = extractImageUrl(productSchema, html);
  if (fallbackPrimary) {
    imageUrls.push(fallbackPrimary);
  }

  return Array.from(
    new Set(
      imageUrls
        .map((url) => toAbsoluteImageUrl(url))
        .filter((url) => typeof url === "string" && /^https?:\/\//i.test(url))
    )
  );
}

function extractPrice(productSchema, itemInfo) {
  const schemaPrice = productSchema?.offers?.price;
  if (typeof schemaPrice === "number") {
    return schemaPrice;
  }

  if (typeof schemaPrice === "string" && schemaPrice.trim()) {
    return Number.parseFloat(schemaPrice);
  }

  const apiPrice = itemInfo?.data?.unit_price;
  return typeof apiPrice === "number" ? apiPrice : null;
}

function buildItemInfoUrl(itemNumber) {
  return `https://www.yami.com/api/nb/item/info?item_number=${encodeURIComponent(itemNumber)}`;
}

function buildRegionInfoUrl(brandId) {
  return `https://www.yami.com/api/nb/item/getRegionInfo?brand_id=${encodeURIComponent(brandId)}`;
}

function toAbsoluteImageUrl(imagePath) {
  if (!imagePath) {
    return null;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `https://cdn.yamibuy.net${normalizedPath}`;
}

async function fetchProductFallbackData(apiPage, itemNumber) {
  return apiPage.evaluate(async ({ num }) => {
    const groupResponse = await window.axios.get(`https://ecapi.yami.com/ec-item/items/getGroupBff?item_number=${num}`);
    const brandResponse = await window.axios.get(`/api/nb/item/getPdpBrandInfo?itemNumber=${num}&PDPABTest=V0`);

    const groupBody = groupResponse.data?.body ?? {};
    const groupItem =
      (Array.isArray(groupBody.groupItemList)
        ? groupBody.groupItemList.find((item) => item.item_number === num) ?? groupBody.groupItemList[0]
        : null) ?? null;

    const brandInfo = brandResponse.data?.brand_info ?? null;
    let regionInfo = null;

    if (brandInfo?.id) {
      const regionResponse = await window.axios.get(`/api/nb/item/getRegionInfo?brand_id=${brandInfo.id}`);
      regionInfo = regionResponse.data?.data ?? null;
    }

    return {
      groupItem,
      brandInfo,
      regionInfo
    };
  }, { num: itemNumber });
}

async function collectListingResults(listingPage) {
  const listingResults = [];
  const maxPages = PAGE_LIMIT ?? 100;
  let knownLastPage = PAGE_LIMIT ?? null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const listingUrl = buildListingUrl(pageNumber);

    try {
      await listingPage.goto(listingUrl, {
        waitUntil: "domcontentloaded",
        timeout: REQUEST_TIMEOUT_MS
      });
      await listingPage.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await listingPage
        .waitForFunction(
          () => document.querySelectorAll('a[href*="/en/p/"]').length > 0,
          { timeout: 20_000 }
        )
        .catch(async () => {
          await listingPage.waitForTimeout(3_000);
        });

      const html = await listingPage.content();
      const { productUrls, paginationPageCount } = await listingPage.evaluate(() => {
        const productUrls = Array.from(document.querySelectorAll('a[href*="/en/p/"]'))
          .map((link) => link.href)
          .filter((href) => /track=category-|bu_type=category_tree|scene=item_category\.item/i.test(href))
          .filter(Boolean);

        const paginationNumbers = Array.from(
          document.querySelectorAll('nav[aria-label*="Pagination"] a[href*="page="]')
        )
          .map((link) => {
            const match = link.href.match(/[?&]page=(\d+)/i);
            return match ? Number.parseInt(match[1], 10) : null;
          })
          .filter((value) => Number.isFinite(value));

        return {
          productUrls,
          paginationPageCount: paginationNumbers.length > 0 ? Math.max(...paginationNumbers) : null
        };
      });

      const extractedProductUrls = Array.from(
        new Set(
          productUrls
            .map((url) => normalizeProductUrl(url))
            .filter((url) => extractItemNumberFromUrl(url))
        )
      );

      const hintedPageCount = extractPaginationCount(html);
      const bestKnownPageCount = Math.max(
        paginationPageCount ?? 1,
        hintedPageCount ?? 1
      );
      if (!PAGE_LIMIT && bestKnownPageCount > 1) {
        knownLastPage = bestKnownPageCount;
      }

      listingResults.push({
        listingUrl,
        productUrls: extractedProductUrls
      });
      console.log(`Collected ${extractedProductUrls.length} product URLs from listing page ${pageNumber}.`);

      if (!PAGE_LIMIT && extractedProductUrls.length < 20 && knownLastPage && pageNumber > knownLastPage) {
        break;
      }

      if (!PAGE_LIMIT && knownLastPage && pageNumber >= knownLastPage) {
        break;
      }
    } catch (error) {
      listingResults.push({
        listingUrl,
        productUrls: [],
        error: error instanceof Error ? error.message : String(error)
      });

      if (!PAGE_LIMIT) {
        break;
      }
    }
  }

  return listingResults;
}

async function extractRenderedProductData(page) {
  return page.evaluate(() => {
    const clean = (value) => value?.replace(/\s+/g, " ").trim() ?? "";
    const textOf = (node) => clean(node?.textContent ?? "");
    const unique = (values) => Array.from(new Set(values.filter(Boolean)));
    const compareOrder = (left, right) =>
      left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING;

    const headingNodes = Array.from(document.querySelectorAll("h1, h2, h3, h4"));
    const findHeading = (label) =>
      headingNodes.find((node) => textOf(node).toLowerCase() === label.toLowerCase()) ?? null;

    const collectSectionTexts = (headingLabel) => {
      const heading = findHeading(headingLabel);
      if (!heading) {
        return [];
      }

      const container = heading.parentElement ?? heading;
      const listItems = Array.from(container.querySelectorAll("li"))
        .map((node) => textOf(node))
        .filter(Boolean);

      if (listItems.length > 0) {
        return unique(listItems);
      }

      const paragraphs = Array.from(container.querySelectorAll("p"))
        .map((node) => textOf(node))
        .filter(Boolean)
        .filter((text) => text.toLowerCase() !== headingLabel.toLowerCase());

      return unique(paragraphs);
    };

    const collectProductDescription = () => {
      const detailsHeading = findHeading("Details");
      if (!detailsHeading) {
        return [];
      }

      const container = detailsHeading.parentElement ?? detailsHeading;
      const lines = String(container.innerText || "")
        .split("\n")
        .map((line) => clean(line))
        .filter(Boolean);

      const headingIndex = lines.findIndex((line) => /^PRODUCT DESCRIPTION$/i.test(line));
      if (headingIndex !== -1) {
        const descriptionLines = [];

        for (let index = headingIndex + 1; index < lines.length; index += 1) {
          const line = lines[index];
          if (/^(INSTRUCTIONS|ALLERGY INFORMATION|DISCLAIMER|SPECIFICATIONS)$/i.test(line)) {
            break;
          }
          descriptionLines.push(line);
        }

        return unique(descriptionLines);
      }

      const paragraphs = Array.from(container.querySelectorAll("p"))
        .map((node) => textOf(node))
        .filter(Boolean)
        .filter((text) => !/^details$/i.test(text))
        .filter((text) => !/^full product details$/i.test(text));

      return unique(paragraphs);
    };

    const extractBrandOrigin = () => {
      const bodyText = clean(document.body?.innerText ?? "");
      const match = bodyText.match(
        /Brand Origin\s+(.+?)(?:\s+(?:Net Content|Package Size|Package|Organic|Contains Sugar|Flavor|Date Format)\b|$)/i
      );
      return clean(match?.[1] ?? "");
    };

    const h1 = document.querySelector("h1");
    const imageUrls = unique(
      Array.from(document.querySelectorAll('img[alt^="Product Detail -"]'))
        .map((img) => img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || "")
        .map((value) => value.trim())
        .filter((value) => /cdn\.yamibuy\.net|yamibuy\.net/i.test(value))
        .filter((value) => !/loading|lazy|placeholder|sprite/i.test(value))
    );

    const breadcrumbLinks = Array.from(
      document.querySelectorAll('nav[aria-label="breadcrumb"] a, nav.breadcrumb a, nav[breadcrumb] a')
    )
      .map((node) => textOf(node))
      .filter(Boolean);

    const productInfoRoot =
      h1?.closest("[data-qa-item-title]")?.parentElement ??
      h1?.parentElement?.parentElement ??
      document.body;
    const productInfoText = clean(productInfoRoot?.innerText ?? "");

    const brandLink = h1
      ? Array.from(document.querySelectorAll('a[href*="/en/b/"]'))
          .filter((link) => textOf(link))
          .findLast((link) => compareOrder(link, h1))
      : null;
    const priceMatch = productInfoText.match(/Current price[:：]\s*\$(\d+(?:\.\d{1,2})?)/i);

    return {
      pageUrl: window.location.href,
      name: textOf(h1),
      brand: textOf(brandLink),
      category: breadcrumbLinks.at(-1) ?? "",
      country: extractBrandOrigin(),
      productHighlights: collectSectionTexts("Product Highlights"),
      productDescription: collectProductDescription(),
      imageUrls,
      priceText: priceMatch ? `Current price: $${priceMatch[1]}` : ""
    };
  });
}

function extractPriceFromText(priceText) {
  if (!priceText) {
    return null;
  }

  const match = priceText.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number.parseFloat(match[1]) : null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function mergeCatalogProduct(existingItem, nextItem) {
  if (!existingItem) {
    return nextItem;
  }

  return {
    ...existingItem,
    ...nextItem,
    name: nextItem.name ?? existingItem.name ?? null,
    brand: nextItem.brand ?? existingItem.brand ?? null,
    country: nextItem.country ?? existingItem.country ?? null,
    product_details: isNonEmptyString(nextItem.product_details)
      ? nextItem.product_details
      : existingItem.product_details ?? null,
    product_highlights: isNonEmptyArray(nextItem.product_highlights)
      ? nextItem.product_highlights
      : existingItem.product_highlights ?? null,
    category: nextItem.category ?? existingItem.category ?? null,
    price: nextItem.price ?? existingItem.price ?? null,
    image_url: isNonEmptyArray(nextItem.image_url)
      ? nextItem.image_url
      : existingItem.image_url ?? null,
    product_url: nextItem.product_url ?? existingItem.product_url ?? null
  };
}

function createBackfillStateEntry(existingEntry, status) {
  return {
    ...(existingEntry ?? {}),
    checked_details: Boolean(status.checkedDetails ?? existingEntry?.checked_details),
    checked_highlights: Boolean(status.checkedHighlights ?? existingEntry?.checked_highlights),
    last_status: status.lastStatus ?? existingEntry?.last_status ?? null,
    last_checked_at: status.lastCheckedAt ?? existingEntry?.last_checked_at ?? null
  };
}

async function parseProduct(page, productUrl) {
  const canonicalProductUrl = normalizeProductUrl(productUrl);
  await page.goto(canonicalProductUrl, {
    waitUntil: "domcontentloaded",
    timeout: REQUEST_TIMEOUT_MS
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.waitForSelector("h1", { timeout: 20_000 });

  const [html, rendered] = await Promise.all([page.content(), extractRenderedProductData(page)]);

  const liveProductUrl = normalizeProductUrl(rendered.pageUrl || canonicalProductUrl);
  const productSchema = extractJsonLdProduct(html);
  const itemNumber = extractItemNumberFromUrl(liveProductUrl) ?? String(productSchema?.sku ?? "");

  if (!itemNumber) {
    throw new Error(`Unable to determine item number for ${liveProductUrl}`);
  }

  const lines = linesFromHtml(html);

  const { brandId, brandName: brandFromLink } = extractBrandLink(html);
  let brand = rendered.brand || productSchema?.brand?.name || brandFromLink || null;
  let country =
    rendered.country ||
    extractBrandOrigin(lines) ||
    extractCountryFromDescription(productSchema?.description) ||
    null;
  let name =
    rendered.name ||
    productSchema?.name ||
    extractHeading(html) ||
    extractPageTitle(html) ||
    null;
  let category = rendered.category || extractBreadcrumbCategory(html) || extractCategoryFromKeywords(html);
  let imageUrls = extractImageUrls(productSchema, html, rendered.imageUrls);
  let productDetails = rendered.productDescription?.length
    ? rendered.productDescription.join("\n\n")
    : null;
  let productHighlights =
    rendered.productHighlights?.length
      ? rendered.productHighlights
      : rendered.productDescription?.length
        ? rendered.productDescription
        : null;
  let price = extractPriceFromText(rendered.priceText);

  if (!name || !brand || !country || !category || imageUrls.length === 0 || !price) {
    const fallback = await fetchProductFallbackData(page, itemNumber).catch(() => null);
    const fallbackGroupItem = fallback?.groupItem ?? null;
    const fallbackBrandInfo = fallback?.brandInfo ?? null;
    const fallbackRegionInfo = fallback?.regionInfo ?? null;

    name ??= fallbackGroupItem?.item_title ?? null;
    brand ??= fallbackBrandInfo?.title ?? null;
    country ??= fallbackRegionInfo?.title ?? null;
    category ??= "Snack";
    if (imageUrls.length === 0) {
      imageUrls = extractImageUrls(productSchema, html, [fallbackGroupItem?.item_image]);
    }
    price ??=
      typeof fallbackGroupItem?.unit_price === "number" ? fallbackGroupItem.unit_price : null;
  }

  if (!country && brandId) {
    const regionInfo = await fetchJson(buildRegionInfoUrl(brandId)).catch(() => null);
    country = regionInfo?.data?.title ?? null;
  }

  return {
    id: Number.parseInt(itemNumber, 10),
    name: name ?? null,
    brand: brand ?? null,
    country,
    product_details: productDetails,
    product_highlights: productHighlights?.length ? productHighlights : null,
    category: category ?? null,
    price: Number.isFinite(price) ? price : null,
    image_url: imageUrls.length > 0 ? imageUrls : null,
    product_url: liveProductUrl
  };
}

async function openBrowserSession() {
  if (USE_CDP) {
    try {
      const browser = await chromium.connectOverCDP(DEBUG_URL);
      const [context] = browser.contexts();

      if (context) {
        console.log(`Connected to live Chrome session via CDP at ${DEBUG_URL}.`);
        return { browser, browserContext: context, usesLiveChrome: true };
      }

      await browser.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Unable to connect to live Chrome via CDP at ${DEBUG_URL}: ${message}`);
    }
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    channel: BROWSER_CHANNEL
  });
  const browserContext = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1440, height: 960 },
    locale: "en-US"
  });

  console.log(`Launched standalone Playwright browser (${HEADLESS ? "headless" : "headed"} mode).`);
  return { browser, browserContext, usesLiveChrome: false };
}

async function main() {
  const { browser, browserContext, usesLiveChrome } = await openBrowserSession();

  const existingCatalog = await readJsonIfPresent(OUTPUT_PATH, []);
  const existingFailures = await readJsonIfPresent(FAILURE_PATH, []);
  const existingBackfillState = await readJsonIfPresent(BACKFILL_STATE_PATH, {});
  const catalogById = new Map(
    existingCatalog
      .filter((item) => Number.isFinite(item?.id))
      .map((item) => [item.id, item])
  );
  const backfillStateById = new Map(
    Object.entries(existingBackfillState)
      .map(([itemId, entry]) => [Number.parseInt(itemId, 10), entry])
      .filter(([itemId]) => Number.isFinite(itemId))
  );
  const failureByKey = new Map(
    existingFailures.map((entry) => [entry.product_url ?? entry.listing_url ?? JSON.stringify(entry), entry])
  );

  let completed = 0;
  let updatedAny = 0;
  let updatedDetails = 0;
  let updatedHighlights = 0;
  let unchanged = 0;
  let failed = 0;
  let flushQueue = Promise.resolve();
  const queueFlush = () => {
    flushQueue = flushQueue.then(async () => {
      const catalog = Array.from(catalogById.values()).sort((left, right) => left.id - right.id);
      const failures = Array.from(failureByKey.values());
      const backfillState = Object.fromEntries(
        Array.from(backfillStateById.entries())
          .sort((left, right) => left[0] - right[0])
          .map(([itemId, entry]) => [String(itemId), entry])
      );

      await writeJsonAtomic(OUTPUT_PATH, catalog);
      if (failures.length > 0) {
        await writeJsonAtomic(FAILURE_PATH, failures);
      } else {
        await fs.rm(FAILURE_PATH, { force: true });
      }
      await writeJsonAtomic(BACKFILL_STATE_PATH, backfillState);
    });

    return flushQueue;
  };

  try {
    const setupWorkerPage = async () => {
      const page = await browserContext.newPage();
      let ready = false;

      for (let attempt = 0; attempt <= RETRY_LIMIT && !ready; attempt += 1) {
        await page.goto(ROOT_LISTING_URL, {
          waitUntil: "domcontentloaded",
          timeout: REQUEST_TIMEOUT_MS
        });
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        ready = await page
          .waitForFunction(() => typeof window.axios === "function", {
            timeout: 10_000
          })
          .then(() => true)
          .catch(() => false);

        if (!ready) {
          await sleep(500 * (attempt + 1));
        }
      }

      if (!ready) {
        throw new Error("Yami frontend bootstrap did not expose axios in time.");
      }

      return page;
    };
    let dedupedProductUrls = [];
    let remainingProductUrls = [];

    if (REFRESH_MISSING_HIGHLIGHTS && DIRECT_BACKFILL && existingCatalog.length > 0) {
      dedupedProductUrls = Array.from(
        new Map(
          existingCatalog
            .map((item) => {
              const productUrl = typeof item.product_url === "string" && item.product_url.trim()
                ? normalizeProductUrl(item.product_url)
                : null;
              const itemNumber = productUrl ? extractItemNumberFromUrl(productUrl) : null;
              return [itemNumber, productUrl];
            })
            .filter(([itemNumber, url]) => Boolean(itemNumber && url))
        ).values()
      );

      remainingProductUrls = dedupedProductUrls.filter((url) => {
        const itemNumber = extractItemNumberFromUrl(url);
        const itemId = Number.parseInt(itemNumber ?? "", 10);
        const existingItem = catalogById.get(itemId);
        if (!existingItem) {
          return true;
        }

        const backfillState = backfillStateById.get(itemId);
        const needsHighlights =
          !Array.isArray(existingItem.product_highlights) ||
          existingItem.product_highlights.length === 0;
        const needsDetails =
          typeof existingItem.product_details !== "string" ||
          existingItem.product_details.trim() === "";

        return (
          (needsHighlights && !backfillState?.checked_highlights) ||
          (needsDetails && !backfillState?.checked_details)
        );
      });

      if (PRODUCT_LIMIT) {
        remainingProductUrls = remainingProductUrls.slice(0, PRODUCT_LIMIT);
      }

      console.log(
        `Direct backfill mode: ${dedupedProductUrls.length} catalog product URLs loaded. Processing ${remainingProductUrls.length}.`
      );
    } else {
      const listingPage = await browserContext.newPage();
      const listingResults = await collectListingResults(listingPage);
      await listingPage.close().catch(() => {});
      console.log(`Scraped ${listingResults.length} snack listing pages.`);

      for (const result of listingResults) {
        if (result.error) {
          failureByKey.set(result.listingUrl, { listing_url: result.listingUrl, error: result.error });
        }
      }

      dedupedProductUrls = Array.from(
        new Map(
          listingResults
            .flatMap((result) => result.productUrls)
            .map((url) => [extractItemNumberFromUrl(url), url])
            .filter(([itemNumber]) => Boolean(itemNumber))
        ).values()
      );

      const productUrls = PRODUCT_LIMIT
        ? dedupedProductUrls.slice(0, PRODUCT_LIMIT)
        : dedupedProductUrls;
      remainingProductUrls = productUrls.filter((url) => {
        const itemNumber = extractItemNumberFromUrl(url);
        const itemId = Number.parseInt(itemNumber ?? "", 10);
        const existingItem = catalogById.get(itemId);

        if (!existingItem) {
          return true;
        }

        if (
          REFRESH_MISSING_HIGHLIGHTS &&
          (
            !Array.isArray(existingItem.product_highlights) ||
            existingItem.product_highlights.length === 0 ||
            typeof existingItem.product_details !== "string" ||
            existingItem.product_details.trim() === ""
          )
        ) {
          return true;
        }

        return false;
      });

      console.log(
        `Collected ${dedupedProductUrls.length} unique snack product URLs. Processing ${remainingProductUrls.length}.`
      );
    }

    await queueFlush();

    await mapWithPageWorkers(
      remainingProductUrls,
      PRODUCT_CONCURRENCY,
      setupWorkerPage,
      async (page, productUrl) => {
        try {
          const product = await parseProduct(page, productUrl);
          const existingItem = catalogById.get(product.id);
          const existingState = backfillStateById.get(product.id);
          const hadDetails = isNonEmptyString(existingItem?.product_details);
          const hadHighlights = isNonEmptyArray(existingItem?.product_highlights);
          const mergedProduct = mergeCatalogProduct(existingItem, product);
          const hasDetails = isNonEmptyString(mergedProduct.product_details);
          const hasHighlights = isNonEmptyArray(mergedProduct.product_highlights);
          const detailsImproved = !hadDetails && hasDetails;
          const highlightsImproved = !hadHighlights && hasHighlights;
          completed += 1;
          if (detailsImproved) {
            updatedDetails += 1;
          }
          if (highlightsImproved) {
            updatedHighlights += 1;
          }
          if (detailsImproved || highlightsImproved) {
            updatedAny += 1;
          } else {
            unchanged += 1;
          }
          backfillStateById.set(
            product.id,
            createBackfillStateEntry(existingState, {
              checkedDetails: !hadDetails,
              checkedHighlights: !hadHighlights,
              lastStatus: detailsImproved || highlightsImproved ? "updated" : "unchanged",
              lastCheckedAt: new Date().toISOString()
            })
          );
          catalogById.set(product.id, mergedProduct);
          failureByKey.delete(productUrl);

          if (completed % CHECKPOINT_EVERY === 0 || completed === remainingProductUrls.length) {
            await queueFlush();
          }

          if (completed % 25 === 0 || completed === remainingProductUrls.length) {
            console.log(
              `Visited ${completed}/${remainingProductUrls.length} product pages. ` +
              `Real updates: ${updatedAny} (` +
              `details +${updatedDetails}, highlights +${updatedHighlights}, unchanged ${unchanged}, failed ${failed}).`
            );
          }
        } catch (error) {
          completed += 1;
          failed += 1;
          failureByKey.set(productUrl, {
            product_url: productUrl,
            error: error instanceof Error ? error.message : String(error)
          });

          if (completed % CHECKPOINT_EVERY === 0 || completed === remainingProductUrls.length) {
            await queueFlush();
          }

          if (completed % 25 === 0 || completed === remainingProductUrls.length) {
            console.log(
              `Visited ${completed}/${remainingProductUrls.length} product pages. ` +
              `Real updates: ${updatedAny} (` +
              `details +${updatedDetails}, highlights +${updatedHighlights}, unchanged ${unchanged}, failed ${failed}).`
            );
          }
        }
      }
    );
  } finally {
    if (!usesLiveChrome) {
      await browserContext.close();
    }
    await browser.close();
  }

  await queueFlush();
  console.log(`Saved ${catalogById.size} snack products to ${OUTPUT_PATH}.`);
  if (failureByKey.size > 0) {
    console.warn(`Saved ${failureByKey.size} failures to ${FAILURE_PATH}.`);
  }
}

await main();
