import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(price: number | null | undefined) {
  if (price == null) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function formatRating(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) {
    return "New";
  }

  return value.toFixed(1);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
