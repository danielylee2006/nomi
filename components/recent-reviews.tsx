import Link from "next/link";
import type { ReviewRecord } from "@/lib/types";

type RecentReviewsProps = {
  reviews: ReviewRecord[];
};

export function RecentReviews({ reviews }: RecentReviewsProps) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Fresh notes</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Recent reviews</h2>
      </div>
      {reviews.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-[28px] bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/profile/${review.username}`} className="text-sm font-semibold text-ink">
                  @{review.username}
                </Link>
                <span className="rounded-full bg-saffron/20 px-3 py-1 text-sm font-semibold text-ink">
                  {review.rating}/10
                </span>
              </div>
              <p className="mt-3 line-clamp-4 text-sm leading-6 text-ink/75">{review.reviewText}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-6 py-8 text-sm text-ink/60">
          Reviews from real users will land here as soon as people start posting.
        </div>
      )}
    </section>
  );
}
