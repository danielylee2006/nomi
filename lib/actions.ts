"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, getSnackBySlug } from "@/lib/data";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const reviewSchema = z.object({
  snackId: z.coerce.number(),
  slug: z.string().min(1),
  rating: z.coerce.number().min(1).max(10),
  reviewText: z.string().trim().min(8).max(600),
});

const snackStateSchema = z.object({
  snackId: z.coerce.number(),
  slug: z.string().min(1),
  field: z.enum(["want_to_try", "tried", "favorite"]),
  value: z.enum(["true", "false"]),
});

const onboardingSchema = z.object({
  favoriteCategories: z.array(z.string()).max(5).default([]),
  favoriteCountries: z.array(z.string()).max(5).default([]),
});

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  displayName: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(280).optional(),
});

async function requireSupabase() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase is not configured yet. Add your environment variables first.");
  }

  return supabase;
}

export async function signUp(formData: FormData) {
  const supabase = await requireSupabase();
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid sign-up input.");
  }

  const origin = (formData.get("origin") as string) || "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  redirect("/onboarding");
}

export async function signIn(formData: FormData) {
  const supabase = await requireSupabase();
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid login input.");
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    throw new Error(error.message);
  }

  redirect("/");
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await requireSupabase();
  const origin = (formData.get("origin") as string) || "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect("/login");
}

export async function signOut() {
  const supabase = await requireSupabase();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateSnackState(formData: FormData) {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = snackStateSchema.safeParse({
    snackId: formData.get("snackId"),
    slug: formData.get("slug"),
    field: formData.get("field"),
    value: formData.get("value"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid snack state request.");
  }

  const { snackId, slug, field, value } = parsed.data;
  const desiredValue = value === "true";

  const { data: existing } = await supabase
    .from("snack_user_states")
    .select("id, want_to_try, tried, favorite")
    .eq("user_id", user.id)
    .eq("snack_id", snackId)
    .single();

  const payload = {
    user_id: user.id,
    snack_id: snackId,
    want_to_try: existing?.want_to_try ?? false,
    tried: existing?.tried ?? false,
    favorite: existing?.favorite ?? false,
    [field]: desiredValue,
  };

  const { error } = await supabase.from("snack_user_states").upsert(payload, {
    onConflict: "user_id,snack_id",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/snacks/${slug}`);
  revalidatePath("/");
  redirect(`/snacks/${slug}`);
}

export async function submitReview(formData: FormData) {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = reviewSchema.safeParse({
    snackId: formData.get("snackId"),
    slug: formData.get("slug"),
    rating: formData.get("rating"),
    reviewText: formData.get("reviewText"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid review.");
  }

  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      snack_id: parsed.data.snackId,
      rating: parsed.data.rating,
      review_text: parsed.data.reviewText,
    },
    { onConflict: "user_id,snack_id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/snacks/${parsed.data.slug}`);
  revalidatePath("/");
  redirect(`/snacks/${parsed.data.slug}`);
}

export async function deleteReview(formData: FormData) {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const reviewId = formData.get("reviewId");
  const slug = String(formData.get("slug") ?? "");

  const { error } = await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", user.id);
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/snacks/${slug}`);
  redirect(`/snacks/${slug}`);
}

export async function saveOnboarding(formData: FormData) {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = onboardingSchema.safeParse({
    favoriteCategories: formData.getAll("favoriteCategories"),
    favoriteCountries: formData.getAll("favoriteCountries"),
  });

  if (!parsed.success) {
    throw new Error("Invalid onboarding preferences.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      favorite_categories: parsed.data.favoriteCategories,
      favorite_countries: parsed.data.favoriteCountries,
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  redirect("/");
}

export async function updateProfile(formData: FormData) {
  const supabase = await requireSupabase();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid profile update.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: parsed.data.username,
      display_name: parsed.data.displayName || null,
      bio: parsed.data.bio || null,
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/profile/${parsed.data.username}`);
  redirect(`/profile/${parsed.data.username}`);
}

export async function getSnackActionTarget(slug: string) {
  const snack = await getSnackBySlug(slug);
  if (!snack) {
    throw new Error("Snack not found.");
  }

  return snack;
}
