create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  category text not null check (category in (
    'Restaurante', 'Parque e natureza', 'Cidade', 'País', 'Evento',
    'Passeio e atração', 'Museu', 'Hospedagem', 'Compras', 'Outro'
  )),
  description text not null default '' check (char_length(description) <= 3000),
  location text not null default '' check (char_length(location) <= 300),
  address text not null default '' check (char_length(address) <= 500),
  map_url text not null default '' check (char_length(map_url) <= 2048 and (map_url = '' or map_url ~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
  website_url text not null default '' check (char_length(website_url) <= 2048 and (website_url = '' or website_url ~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
  event_date date check (event_date is null or event_date between date '1900-01-01' and date '2100-12-31'),
  status text not null default 'planned' check (status in ('planned', 'visited')),
  visited_date date check (visited_date is null or visited_date between date '1900-01-01' and date '2100-12-31'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'visited' or visited_date is null)
);
create index places_created_idx on public.places(created_at desc, id desc);
create index places_category_status_idx on public.places(category, status);

create table public.place_photo_cleanup (
  object_path text primary key check (object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg)$'),
  created_at timestamptz not null default now()
);
create table public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  object_path text not null unique check (object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg)$'),
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index place_photos_place_idx on public.place_photos(place_id, created_at, id);
create unique index place_photos_one_cover_idx on public.place_photos(place_id) where is_cover;

alter table public.places enable row level security;
alter table public.place_photos enable row level security;
alter table public.place_photo_cleanup enable row level security;
revoke all on public.places, public.place_photos, public.place_photo_cleanup from anon, authenticated;
grant select on public.places, public.place_photos to anon, authenticated;
grant insert, update, delete on public.places, public.place_photos to authenticated;
grant select, insert, delete on public.place_photo_cleanup to authenticated;
create policy public_read on public.places for select to anon, authenticated using (true);
create policy admin_insert on public.places for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.places for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.places for delete to authenticated using ((select public.is_admin()));
create policy public_read on public.place_photos for select to anon, authenticated using (true);
create policy admin_insert on public.place_photos for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.place_photos for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.place_photos for delete to authenticated using ((select public.is_admin()));
create policy admin_read on public.place_photo_cleanup for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.place_photo_cleanup for insert to authenticated with check ((select public.is_admin()));
create policy admin_delete on public.place_photo_cleanup for delete to authenticated using ((select public.is_admin()));

create function public.prepare_place() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.name := trim(new.name);
  if tg_op = 'UPDATE' then new.created_at := old.created_at; else new.created_at := now(); end if;
  new.updated_at := now();
  if new.status = 'planned' then new.visited_date := null; end if;
  return new;
end $$;
create trigger places_prepare before insert or update on public.places for each row execute function public.prepare_place();

create function public.prepare_place_photo() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.place_photo_cleanup q where q.object_path = new.object_path) then
      raise exception 'An upload intent is required';
    end if;
    new.created_at := now();
  else
    if new.object_path <> old.object_path or new.place_id <> old.place_id or new.id <> old.id then
      raise exception 'Photo identity is immutable';
    end if;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
create trigger place_photos_prepare before insert or update on public.place_photos for each row execute function public.prepare_place_photo();

create function public.place_photo_storage_journal() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    delete from public.place_photo_cleanup where object_path = new.object_path;
    return new;
  end if;
  insert into public.place_photo_cleanup(object_path) values(old.object_path);
  return old;
end $$;
create trigger place_photos_storage_journal after insert or delete on public.place_photos for each row execute function public.place_photo_storage_journal();
revoke all on function public.prepare_place(), public.prepare_place_photo(), public.place_photo_storage_journal() from public;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('places-photos', 'places-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy places_admin_select on storage.objects for select to authenticated using (bucket_id = 'places-photos' and (select public.is_admin()));
create policy places_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'places-photos' and (select public.is_admin())
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg)$'
  and exists (select 1 from public.place_photo_cleanup q where q.object_path = name)
);
create policy places_admin_delete on storage.objects for delete to authenticated using (
  bucket_id = 'places-photos' and (select public.is_admin())
  and exists (select 1 from public.place_photo_cleanup q where q.object_path = name)
  and not exists (select 1 from public.place_photos p where p.object_path = name)
);
