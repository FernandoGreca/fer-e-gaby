begin;
set local role anon;
do $$ begin
  perform * from public.places;
  perform * from public.place_photos;
  begin
    insert into public.places(name, category) values ('Intruso', 'Outro');
    raise exception 'Anonymous place insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.place_photo_cleanup(object_path) values ('00000000-0000-4000-8000-000000000091.webp');
    raise exception 'Anonymous upload intent allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
set local role authenticated;
do $$ begin
  begin
    insert into public.places(name, category) values ('Intruso', 'Outro');
    raise exception 'Non-admin place insert allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from auth.users where email='fernando.greca@integra.do'),true);
set local role authenticated;
do $$
declare place_id uuid; photo_id uuid; n integer;
begin
  insert into public.places(name, category, status, location)
    values ('Lugar de teste', 'Parque e natureza', 'planned', 'São Paulo') returning id into place_id;
  insert into public.place_photo_cleanup(object_path)
    values ('00000000-0000-4000-8000-000000000091.webp');
  insert into storage.objects(bucket_id, name)
    values ('places-photos', '00000000-0000-4000-8000-000000000091.webp');
  insert into public.place_photos(place_id, object_path, is_cover)
    values (place_id, '00000000-0000-4000-8000-000000000091.webp', true) returning id into photo_id;
  if exists(select 1 from public.place_photo_cleanup where object_path='00000000-0000-4000-8000-000000000091.webp') then
    raise exception 'Upload intent not cleared';
  end if;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
  update public.places set name='Intruso' where id=place_id; get diagnostics n=row_count;
  if n<>0 then raise exception 'Non-admin place update allowed'; end if;
  delete from public.places where id=place_id; get diagnostics n=row_count;
  if n<>0 then raise exception 'Non-admin place delete allowed'; end if;
  perform set_config('request.jwt.claim.sub',(select id::text from auth.users where email='fernando.greca@integra.do'),true);
  delete from public.places where id=place_id;
  if not exists(select 1 from public.place_photo_cleanup where object_path='00000000-0000-4000-8000-000000000091.webp') then
    raise exception 'Photo deletion not journaled';
  end if;
end $$;
rollback;
