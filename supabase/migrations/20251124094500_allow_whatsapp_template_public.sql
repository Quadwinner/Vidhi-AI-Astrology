do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public read for whatsapp templates'
  ) then
    create policy "Allow public read for whatsapp templates"
    on storage.objects for select
    using (
      bucket_id = 'astro-data'
      and (path_tokens[1] = 'whatsapp-templates')
    );
  end if;
end;
$$;
