-- Fix creating new lists when an existing shopping_lists table has no access_code default.
-- Run this in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

alter table public.shopping_lists
alter column access_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

create or replace function public.create_shopping_list(list_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_list_id uuid;
  new_access_code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  loop
    new_access_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    begin
      insert into public.shopping_lists (name, access_code, owner_id)
      values (nullif(trim(list_name), ''), new_access_code, auth.uid())
      returning id into new_list_id;

      exit;
    exception
      when unique_violation then
        new_access_code := null;
    end;
  end loop;

  insert into public.list_members (list_id, user_id, role, status)
  values (new_list_id, auth.uid(), 'owner', 'approved')
  on conflict (list_id, user_id) do update
    set role = 'owner',
        status = 'approved';

  return new_list_id;
end;
$$;

grant execute on function public.create_shopping_list(text) to authenticated;

notify pgrst, 'reload schema';
