import { notFound } from "next/navigation";
import { ProfileEditor } from "@/components/profile-editor";
import { getCurrentUser, getProfileActivity, getProfileByUsername } from "@/lib/data";

type ProfilePageProps = {
  params: Promise<{ username: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const [profile, viewer, activity] = await Promise.all([
    getProfileByUsername(username),
    getCurrentUser(),
    getProfileByUsername(username).then((row) => (row ? getProfileActivity(row.id) : Promise.resolve([]))),
  ]);

  if (!profile) {
    notFound();
  }

  const isOwner = viewer?.id === profile.id;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 pb-24">
      <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-[36px] bg-white p-8 shadow-card">
          <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Profile</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
            {profile.displayName || profile.username}
          </h1>
          <p className="mt-2 text-sm font-medium text-persimmon">@{profile.username}</p>
          <p className="mt-5 text-sm leading-7 text-ink/70">{profile.bio || "No bio yet. Taste profile loading..."}</p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-semibold text-ink">{profile.triedCount}</p>
              <p className="text-sm text-ink/55">Tried</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-ink">{profile.wantToTryCount}</p>
              <p className="text-sm text-ink/55">Want to try</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-ink">{profile.favoriteCount}</p>
              <p className="text-sm text-ink/55">Favorites</p>
            </div>
            <div>
              <p className="text-3xl font-semibold text-ink">{profile.reviewCount}</p>
              <p className="text-sm text-ink/55">Reviews</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[36px] bg-white p-8 shadow-card">
            <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Taste profile</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <h2 className="text-lg font-semibold text-ink">Favorite categories</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.favoriteCategories.length ? (
                    profile.favoriteCategories.map((item) => (
                      <span key={item} className="rounded-full bg-mist px-3 py-2 text-sm text-ink/75">
                        {item}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-ink/55">No favorite categories selected yet.</p>
                  )}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Favorite countries</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.favoriteCountries.length ? (
                    profile.favoriteCountries.map((item) => (
                      <span key={item} className="rounded-full bg-mist px-3 py-2 text-sm text-ink/75">
                        {item}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-ink/55">No favorite countries selected yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[36px] bg-white p-8 shadow-card">
            <p className="text-xs uppercase tracking-[0.28em] text-ink/45">Recent activity</p>
            <div className="mt-5 space-y-4">
              {activity.length ? (
                activity.map((entry) => (
                  <div key={`${entry.type}-${entry.id}`} className="rounded-[24px] bg-mist px-4 py-4 text-sm text-ink/75">
                    {entry.label}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/55">Activity will show up here after saves and reviews.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {isOwner ? <ProfileEditor profile={profile} /> : null}
    </div>
  );
}
