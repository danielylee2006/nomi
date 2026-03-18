import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.32em] text-ink/45">404</p>
      <h1 className="text-5xl font-semibold tracking-tight text-ink">That snack slipped off the shelf.</h1>
      <p className="max-w-xl text-base leading-8 text-ink/70">
        The page you were trying to open does not exist yet, or the catalog slug changed after a data refresh.
      </p>
      <Link href="/" className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
        Back to discover
      </Link>
    </div>
  );
}
