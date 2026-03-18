import { deleteReview, submitReview } from "@/lib/actions";
import type { ReviewRecord, SnackRecord } from "@/lib/types";

type ReviewFormProps = {
  snack: SnackRecord;
  isAuthenticated: boolean;
  currentUsername?: string | null;
  reviews: ReviewRecord[];
};

export function ReviewForm({ snack, isAuthenticated, currentUsername, reviews }: ReviewFormProps) {
  const existingReview = reviews.find((review) => review.username === currentUsername);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Your take</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Leave a review</h2>
      </div>
      {!isAuthenticated ? (
        <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-card">
          <p className="text-sm leading-6 text-ink/70">Log in to rate this snack and post your own notes.</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-[28px] bg-white p-6 shadow-card">
          <form action={submitReview} className="space-y-4">
            <input type="hidden" name="snackId" value={snack.id} />
            <input type="hidden" name="slug" value={snack.slug} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">Rating</span>
              <input
                type="number"
                name="rating"
                min={1}
                max={10}
                step={1}
                defaultValue={existingReview?.rating}
                className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none ring-0 transition focus:border-persimmon"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">Notes</span>
              <textarea
                name="reviewText"
                rows={5}
                defaultValue={existingReview?.reviewText}
                className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none ring-0 transition focus:border-persimmon"
                placeholder="What stood out? Texture, flavor, nostalgia factor, anything."
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-persimmon px-5 py-3 text-sm font-semibold text-white transition hover:bg-persimmon/90"
            >
              {existingReview ? "Update review" : "Post review"}
            </button>
          </form>
          {existingReview ? (
            <form action={deleteReview}>
              <input type="hidden" name="reviewId" value={existingReview.id} />
              <input type="hidden" name="slug" value={snack.slug} />
              <button
                type="submit"
                className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink"
              >
                Delete review
              </button>
            </form>
          ) : null}
        </div>
      )}
    </section>
  );
}
