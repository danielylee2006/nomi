import Image from "next/image";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/review-form";
import { ReviewList } from "@/components/review-list";
import { SnackRail } from "@/components/snack-rail";
import { SnackStateForm } from "@/components/snack-state-form";
import { getCurrentProfile, getCurrentUser, getRelatedSnacks, getSnackBySlug, getSnackReviews, getSnackUserState } from "@/lib/data";
import { formatPrice, formatRating } from "@/lib/utils";

type SnackPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SnackPage({ params }: SnackPageProps) {
  const { slug } = await params;
  const snack = await getSnackBySlug(slug);

  if (!snack) {
    notFound();
  }

  const [reviews, related, user, state, profile] = await Promise.all([
    getSnackReviews(snack.id),
    getRelatedSnacks(snack),
    getCurrentUser(),
    getSnackUserState(snack.id),
    getCurrentProfile(),
  ]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-14 px-6 py-10 pb-24">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="relative aspect-square overflow-hidden rounded-[36px] bg-white shadow-card">
            <Image
              src={snack.primaryImageUrl}
              alt={snack.name}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 640px"
            />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {snack.imageUrls.slice(0, 4).map((image) => (
              <div key={image} className="relative aspect-square overflow-hidden rounded-[24px] bg-white shadow-card">
                <Image src={image} alt={snack.name} fill className="object-cover" sizes="160px" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-4 rounded-[36px] bg-white p-8 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
                {snack.brand}
              </span>
              <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
                {snack.country}
              </span>
              <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
                {snack.category}
              </span>
            </div>
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink">{snack.name}</h1>
              <p className="mt-4 text-base leading-8 text-ink/70">{snack.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-3xl font-semibold text-ink">{formatRating(snack.averageRating)}</p>
                <p className="text-sm text-ink/55">Average rating</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-ink">{snack.reviewCount}</p>
                <p className="text-sm text-ink/55">Reviews</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-ink">{snack.favoriteCount}</p>
                <p className="text-sm text-ink/55">Favorites</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-ink">{formatPrice(snack.price)}</p>
                <p className="text-sm text-ink/55">Reference price</p>
              </div>
            </div>
          </div>

          <SnackStateForm snack={snack} state={state} isAuthenticated={Boolean(user)} />
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <ReviewForm
          snack={snack}
          isAuthenticated={Boolean(user)}
          currentUsername={profile?.username}
          reviews={reviews}
        />
        <ReviewList reviews={reviews} />
      </section>

      <SnackRail
        eyebrow="Keep exploring"
        title="More like this"
        snacks={related}
        emptyMessage="Related snacks will appear here once the catalog is seeded."
      />
    </div>
  );
}
