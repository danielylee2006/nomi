export type RawSnackRecord = {
  id: number;
  name: string;
  brand: string;
  country: string;
  product_details?: string | null;
  product_highlights?: string[] | null;
  category: string;
  price?: number | null;
  image_url: string[];
  product_url: string;
};

export type SnackRecord = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  country: string;
  countryRaw: string;
  category: string;
  categoryRaw: string;
  price: number | null;
  productDetails: string | null;
  productHighlights: string[];
  description: string;
  primaryImageUrl: string;
  imageUrls: string[];
  sourceProductUrl: string;
  averageRating: number;
  reviewCount: number;
  triedCount: number;
  favoriteCount: number;
  trendingScore: number;
  sourcePayload: RawSnackRecord;
};

export type SnackUserState = {
  snackId: number;
  wantToTry: boolean;
  tried: boolean;
  favorite: boolean;
};

export type ReviewRecord = {
  id: string;
  snackId: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  rating: number;
  reviewText: string;
  createdAt: string;
};

export type ProfileRecord = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  favoriteCategories: string[];
  favoriteCountries: string[];
  triedCount: number;
  wantToTryCount: number;
  favoriteCount: number;
  reviewCount: number;
};

export type ActivityRecord = {
  id: string;
  type: "review" | "save";
  snackId: number;
  snackName: string;
  rating?: number;
  label: string;
  createdAt: string;
};

export type DiscoverPayload = {
  trending: SnackRecord[];
  topRated: SnackRecord[];
  recommended: SnackRecord[];
  recentReviews: ReviewRecord[];
};
