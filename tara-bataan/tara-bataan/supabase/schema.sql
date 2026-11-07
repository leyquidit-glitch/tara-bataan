-- =====================================================================
-- Tara Bataan: database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run once on a fresh project. (Already applied to your Tara Bataan project.)
-- =====================================================================

-- ---------- 1. Profiles (one per logged-in user) ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  phone text,
  role text not null default 'owner' check (role in ('owner','admin')),
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- ---------- 2. Categories ----------
create table public.categories (
  id serial primary key,
  name text not null unique,
  slug text not null unique,
  tourism boolean not null default false,   -- shown as a homepage row
  sort_order int not null default 0
);

insert into public.categories (name, slug, tourism, sort_order) values
  ('Stay & Resorts',       'stay',      true,  1),
  ('Tours & Activities',   'tours',     true,  2),
  ('Food & Drink',         'food',      true,  3),
  ('Shops & Pasalubong',   'pasalubong',true,  4),
  ('Beauty',               'beauty',    false, 5),
  ('Fitness',              'fitness',   false, 6),
  ('Services',             'services',  false, 7);

-- ---------- 3. Plans ----------
create table public.plans (
  id text primary key,
  name text not null,
  price_php int not null,
  rank int not null
);

insert into public.plans (id, name, price_php, rank) values
  ('basic',    'Basic',    0,    1),
  ('featured', 'Featured', 999,  2),
  ('premium',  'Premium',  2499, 3);

-- ---------- 4. Businesses ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category_id int not null references public.categories(id),
  town text not null check (town in ('Abucay','Bagac','Balanga','Dinalupihan','Hermosa','Limay',
                                     'Mariveles','Morong','Orani','Orion','Pilar','Samal')),
  tagline text check (char_length(tagline) <= 120),
  description text check (char_length(description) <= 3000),
  address text,
  phone text,
  email text,
  website text,
  facebook text,
  instagram text,
  tiktok text,
  map_url text,
  hours text,
  price_range text,
  cover_url text,
  plan_id text not null default 'basic' references public.plans(id),
  requested_plan text references public.plans(id),       -- what the owner asked for
  featured_until date,                                    -- paid placement ends after this date
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.businesses (status);
create index on public.businesses (category_id);
create index on public.businesses (town);
create index on public.businesses (owner_id);

-- Owners can't change their own plan, status, or paid dates. Only an admin can.
create function public.protect_business_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  -- auth.uid() is empty when you edit from the Supabase dashboard, so those edits are allowed
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.owner_id := auth.uid();
      new.status := 'pending';
      new.plan_id := 'basic';
      new.featured_until := null;
      new.admin_note := null;
    else
      new.owner_id := old.owner_id;
      new.status := case when old.status = 'rejected' then 'pending' else old.status end;
      new.plan_id := old.plan_id;
      new.featured_until := old.featured_until;
      new.admin_note := old.admin_note;
    end if;
  end if;
  return new;
end $$;

create trigger businesses_protect
  before insert or update on public.businesses
  for each row execute function public.protect_business_fields();

-- ---------- 5. Photos ----------
create table public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.business_photos (business_id);

-- ---------- 6. Inquiries (messages from visitors = leads for owners) ----------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  contact text not null check (char_length(contact) <= 120),
  message text not null check (char_length(message) <= 1000),
  created_at timestamptz not null default now()
);
create index on public.inquiries (business_id);

-- ---------- 7. Views and clicks (stats to show paying owners) ----------
create table public.listing_events (
  id bigserial primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('view','call','website','facebook','map','inquiry')),
  created_at timestamptz not null default now()
);
create index on public.listing_events (business_id, created_at);

-- ---------- 8. Payments (log GCash / bank payments by hand for now) ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan_id text not null references public.plans(id),
  amount_php int not null,
  method text not null check (method in ('gcash','maya','bank','cash','paymongo')),
  reference text,
  period_start date not null,
  period_end date not null,
  created_at timestamptz not null default now()
);
create index on public.payments (business_id);

-- ---------- 9. Public directory view ----------
-- A paid plan only counts while featured_until is today or later.
create view public.directory with (security_invoker = true) as
select
  b.id, b.slug, b.name, b.tagline, b.description, b.town, b.address, b.phone, b.email,
  b.website, b.facebook, b.instagram, b.tiktok, b.map_url, b.hours, b.price_range, b.cover_url,
  b.created_at,
  c.id as category_id, c.name as category_name, c.slug as category_slug, c.tourism,
  case when b.plan_id <> 'basic' and b.featured_until >= current_date then b.plan_id else 'basic' end as plan,
  case when b.plan_id <> 'basic' and b.featured_until >= current_date then p.rank else 1 end as plan_rank
from public.businesses b
join public.categories c on c.id = b.category_id
join public.plans p on p.id = b.plan_id
where b.status = 'approved';

-- Stats per listing for the owner dashboard
create view public.listing_stats with (security_invoker = true) as
select business_id,
  count(*) filter (where kind = 'view'    and created_at > now() - interval '30 days') as views_30d,
  count(*) filter (where kind <> 'view'   and created_at > now() - interval '30 days') as clicks_30d,
  count(*) filter (where kind = 'inquiry' and created_at > now() - interval '30 days') as inquiries_30d
from public.listing_events group by business_id;

-- ---------- 10. Row Level Security ----------
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.plans           enable row level security;
alter table public.businesses      enable row level security;
alter table public.business_photos enable row level security;
alter table public.inquiries       enable row level security;
alter table public.listing_events  enable row level security;
alter table public.payments        enable row level security;

create policy "read own profile"   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Nobody can make themselves an admin from the website
create function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create policy "categories public" on public.categories for select using (true);
create policy "plans public"      on public.plans      for select using (true);
create policy "admin categories"  on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "read approved or own" on public.businesses for select
  using (status = 'approved' or owner_id = auth.uid() or public.is_admin());
create policy "owners add listings" on public.businesses for insert
  with check (auth.uid() is not null);
create policy "owners edit own" on public.businesses for update
  using (owner_id = auth.uid() or public.is_admin());
create policy "owners delete own" on public.businesses for delete
  using (owner_id = auth.uid() or public.is_admin());

create policy "photos public" on public.business_photos for select using (true);
create policy "photos by owner" on public.business_photos for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));

create policy "anyone sends inquiry" on public.inquiries for insert
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.status = 'approved'));
create policy "owner reads inquiries" on public.inquiries for select
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));

create policy "anyone logs events" on public.listing_events for insert
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.status = 'approved'));
create policy "owner reads events" on public.listing_events for select
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));

create policy "admin payments" on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy "owner reads payments" on public.payments for select
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));

grant select on public.directory to anon, authenticated;
grant select on public.listing_stats to authenticated;

-- ---------- 11. Photo storage ----------
-- Public bucket; each owner uploads into a folder named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg','image/png','image/webp']);

-- Public bucket: photos load by their public link, so no read rule is needed (this also stops people listing every file).
create policy "owners upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners replace photos" on storage.objects for update to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- 12. Lock down helper functions ----------
-- These only run automatically as triggers; nobody needs to call them from the website.
-- (is_admin stays callable because the security rules above use it. It only answers "am I an admin?")
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_business_fields() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
