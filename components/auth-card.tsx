import { signIn, signInWithGoogle, signUp } from "@/lib/actions";

type AuthCardProps = {
  mode: "login" | "signup";
};

export function AuthCard({ mode }: AuthCardProps) {
  const action = mode === "login" ? signIn : signUp;
  const title = mode === "login" ? "Welcome back to Nomi" : "Create your Nomi account";
  const cta = mode === "login" ? "Log in" : "Sign up";

  return (
    <div className="rounded-[32px] bg-white p-8 shadow-card">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-ink/45">{mode === "login" ? "Log in" : "Sign up"}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      </div>

      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="origin" value={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"} />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            name="email"
            className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-persimmon"
            placeholder="you@example.com"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Password</span>
          <input
            type="password"
            name="password"
            className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-persimmon"
            placeholder="At least 8 characters"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
        >
          {cta}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-ink/35">
        <div className="h-px flex-1 bg-black/10" />
        Or
        <div className="h-px flex-1 bg-black/10" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="origin" value={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"} />
        <button
          type="submit"
          className="w-full rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-black/20"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
