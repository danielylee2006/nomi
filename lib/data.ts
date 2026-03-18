import { cache } from "react";
import { getLocalDiscoverData, getLocalRecommendations, getLocalRelatedSnacks, getLocalSnackBySlug } from "@/lib/local-catalog";
import type {
  ActivityRecord,
  DiscoverPayload,
  ProfileRecord,
  ReviewRecord,
  SnackRecord,
  SnackUserState,
} from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchSnacks, sortTopRated, sortTrending } from "@/lib/catalog-normalization";

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  favorite_categories: string[] | null;
  favorite_countries: string[] | null;
};

function getSingleProfile(
  profile: { username: string; avatar_url: string | null }[] | { username: string; avatar_url: string | null } | null,
) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

function getSingleSnack(row: { name: string }[] | { name: string } | null) {
  if (Array.isArray(row)) {
    return row[0] ?? null;
  }

  return row;
}

function toReviewRecord(row: {
  id: string;
  snack_id: number;
  user_id: string;
  rating: number;
  review_text: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null }[] | { username: string; avatar_url: string | null } | null;
}): ReviewRecord {
  const profile = getSingleProfile(row.profiles);

  return {
    id: row.id,
    snackId: row.snack_id,
    userId: row.user_id,
    username: profile?.username ?? "nomi-user",
    avatarUrl: profile?.avatar_url ?? null,
    rating: row.rating,
    reviewText: row.review_text,
    createdAt: row.created_at,
  };
}

function toProfileRecord(
  profile: ProfileRow,
  counts?: {
    triedCount: number;
    wantToTryCount: number;
    favoriteCount: number;
    reviewCount: number;
  },
): ProfileRecord {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    favoriteCategories: profile.favorite_categories ?? [],
    favoriteCountries: profile.favorite_countries ?? [],
    triedCount: counts?.triedCount ?? 0,
    wantToTryCount: counts?.wantToTryCount ?? 0,
    favoriteCount: counts?.favoriteCount ?? 0,
    reviewCount: counts?.reviewCount ?? 0,
  };
}

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  if (!user || !supabase) {
    return null;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, favorite_categories, favorite_countries")
    .eq("id", user.id)
    .single();

  if (!data) {
    return null;
  }

  const [stateCounts, reviewCount] = await Promise.all([
    supabase
      .from("snack_user_states")
      .select("want_to_try, tried, favorite")
      .eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const states = stateCounts.data ?? [];

  return toProfileRecord(data, {
    triedCount: states.filter((row) => row.tried).length,
    wantToTryCount: states.filter((row) => row.want_to_try).length,
    favoriteCount: states.filter((row) => row.favorite).length,
    reviewCount: reviewCount.count ?? 0,
  });
});

export const getDiscoverPayload = cache(async (query?: string): Promise<DiscoverPayload> => {
  const supabase = await createSupabaseServerClient();
  const profile = await getCurrentProfile();

  if (!supabase) {
    const local = getLocalDiscoverData(query);
    return {
      trending: local.trending,
      topRated: local.topRated,
      recommended: getLocalRecommendations(profile ?? undefined),
      recentReviews: [],
    };
  }

  const search = query?.trim();
  let snacksQuery = supabase.from("snacks").select("*").limit(search ? 60 : 24);
  if (search) {
    snacksQuery = snacksQuery.or(`name.ilike.%${search}%,brand.ilike.%${search}%`);
  }

  const [snacksResult, recentReviewsResult] = await Promise.all([
    snacksQuery,
    supabase
      .from("reviews")
      .select("id, snack_id, user_id, rating, review_text, created_at, profiles(username, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const snacks = (snacksResult.data as SnackRecord[] | null) ?? [];
  const filtered = search ? searchSnacks(snacks, search) : snacks;

  return {
    trending: sortTrending(filtered).slice(0, 8),
    topRated: sortTopRated(filtered).slice(0, 8),
    recommended: profile ? getLocalRecommendations(profile) : [],
    recentReviews: (recentReviewsResult.data ?? []).map(toReviewRecord),
  };
});

export const getSnackBySlug = cache(async (slug: string) => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return getLocalSnackBySlug(slug);
  }

  const { data } = await supabase.from("snacks").select("*").eq("slug", slug).single();
  if (data) {
    return data as SnackRecord;
  }

  return getLocalSnackBySlug(slug);
});

export const getSnackReviews = cache(async (snackId: number) => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [] as ReviewRecord[];
  }

  const { data } = await supabase
    .from("reviews")
    .select("id, snack_id, user_id, rating, review_text, created_at, profiles(username, avatar_url)")
    .eq("snack_id", snackId)
    .order("created_at", { ascending: false });

  return (data ?? []).map(toReviewRecord);
});

export const getSnackUserState = cache(async (snackId: number) => {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  if (!user || !supabase) {
    return null;
  }

  const { data } = await supabase
    .from("snack_user_states")
    .select("snack_id, want_to_try, tried, favorite")
    .eq("user_id", user.id)
    .eq("snack_id", snackId)
    .single();

  if (!data) {
    return null;
  }

  return {
    snackId: data.snack_id,
    wantToTry: data.want_to_try,
    tried: data.tried,
    favorite: data.favorite,
  } satisfies SnackUserState;
});

export const getRelatedSnacks = cache(async (snack: SnackRecord) => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return getLocalRelatedSnacks(snack);
  }

  const { data } = await supabase
    .from("snacks")
    .select("*")
    .neq("id", snack.id)
    .or(`category.eq.${snack.category},country.eq.${snack.country},brand.eq.${snack.brand}`)
    .limit(4);

  return ((data as SnackRecord[] | null) ?? getLocalRelatedSnacks(snack)).slice(0, 4);
});

export const getProfileByUsername = cache(async (username: string) => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, favorite_categories, favorite_countries")
    .eq("username", username)
    .single();

  if (!profile) {
    return null;
  }

  const [statesResult, reviewCountResult] = await Promise.all([
    supabase.from("snack_user_states").select("want_to_try, tried, favorite, updated_at").eq("user_id", profile.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
  ]);

  const states = statesResult.data ?? [];
  return toProfileRecord(profile, {
    triedCount: states.filter((row) => row.tried).length,
    wantToTryCount: states.filter((row) => row.want_to_try).length,
    favoriteCount: states.filter((row) => row.favorite).length,
    reviewCount: reviewCountResult.count ?? 0,
  });
});

export const getProfileActivity = cache(async (profileId: string): Promise<ActivityRecord[]> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const [reviewsResult, statesResult] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, snack_id, rating, created_at, snacks(name)")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("snack_user_states")
      .select("id, snack_id, want_to_try, tried, favorite, updated_at, snacks(name)")
      .eq("user_id", profileId)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const reviewActivity = (reviewsResult.data ?? []).map((row) => {
    const snack = getSingleSnack(row.snacks as { name: string }[] | { name: string } | null);
    return {
      id: row.id,
      type: "review" as const,
      snackId: row.snack_id,
      snackName: snack?.name ?? "Unknown snack",
      rating: row.rating,
      label: `Reviewed ${snack?.name ?? "a snack"} with a ${row.rating}/10`,
      createdAt: row.created_at,
    };
  });

  const saveActivity = (statesResult.data ?? []).flatMap((row) => {
    const snack = getSingleSnack(row.snacks as { name: string }[] | { name: string } | null);
    const snackName = snack?.name ?? "Unknown snack";
    const base = {
      id: row.id,
      type: "save" as const,
      snackId: row.snack_id,
      snackName,
      createdAt: row.updated_at,
    };

    if (row.favorite) {
      return [{ ...base, label: `Favorited ${snackName}` }];
    }
    if (row.tried) {
      return [{ ...base, label: `Marked ${snackName} as tried` }];
    }
    if (row.want_to_try) {
      return [{ ...base, label: `Saved ${snackName} to Want to Try` }];
    }
    return [];
  });

  return [...reviewActivity, ...saveActivity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
});
