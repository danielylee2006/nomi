import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export default function SignupPage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div className="space-y-5">
        <p className="text-xs uppercase tracking-[0.32em] text-ink/45">Get started</p>
        <h1 className="text-5xl font-semibold tracking-tight text-ink">Build your taste map on Nomi.</h1>
        <p className="max-w-xl text-base leading-8 text-ink/70">
          Save what you want to try, mark what you have tasted, and rate each snack with the nuance of a 1-10
          score.
        </p>
        <p className="text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-persimmon">
            Log in
          </Link>
          .
        </p>
      </div>
      <AuthCard mode="signup" />
    </div>
  );
}
