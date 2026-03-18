import { RecentReviews } from "@/components/recent-reviews";
import { SearchBar } from "@/components/search-bar";
import { SnackRail } from "@/components/snack-rail";
import { getCurrentProfile, getDiscoverPayload } from "@/lib/data";

type HomePageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const [payload, profile] = await Promise.all([getDiscoverPayload(query), getCurrentProfile()]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 py-10 pb-24">
      <section className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.32em] text-ink/45">Discovery-first snack social</p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-ink md:text-7xl">
            Find the next snack you’ll obsess over.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-ink/70 md:text-lg">
            Browse a catalog of 2,000+ Asian snacks, save what you want to try, rate what you have tried,
            and build your own taste profile over time.
          </p>
          <SearchBar query={query} />
        </div>

        <div className="rounded-[32px] bg-white/80 p-7 shadow-card">
          <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Your Nomi setup</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div>
              <p className="text-3xl font-semibold text-ink">{profile?.triedCount ?? 0}</p>
              <p className="mt-1 text-sm text-ink/60">Snacks tried</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-ink">{profile?.wantToTryCount ?? 0}</p>
              <p className="mt-1 text-sm text-ink/60">Want to try</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-ink">{profile?.favoriteCount ?? 0}</p>
              <p className="mt-1 text-sm text-ink/60">Favorites</p>
            </div>
          </div>
        </div>
      </section>

      <SnackRail
        eyebrow={query ? "Search results" : "Trending now"}
        title={query ? `Matches for “${query}”` : "Trending snacks"}
        snacks={payload.trending}
        emptyMessage="No snacks matched that search yet. Try a different brand, country, or category."
      />

      <SnackRail
        eyebrow="Community picks"
        title="Top rated"
        snacks={payload.topRated}
        emptyMessage="Top-rated snacks will show up here after the first wave of reviews."
      />

      <SnackRail
        eyebrow="For you"
        title={profile ? "Recommended for your taste" : "Sign in for personalized picks"}
        snacks={profile ? payload.recommended : []}
        emptyMessage="Create an account and set your favorite categories or countries to unlock recommendations."
      />

      <RecentReviews reviews={payload.recentReviews} />
    </div>
  );
}
