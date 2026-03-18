import { getLocalCatalog } from "@/lib/local-catalog";
import { saveOnboarding } from "@/lib/actions";

const catalog = getLocalCatalog();
const categories = [...new Set(catalog.map((snack) => snack.category))].sort();
const countries = [...new Set(catalog.map((snack) => snack.country))].sort();

export function OnboardingForm() {
  return (
    <form action={saveOnboarding} className="space-y-8 rounded-[32px] bg-white p-8 shadow-card">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Onboarding</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Tune your discovery feed</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
          Pick a few categories and countries you already love. Nomi will use them as your starting point for
          recommendations.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">Favorite categories</legend>
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <label key={category} className="rounded-full border border-black/10 px-4 py-2 text-sm text-ink">
              <input type="checkbox" name="favoriteCategories" value={category} className="mr-2" />
              {category}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">Favorite countries</legend>
        <div className="flex flex-wrap gap-3">
          {countries.map((country) => (
            <label key={country} className="rounded-full border border-black/10 px-4 py-2 text-sm text-ink">
              <input type="checkbox" name="favoriteCountries" value={country} className="mr-2" />
              {country}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="rounded-full bg-persimmon px-6 py-3 text-sm font-semibold text-white transition hover:bg-persimmon/90"
      >
        Save preferences
      </button>
    </form>
  );
}
