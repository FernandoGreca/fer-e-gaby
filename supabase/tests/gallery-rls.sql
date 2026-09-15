begin;
set local role anon;
do $$ begin
 if public.is_admin() then raise exception 'Anonymous admin'; end if;
 perform * from public.gallery_photos;
 begin
 insert into public.gallery_cleanup(object_path) values('00000000-0000-4000-8000-000000000091.webp');
 raise exception 'Anonymous intent allowed';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.gallery_photos(object_path,photo_date) values('00000000-0000-4000-8000-000000000091.webp',current_date);
 raise exception 'Anonymous insert allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='fernando.greca@integra.do'),true);
set local role authenticated;
do $$ declare photo_id uuid; n integer; created timestamptz; begin
 if not public.is_admin() then raise exception 'Admin not recognized'; end if;
 insert into public.gallery_cleanup(object_path) values('00000000-0000-4000-8000-000000000091.webp');
 insert into storage.objects(bucket_id,name) values('couple-gallery','00000000-0000-4000-8000-000000000091.webp');
 insert into public.gallery_photos(object_path,photo_date,caption) values('00000000-0000-4000-8000-000000000091.webp','2026-09-15','  Teste transacional  ') returning id,created_at into photo_id,created;
 if exists(select 1 from public.gallery_cleanup where object_path='00000000-0000-4000-8000-000000000091.webp') then raise exception 'Intent not cleared'; end if;
 update public.gallery_photos set caption='Editado',photo_date='2024-02-29',created_at='2000-01-01' where id=photo_id;
 if (select created_at from public.gallery_photos where id=photo_id)<>created then raise exception 'Creation time changed'; end if;
 begin
 update public.gallery_photos set object_path='00000000-0000-4000-8000-000000000092.webp' where id=photo_id;
 raise exception 'Identity changed'; exception when raise_exception then if SQLERRM='Identity changed' then raise; end if; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
 if public.is_admin() then raise exception 'Non-admin accepted'; end if;
 begin
 insert into public.gallery_cleanup(object_path) values('00000000-0000-4000-8000-000000000092.webp');
 raise exception 'Non-admin intent allowed'; exception when insufficient_privilege then null; end;
 update public.gallery_photos set caption='Intruder' where id=photo_id;get diagnostics n=row_count;
 if n<>0 then raise exception 'Non-admin update allowed'; end if;
 delete from public.gallery_photos where id=photo_id;get diagnostics n=row_count;
 if n<>0 then raise exception 'Non-admin delete allowed'; end if;
 begin
 insert into storage.objects(bucket_id,name) values('couple-gallery','00000000-0000-4000-8000-000000000092.webp');
 raise exception 'Non-admin upload allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='fernando.greca@integra.do'),true);
set local role authenticated;
do $$ begin
 delete from public.gallery_photos where object_path='00000000-0000-4000-8000-000000000091.webp';
 if not exists(select 1 from public.gallery_cleanup where object_path='00000000-0000-4000-8000-000000000091.webp') then raise exception 'Deletion not journaled'; end if;
 begin
 insert into storage.objects(bucket_id,name) values('couple-gallery','../other.png');
 raise exception 'Invalid storage path allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
