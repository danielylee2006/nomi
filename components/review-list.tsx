import Link from "next/link";
import type { ReviewRecord } from "@/lib/types";

type ReviewListProps = {
  reviews: ReviewRecord[];
};

export function ReviewList({ reviews }: ReviewListProps) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Community notes</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Latest reviews</h2>
      </div>
      {reviews.length ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-[28px] bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-4">
                <Link href={`/profile/${review.username}`} className="text-sm font-semibold text-ink">
                  @{review.username}
                </Link>
                <div className="rounded-full bg-saffron/20 px-3 py-1 text-sm font-semibold text-ink">
                  {review.rating}/10
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-ink/75">{review.reviewText}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-6 py-8 text-sm text-ink/60">
          No reviews yet. Be the first person to put this snack on the map.
        </div>
      )}
    </section>
  );
}
