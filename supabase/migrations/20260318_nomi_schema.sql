create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  bio text,
  avatar_url text,
  favorite_categories text[] not null default '{}',
  favorite_countries text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.snacks (
  id bigint primary key,
  slug text not null unique,
  name text not null,
  brand text not null,
  country text not null,
  country_raw text not null,
  category text not null,
  category_raw text not null,
  price numeric(10, 2),
  product_details text,
  product_highlights text[] not null default '{}',
  description text not null,
  primary_image_url text not null,
  image_urls text[] not null default '{}',
  source_product_url text not null,
  source_payload jsonb not null,
  average_rating numeric(4, 2) not null default 0,
  review_count integer not null default 0,
  tried_count integer not null default 0,
  favorite_count integer not null default 0,
  trending_score numeric(8, 2) not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.snack_user_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snack_id bigint not null references public.snacks (id) on delete cascade,
  want_to_try boolean not null default false,
  tried boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, snack_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snack_id bigint not null references public.snacks (id) on delete cascade,
  rating integer not null check (rating between 1 and 10),
  review_text text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, snack_id)
);

create index if not exists idx_snacks_country on public.snacks (country);
create index if not exists idx_snacks_category on public.snacks (category);
create index if not exists idx_snacks_slug on public.snacks (slug);
create index if not exists idx_reviews_snack_id on public.reviews (snack_id);
create index if not exists idx_reviews_user_id on public.reviews (user_id);
create index if not exists idx_states_user_id on public.snack_user_states (user_id);
create index if not exists idx_states_snack_id on public.snack_user_states (snack_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'nomi-user-' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.refresh_snack_metrics(target_snack_id bigint)
returns void
language plpgsql
as $$
declare
  rating_average numeric(4, 2);
  rating_count integer;
  tried_total integer;
  favorite_total integer;
  score numeric(8, 2);
begin
  select coalesce(avg(rating), 0), count(*)
  into rating_average, rating_count
  from public.reviews
  where snack_id = target_snack_id;

  select count(*) filter (where tried), count(*) filter (where favorite)
  into tried_total, favorite_total
  from public.snack_user_states
  where snack_id = target_snack_id;

  score := coalesce((tried_total * 1.4) + (favorite_total * 2.2) + (rating_count * 1.1) + rating_average, 0);

  update public.snacks
  set
    average_rating = rating_average,
    review_count = rating_count,
    tried_count = coalesce(tried_total, 0),
    favorite_count = coalesce(favorite_total, 0),
    trending_score = score
  where id = target_snack_id;
end;
$$;

create or replace function public.on_review_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_snack_metrics(coalesce(new.snack_id, old.snack_id));
  return coalesce(new, old);
end;
$$;

create or replace function public.on_state_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_snack_metrics(coalesce(new.snack_id, old.snack_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists snacks_set_updated_at on public.snacks;
create trigger snacks_set_updated_at
before update on public.snacks
for each row
execute function public.set_updated_at();

drop trigger if exists snack_user_states_set_updated_at on public.snack_user_states;
create trigger snack_user_states_set_updated_at
before update on public.snack_user_states
for each row
execute function public.set_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

drop trigger if exists reviews_refresh_metrics on public.reviews;
create trigger reviews_refresh_metrics
after insert or update or delete on public.reviews
for each row
execute function public.on_review_change();

drop trigger if exists states_refresh_metrics on public.snack_user_states;
create trigger states_refresh_metrics
after insert or update or delete on public.snack_user_states
for each row
execute function public.on_state_change();

alter table public.profiles enable row level security;
alter table public.snacks enable row level security;
alter table public.snack_user_states enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Public snacks are viewable by everyone" on public.snacks;
create policy "Public snacks are viewable by everyone"
on public.snacks for select
using (true);

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
on public.profiles for select
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Reviews are viewable by everyone"
on public.reviews for select
using (true);

drop policy if exists "Users can manage own reviews" on public.reviews;
create policy "Users can manage own reviews"
on public.reviews for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own snack states" on public.snack_user_states;
create policy "Users can read own snack states"
on public.snack_user_states for select
using (auth.uid() = user_id);

drop policy if exists "Users can manage own snack states" on public.snack_user_states;
create policy "Users can manage own snack states"
on public.snack_user_states for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
