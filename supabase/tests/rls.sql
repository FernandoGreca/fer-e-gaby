begin;
set local role anon;
do $$ begin
 if (select count(*) from public.wishlists)<>2 then raise exception 'Expected two public lists'; end if;
 begin
  insert into public.gifts(wishlist_id,name,product_url) select id,'RLS test','https://example.com' from public.wishlists limit 1;
  raise exception 'Anonymous insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
do $$ begin
 begin
  insert into public.gifts(wishlist_id,name,product_url) select id,'RLS test','https://example.com' from public.wishlists limit 1;
  raise exception 'Non-admin insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='fernando.greca@integra.do'),true);
set local role authenticated;
do $$
declare test_id uuid; n integer; received timestamptz;
begin
 insert into public.gifts(wishlist_id,name,product_url,tags) select id,'RLS test','https://example.com',array[' Casa ','casa'] from public.wishlists where slug='fer' returning id into test_id;
 update public.gifts set name='RLS edited',status='received' where id=test_id;
 select received_at into received from public.gifts where id=test_id;
 if received is null then raise exception 'Receipt trigger failed'; end if;
 if (select tags from public.gifts where id=test_id)<>array['casa'] then raise exception 'Tag normalization failed'; end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
 update public.gifts set name='Intruder' where id=test_id; get diagnostics n=row_count;
 if n<>0 then raise exception 'Non-admin update allowed'; end if;
 delete from public.gifts where id=test_id; get diagnostics n=row_count;
 if n<>0 then raise exception 'Non-admin delete allowed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='fernando.greca@integra.do'),true);
set local role authenticated;
do $$ declare n integer; begin
 update public.gifts set status='wanted' where name='RLS edited';
 if exists(select 1 from public.gifts where name='RLS edited' and received_at is not null) then raise exception 'Restore failed'; end if;
 delete from public.gifts where name='RLS edited'; get diagnostics n=row_count;
 if n<>1 then raise exception 'Admin delete failed'; end if;
end $$;
rollback;
