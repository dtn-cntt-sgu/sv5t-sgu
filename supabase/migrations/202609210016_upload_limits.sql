begin;
alter table public.system_settings add column file_upload_limits jsonb;
update public.system_settings set file_upload_limits = jsonb_build_object(
  'DECLARATION_DOC', max_docx_bytes, 'EVIDENCE_DOC', max_docx_bytes,
  'COLLECTIVE_DOC', max_docx_bytes, 'PORTRAIT_IMG', max_image_bytes,
  'COLLECTIVE_IMG', max_image_bytes);
alter table public.system_settings alter column file_upload_limits set not null;
create function public.check_file_upload_limits() returns trigger
language plpgsql set search_path='' as $$
declare category text; value numeric;
begin
  if jsonb_typeof(new.file_upload_limits) <> 'object' then raise exception 'INVALID_UPLOAD_LIMITS'; end if;
  foreach category in array array['DECLARATION_DOC','EVIDENCE_DOC','COLLECTIVE_DOC','PORTRAIT_IMG','COLLECTIVE_IMG'] loop
    if not (new.file_upload_limits ? category) or jsonb_typeof(new.file_upload_limits->category) <> 'number' then raise exception 'INVALID_UPLOAD_LIMITS'; end if;
    value := (new.file_upload_limits->>category)::numeric;
    if value < 1 or value > 1073741824 or value <> trunc(value) then raise exception 'INVALID_UPLOAD_LIMITS'; end if;
  end loop;
  return new;
end;
$$;
create trigger check_file_upload_limits before insert or update on public.system_settings
for each row execute function public.check_file_upload_limits();
create function public.enforce_upload_file_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare max_bytes bigint;
begin
 select (file_upload_limits->>new.file_type::text)::bigint into max_bytes from public.system_settings where singleton;
 if max_bytes is null or new.expected_size_bytes < 1 or new.expected_size_bytes > max_bytes then raise exception 'FILE_TOO_LARGE'; end if;
 return new;
end;
$$;
create trigger enforce_upload_file_limit before insert on public.upload_reservations
for each row execute function public.enforce_upload_file_limit();
revoke all on function public.enforce_upload_file_limit() from public,anon,authenticated;
commit;
notify pgrst, 'reload schema';
