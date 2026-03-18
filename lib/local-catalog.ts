import rawCatalog from "../scrapers/snack-catalog.final.json";
import { normalizeSnackRecord, searchSnacks, sortTopRated, sortTrending } from "@/lib/catalog-normalization";
import type { RawSnackRecord, SnackRecord } from "@/lib/types";

const normalizedCatalog = (rawCatalog as RawSnackRecord[]).map(normalizeSnackRecord);

export function getLocalCatalog() {
  return normalizedCatalog;
}

export function getLocalSnackBySlug(slug: string) {
  return normalizedCatalog.find((snack) => snack.slug === slug) ?? null;
}

export function getLocalSnackById(id: number) {
  return normalizedCatalog.find((snack) => snack.id === id) ?? null;
}

export function getLocalDiscoverData(query?: string) {
  const filtered = query ? searchSnacks(normalizedCatalog, query) : normalizedCatalog;

  return {
    trending: sortTrending(filtered).slice(0, 8),
    topRated: sortTopRated(filtered).slice(0, 8),
  };
}

export function getLocalRecommendations(preferences?: {
  favoriteCategories?: string[];
  favoriteCountries?: string[];
}) {
  const categories = new Set(preferences?.favoriteCategories ?? []);
  const countries = new Set(preferences?.favoriteCountries ?? []);

  const scored = normalizedCatalog.map((snack) => {
    let score = snack.trendingScore;
    if (categories.has(snack.category)) {
      score += 2.2;
    }
    if (countries.has(snack.country)) {
      score += 1.8;
    }

    return { snack, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => entry.snack);
}

export function getLocalRelatedSnacks(snack: SnackRecord) {
  return normalizedCatalog
    .filter((candidate) => candidate.id !== snack.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.category === snack.category) {
        score += 2;
      }
      if (candidate.country === snack.country) {
        score += 1.5;
      }
      if (candidate.brand === snack.brand) {
        score += 1.2;
      }
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || b.candidate.trendingScore - a.candidate.trendingScore)
    .slice(0, 4)
    .map((entry) => entry.candidate);
}
