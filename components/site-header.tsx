import Link from "next/link";
import { getCurrentProfile } from "@/lib/data";
import { signOut } from "@/lib/actions";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-persimmon text-lg font-bold text-white">
            N
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-ink">Nomi</p>
            <p className="text-xs uppercase tracking-[0.28em] text-ink/50">Snack discovery</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2 text-sm font-medium text-ink">
          <Link href="/" className="rounded-full px-4 py-2 transition hover:bg-white/70">
            Discover
          </Link>
          {profile ? (
            <>
              <Link
                href={`/profile/${profile.username}`}
                className="rounded-full bg-white px-4 py-2 shadow-card transition hover:-translate-y-0.5"
              >
                {profile.displayName || profile.username}
              </Link>
              <form action={signOut}>
                <button className="rounded-full px-4 py-2 transition hover:bg-white/70" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 transition hover:bg-white/70">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-ink px-4 py-2 text-white transition hover:bg-ink/90"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
