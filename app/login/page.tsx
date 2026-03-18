import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export default function LoginPage() {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div className="space-y-5">
        <p className="text-xs uppercase tracking-[0.32em] text-ink/45">Account access</p>
        <h1 className="text-5xl font-semibold tracking-tight text-ink">Come back to your snack trail.</h1>
        <p className="max-w-xl text-base leading-8 text-ink/70">
          Log in to pick up where you left off, update your profile, and keep rating snacks on a 1-10 scale.
        </p>
        <p className="text-sm text-ink/60">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-persimmon">
            Create an account
          </Link>
          .
        </p>
      </div>
      <AuthCard mode="login" />
    </div>
  );
}
