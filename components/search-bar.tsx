type SearchBarProps = {
  query?: string;
};

export function SearchBar({ query }: SearchBarProps) {
  return (
    <form action="/" className="flex w-full max-w-3xl items-center gap-3 rounded-[28px] border border-black/10 bg-white px-4 py-4 shadow-card">
      <input
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search snacks, brands, countries, or categories"
        className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink/40"
      />
      <button
        type="submit"
        className="rounded-full bg-persimmon px-5 py-3 text-sm font-semibold text-white transition hover:bg-persimmon/90"
      >
        Search
      </button>
    </form>
  );
}
