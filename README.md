# Nomi

Nomi is a discovery-first social web app for Asian snacks. This repo now contains:

- a Next.js App Router frontend
- a Supabase schema with RLS and aggregate triggers
- a catalog normalization script that turns the scraper JSON into a `supabase/seed.sql` import
- the original scraper utilities that produced the dataset

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` if you later add admin scripts

3. Make sure the scraper outputs exist in [`scrapers`](/Users/daniellee/Documents/Programming/nomi/scrapers), then run the catalog seed generator:

```bash
npm run seed:catalog
```

4. Apply the schema and seed in Supabase:

- Run [supabase/migrations/20260318_nomi_schema.sql](/Users/daniellee/Documents/Programming/nomi/supabase/migrations/20260318_nomi_schema.sql)
- Run the generated `supabase/seed.sql`

5. Start the app:

```bash
npm run dev
```

## MVP features implemented

- public discover page with search, trending, top-rated, recommendation rail, and recent reviews
- snack detail pages with image gallery, save states, and reviews
- profile pages with editable owner profile and recent activity
- email/password + Google auth flows wired for Supabase
- onboarding preferences for favorite categories and countries
- normalized seed pipeline from the provided snack catalog
