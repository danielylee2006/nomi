import fs from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const sourcePath = path.join(workspaceRoot, "scrapers", "snack-catalog.final.json");
const outputPath = path.join(workspaceRoot, "supabase", "seed.sql");

const countryMap = new Map([
  ["Itlay", "Italy"],
  ["Philippine", "Philippines"],
  ["Japan Packaging Style Bag", "Japan"],
  ["Japan Packaging Style Box", "Japan"],
  ["Taiwan Packaging Style Bag", "Taiwan"],
  ["China Packaging Style Large", "China"],
  ["China Packaging Style Small", "China"],
  ["China Packaging Style Bag", "China"],
]);

const categoryMap = new Map([["Dried & Candied Fruit and Vegatable", "Dried & Candied Fruit and Vegetable"]]);

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCountry(rawCountry) {
  if (countryMap.has(rawCountry)) {
    return countryMap.get(rawCountry);
  }

  return rawCountry.replace(/\s+Packaging Style.*$/i, "").trim();
}

function normalizeCategory(rawCategory) {
  return categoryMap.get(rawCategory) ?? rawCategory;
}

function pickDescription(record) {
  if (record.product_details?.trim()) {
    return record.product_details.trim();
  }

  const firstHighlight = record.product_highlights?.find((item) => item?.trim());
  return firstHighlight?.trim() ?? "A snack worth checking out on Nomi.";
}

function computeSeedMetrics(record) {
  const detailWeight = record.product_details?.trim() ? 1.35 : 0.6;
  const highlightWeight = Math.min(record.product_highlights?.length ?? 0, 3) * 0.35;
  const imageWeight = Math.min(record.image_url?.length ?? 0, 6) * 0.12;
  const affordabilityWeight = record.price ? Math.max(0.4, 8 / (record.price + 1)) : 0.8;
  const textWeight = Math.min(record.name.length / 100, 0.8);
  const trendingScore = Number(
    (detailWeight + highlightWeight + imageWeight + affordabilityWeight + textWeight).toFixed(2),
  );

  return {
    averageRating: Number(Math.min(9.6, 6.9 + trendingScore / 2.8).toFixed(1)),
    reviewCount: Math.max(4, Math.round(trendingScore * 9)),
    triedCount: Math.max(3, Math.round(trendingScore * 7)),
    favoriteCount: Math.max(2, Math.round(trendingScore * 5)),
    trendingScore,
  };
}

function escapeSqlString(value) {
  return value.replace(/'/g, "''");
}

function sqlText(value) {
  if (value == null) {
    return "null";
  }

  return `'${escapeSqlString(String(value))}'`;
}

function sqlJson(value) {
  return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`;
}

function sqlTextArray(values) {
  const safeValues = (values ?? []).filter(Boolean).map((item) => `"${String(item).replace(/"/g, '\\"')}"`);
  return `ARRAY[${safeValues.map((item) => sqlText(item.slice(1, -1))).join(", ")}]::text[]`;
}

function normalizeRecord(record) {
  const imageUrls = [...new Set(record.image_url ?? [])];
  const metrics = computeSeedMetrics(record);

  return {
    id: record.id,
    slug: `${slugify(record.name)}-${record.id}`,
    name: record.name,
    brand: record.brand,
    country: normalizeCountry(record.country),
    country_raw: record.country,
    category: normalizeCategory(record.category),
    category_raw: record.category,
    price: record.price ?? null,
    product_details: record.product_details?.trim() ?? null,
    product_highlights: [...new Set(record.product_highlights ?? [])],
    description: pickDescription(record),
    primary_image_url: imageUrls[0] ?? "",
    image_urls: imageUrls,
    source_product_url: record.product_url,
    source_payload: record,
    average_rating: metrics.averageRating,
    review_count: metrics.reviewCount,
    tried_count: metrics.triedCount,
    favorite_count: metrics.favoriteCount,
    trending_score: metrics.trendingScore,
  };
}

const rawCatalog = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const records = rawCatalog.map(normalizeRecord);

const insertStatements = records.map((record) => {
  return `(
    ${record.id},
    ${sqlText(record.slug)},
    ${sqlText(record.name)},
    ${sqlText(record.brand)},
    ${sqlText(record.country)},
    ${sqlText(record.country_raw)},
    ${sqlText(record.category)},
    ${sqlText(record.category_raw)},
    ${record.price ?? "null"},
    ${sqlText(record.product_details)},
    ${sqlTextArray(record.product_highlights)},
    ${sqlText(record.description)},
    ${sqlText(record.primary_image_url)},
    ${sqlTextArray(record.image_urls)},
    ${sqlText(record.source_product_url)},
    ${sqlJson(record.source_payload)},
    ${record.average_rating},
    ${record.review_count},
    ${record.tried_count},
    ${record.favorite_count},
    ${record.trending_score}
  )`;
});

const sql = `truncate table public.snack_user_states restart identity cascade;
truncate table public.reviews restart identity cascade;
truncate table public.snacks restart identity cascade;

insert into public.snacks (
  id,
  slug,
  name,
  brand,
  country,
  country_raw,
  category,
  category_raw,
  price,
  product_details,
  product_highlights,
  description,
  primary_image_url,
  image_urls,
  source_product_url,
  source_payload,
  average_rating,
  review_count,
  tried_count,
  favorite_count,
  trending_score
)
values
${insertStatements.join(",\n")};
`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, sql);

console.log(`Wrote ${records.length} normalized snacks to ${outputPath}`);
