import { updateProfile } from "@/lib/actions";
import type { ProfileRecord } from "@/lib/types";

type ProfileEditorProps = {
  profile: ProfileRecord;
};

export function ProfileEditor({ profile }: ProfileEditorProps) {
  return (
    <form action={updateProfile} className="space-y-4 rounded-[28px] bg-white p-6 shadow-card">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Edit profile</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Make it yours</h2>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">Username</span>
        <input
          type="text"
          name="username"
          defaultValue={profile.username}
          className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-persimmon"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">Display name</span>
        <input
          type="text"
          name="displayName"
          defaultValue={profile.displayName ?? ""}
          className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-persimmon"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">Bio</span>
        <textarea
          name="bio"
          rows={4}
          defaultValue={profile.bio ?? ""}
          className="w-full rounded-2xl border border-black/10 px-4 py-3 outline-none transition focus:border-persimmon"
        />
      </label>
      <button
        type="submit"
        className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
      >
        Save profile
      </button>
    </form>
  );
}
