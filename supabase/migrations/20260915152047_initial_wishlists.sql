create type public.gift_priority as enum ('high', 'medium', 'low');
create type public.gift_status as enum ('wanted', 'received');
create table public.wishlists (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug in ('fer','gaby')),
 display_name text not null,
 position smallint not null unique check (position in (1,2)),
 created_at timestamptz not null default now(),
 check ((slug='fer' and display_name='Lista presentes Fer' and position=1) or (slug='gaby' and display_name='Lista presentes Gaby' and position=2))
);
create table public.gifts (
 id uuid primary key default gen_random_uuid(),
 wishlist_id uuid not null references public.wishlists(id),
 name text not null check (length(trim(name)) between 1 and 200),
 product_url text not null check (length(product_url)<=2048 and product_url ~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$'),
 image_url text check (image_url is null or (length(image_url)<=2048 and image_url ~* '^https?://[^/@[:space:]]+([/?#][^[:space:]]*)?$')),
 price numeric(12,2) check(price >= 0),
 currency char(3) not null default 'BRL' check(currency ~ '^[A-Z]{3}$'),
 priority public.gift_priority not null default 'medium',
 description text not null default '' check(length(description)<=4000),
 notes text not null default '' check(length(notes)<=2000),
 tags text[] not null default '{}' check(cardinality(tags)<=20),
 status public.gift_status not null default 'wanted',
 received_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((status='wanted' and received_at is null) or (status='received' and received_at is not null))
);
create index gifts_wishlist_status_priority_created_idx on public.gifts(wishlist_id,status,priority,created_at desc);
create index gifts_status_received_idx on public.gifts(status,received_at desc);
create index gifts_priority_idx on public.gifts(priority);
create index gifts_price_idx on public.gifts(price);
create index gifts_tags_idx on public.gifts using gin(tags);
create function public.prepare_gift() returns trigger language plpgsql set search_path='' as $$
begin
 new.name := trim(new.name);
 if tg_op='UPDATE' then new.created_at := old.created_at; else new.created_at := now(); end if;
 new.updated_at := now();
 new.tags := array(select distinct lower(trim(t)) from unnest(new.tags) t where trim(t)<>'' order by 1);
 if exists(select 1 from unnest(new.tags) t where length(t)>40) then raise exception 'Etiqueta muito longa'; end if;
 if new.status='wanted' then new.received_at := null;
 elsif tg_op='INSERT' then new.received_at := now();
 elsif old.status='wanted' then new.received_at := now();
 else new.received_at := old.received_at;
 end if;
 return new;
end $$;
create trigger gifts_prepare before insert or update on public.gifts for each row execute function public.prepare_gift();
alter table public.wishlists enable row level security;
alter table public.gifts enable row level security;
revoke all on public.wishlists, public.gifts from anon, authenticated;
grant select on public.wishlists, public.gifts to anon, authenticated;
grant insert,update,delete on public.gifts to authenticated;
create policy public_read on public.wishlists for select to anon,authenticated using(true);
create policy public_read on public.gifts for select to anon,authenticated using(true);
do $$
declare admin_id uuid;
begin
 select id into strict admin_id from auth.users where email='fernando.greca@integra.do';
 execute format('create policy admin_insert on public.gifts for insert to authenticated with check ((select auth.uid()) = %L::uuid)',admin_id);
 execute format('create policy admin_update on public.gifts for update to authenticated using ((select auth.uid()) = %L::uuid) with check ((select auth.uid()) = %L::uuid)',admin_id,admin_id);
 execute format('create policy admin_delete on public.gifts for delete to authenticated using ((select auth.uid()) = %L::uuid)',admin_id);
end $$;
insert into public.wishlists(slug,display_name,position) values ('fer','Lista presentes Fer',1),('gaby','Lista presentes Gaby',2);
