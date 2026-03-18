import type { RawSnackRecord, SnackRecord } from "@/lib/types";
import { slugify, uniqueStrings } from "@/lib/utils";

const COUNTRY_MAP: Record<string, string> = {
  Itlay: "Italy",
  Philippine: "Philippines",
  "Japan Packaging Style Bag": "Japan",
  "Japan Packaging Style Box": "Japan",
  "Taiwan Packaging Style Bag": "Taiwan",
  "China Packaging Style Large": "China",
  "China Packaging Style Small": "China",
  "China Packaging Style Bag": "China",
};

const CATEGORY_MAP: Record<string, string> = {
  "Dried & Candied Fruit and Vegatable": "Dried & Candied Fruit and Vegetable",
};

export function normalizeCountry(rawCountry: string) {
  const trimmed = rawCountry.trim();
  if (COUNTRY_MAP[trimmed]) {
    return COUNTRY_MAP[trimmed];
  }

  return trimmed.replace(/\s+Packaging Style.*$/i, "").trim();
}

export function normalizeCategory(rawCategory: string) {
  const trimmed = rawCategory.trim();
  return CATEGORY_MAP[trimmed] ?? trimmed;
}

export function pickDescription(record: RawSnackRecord) {
  if (record.product_details?.trim()) {
    return record.product_details.trim();
  }

  const firstHighlight = record.product_highlights?.find((item) => item?.trim());
  if (firstHighlight) {
    return firstHighlight.trim();
  }

  return "A snack worth checking out on Nomi.";
}

function computeSeedMetrics(record: RawSnackRecord) {
  const detailWeight = record.product_details?.trim() ? 1.35 : 0.6;
  const highlightWeight = Math.min(record.product_highlights?.length ?? 0, 3) * 0.35;
  const imageWeight = Math.min(record.image_url?.length ?? 0, 6) * 0.12;
  const affordabilityWeight = record.price ? Math.max(0.4, 8 / (record.price + 1)) : 0.8;
  const textWeight = Math.min(record.name.length / 100, 0.8);

  const trendingScore = Number(
    (detailWeight + highlightWeight + imageWeight + affordabilityWeight + textWeight).toFixed(2),
  );

  const reviewCount = Math.max(4, Math.round(trendingScore * 9));
  const favoriteCount = Math.max(2, Math.round(trendingScore * 5));
  const triedCount = Math.max(3, Math.round(trendingScore * 7));
  const averageRating = Number(Math.min(9.6, 6.9 + trendingScore / 2.8).toFixed(1));

  return {
    trendingScore,
    reviewCount,
    favoriteCount,
    triedCount,
    averageRating,
  };
}

export function normalizeSnackRecord(record: RawSnackRecord): SnackRecord {
  const imageUrls = uniqueStrings(record.image_url ?? []);
  const metrics = computeSeedMetrics(record);

  return {
    id: record.id,
    slug: `${slugify(record.name)}-${record.id}`,
    name: record.name,
    brand: record.brand,
    country: normalizeCountry(record.country),
    countryRaw: record.country,
    category: normalizeCategory(record.category),
    categoryRaw: record.category,
    price: record.price ?? null,
    productDetails: record.product_details?.trim() ?? null,
    productHighlights: uniqueStrings(record.product_highlights ?? []),
    description: pickDescription(record),
    primaryImageUrl: imageUrls[0] ?? "",
    imageUrls,
    sourceProductUrl: record.product_url,
    averageRating: metrics.averageRating,
    reviewCount: metrics.reviewCount,
    triedCount: metrics.triedCount,
    favoriteCount: metrics.favoriteCount,
    trendingScore: metrics.trendingScore,
    sourcePayload: record,
  };
}

export function sortTrending(snacks: SnackRecord[]) {
  return [...snacks].sort(
    (a, b) =>
      b.trendingScore - a.trendingScore ||
      b.favoriteCount - a.favoriteCount ||
      b.triedCount - a.triedCount,
  );
}

export function sortTopRated(snacks: SnackRecord[]) {
  return [...snacks].sort(
    (a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount,
  );
}

export function searchSnacks(snacks: SnackRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return snacks;
  }

  return snacks.filter((snack) => {
    const haystack = [
      snack.name,
      snack.brand,
      snack.country,
      snack.category,
      snack.description,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
