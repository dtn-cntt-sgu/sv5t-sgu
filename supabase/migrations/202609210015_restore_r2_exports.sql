-- Apply after 014. Keep existing metadata and cleanup safeguards; do not move or delete files.
begin;
alter table public.campaign_exports alter column storage_backend set default 'R2';
comment on column public.campaign_exports.storage_backend is
  'New archives are stored on R2. LOCAL is retained only for historical records.';
commit;
notify pgrst, 'reload schema';
