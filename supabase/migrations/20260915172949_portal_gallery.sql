-- Resolve the existing account once; authorization remains in the database.
do $migration$
declare admin_uid uuid;
begin
  select id into strict admin_uid from auth.users where email = 'fernando.greca@integra.do';
  execute format('create function public.is_admin() returns boolean language sql stable security invoker set search_path = '''' as %L',
    format('select coalesce(auth.uid() = %L::uuid, false)',admin_uid));
end $migration$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  object_path text not null unique check (object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'),
  caption text not null default '' check (char_length(caption) <= 1000),
  photo_date date not null check (photo_date between date '1900-01-01' and date '2100-12-31'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gallery_photos_date_idx on public.gallery_photos(photo_date desc, created_at desc, id desc);
-- Durable upload intent / deletion outbox. Never visible to visitors.
create table public.gallery_cleanup (
  object_path text primary key check (object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'),
  created_at timestamptz not null default now()
);
create index gallery_cleanup_created_idx on public.gallery_cleanup(created_at);
alter table public.gallery_photos enable row level security;
alter table public.gallery_cleanup enable row level security;
revoke all on public.gallery_photos, public.gallery_cleanup from anon, authenticated;
grant select on public.gallery_photos to anon,authenticated;
grant insert,update,delete on public.gallery_photos to authenticated;
grant select,insert,delete on public.gallery_cleanup to authenticated;
create policy public_read on public.gallery_photos for select to anon,authenticated using (true);
create policy admin_insert on public.gallery_photos for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.gallery_photos for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.gallery_photos for delete to authenticated using ((select public.is_admin()));
create policy admin_read on public.gallery_cleanup for select to authenticated using ((select public.is_admin()));
create policy admin_insert on public.gallery_cleanup for insert to authenticated with check ((select public.is_admin()));
create policy admin_delete on public.gallery_cleanup for delete to authenticated using ((select public.is_admin()));

create function public.prepare_gallery_photo() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.object_path <> old.object_path or new.id <> old.id then raise exception 'Photo identity is immutable'; end if;
    new.created_at := old.created_at;
  else
    if not exists(select 1 from public.gallery_cleanup where object_path = new.object_path) then
      raise exception 'An upload intent is required';
    end if;
    new.created_at := now();
  end if;
  new.caption := trim(new.caption);
  new.updated_at := now();
  return new;
end $$;
create trigger prepare_gallery_photo before insert or update on public.gallery_photos for each row execute function public.prepare_gallery_photo();
create function public.gallery_storage_journal() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    delete from public.gallery_cleanup where object_path = new.object_path;
    return new;
  end if;
  insert into public.gallery_cleanup(object_path) values(old.object_path);
  return old;
end $$;
create trigger gallery_storage_journal after insert or delete on public.gallery_photos for each row execute function public.gallery_storage_journal();
revoke all on function public.prepare_gallery_photo(), public.gallery_storage_journal() from public;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('couple-gallery','couple-gallery',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy gallery_admin_select on storage.objects for select to authenticated using (bucket_id = 'couple-gallery' and (select public.is_admin()));
create policy gallery_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'couple-gallery' and (select public.is_admin())
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
  and exists(select 1 from public.gallery_cleanup q where q.object_path = name)
);
-- A linked photo cannot be removed, even if an upload response was lost.
create policy gallery_admin_delete on storage.objects for delete to authenticated using (
  bucket_id = 'couple-gallery' and (select public.is_admin())
  and exists(select 1 from public.gallery_cleanup q where q.object_path = name)
  and not exists(select 1 from public.gallery_photos p where p.object_path = name)
);
