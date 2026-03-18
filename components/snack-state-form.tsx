import { updateSnackState } from "@/lib/actions";
import type { SnackRecord, SnackUserState } from "@/lib/types";

type SnackStateFormProps = {
  snack: SnackRecord;
  state: SnackUserState | null;
  isAuthenticated: boolean;
};

const options = [
  { key: "want_to_try", label: "Want to Try" },
  { key: "tried", label: "Tried" },
  { key: "favorite", label: "Favorite" },
] as const;

export function SnackStateForm({ snack, state, isAuthenticated }: SnackStateFormProps) {
  if (!isAuthenticated) {
    return (
      <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-card">
        <p className="text-sm leading-6 text-ink/70">
          Sign in to save this snack, mark it tried, or add it to favorites.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const currentValue =
          option.key === "want_to_try"
            ? state?.wantToTry
            : option.key === "tried"
              ? state?.tried
              : state?.favorite;

        return (
          <form key={option.key} action={updateSnackState}>
            <input type="hidden" name="snackId" value={snack.id} />
            <input type="hidden" name="slug" value={snack.slug} />
            <input type="hidden" name="field" value={option.key} />
            <input type="hidden" name="value" value={currentValue ? "false" : "true"} />
            <button
              type="submit"
              className={`w-full rounded-[22px] border px-4 py-4 text-left text-sm font-semibold transition ${
                currentValue
                  ? "border-moss bg-moss text-white"
                  : "border-black/10 bg-white text-ink hover:border-black/20"
              }`}
            >
              {currentValue ? "Saved to" : "Add to"} {option.label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
