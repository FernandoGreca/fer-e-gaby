-- Allow JPEG objects produced by browsers that cannot encode WebP in Canvas.
alter table public.gallery_photos
  drop constraint gallery_photos_object_path_check,
  add constraint gallery_photos_object_path_check
    check (object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg)$');

alter table public.gallery_cleanup
  drop constraint gallery_cleanup_object_path_check,
  add constraint gallery_cleanup_object_path_check
    check (object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg)$');

drop policy gallery_admin_insert on storage.objects;
create policy gallery_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'couple-gallery' and (select public.is_admin())
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg)$'
  and exists(select 1 from public.gallery_cleanup q where q.object_path = name)
);
