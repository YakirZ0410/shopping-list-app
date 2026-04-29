-- Full database shape for the shopping list app.
-- Run this in Supabase Dashboard -> SQL Editor after fix-list-members-rls.sql.

create extension if not exists pgcrypto;

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shopping_lists
alter column access_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

create table if not exists public.list_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'pending' check (status in ('approved', 'pending', 'rejected')),
  created_at timestamptz not null default now(),
  unique (list_id, user_id)
);

alter table public.list_members
alter column status set default 'pending';

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  is_bought boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.shopping_list_items
add column if not exists quantity integer not null default 1;

alter table public.shopping_list_items
add column if not exists created_by uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shopping_list_items_quantity_positive'
      and conrelid = 'public.shopping_list_items'::regclass
  ) then
    alter table public.shopping_list_items
    add constraint shopping_list_items_quantity_positive check (quantity > 0);
  end if;
end $$;

alter table public.shopping_lists enable row level security;
alter table public.list_members enable row level security;
alter table public.shopping_list_items enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shopping_list_items'
  ) then
    alter publication supabase_realtime add table public.shopping_list_items;
  end if;
end $$;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('shopping_lists', 'list_members', 'shopping_list_items')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

drop function if exists public.create_shopping_list(text);
drop function if exists public.join_shopping_list(text);
drop function if exists public.delete_shopping_list(uuid);
drop function if exists public.get_pending_join_requests(uuid);
drop function if exists public.approve_join_request(uuid);
drop function if exists public.reject_join_request(uuid);
drop function if exists public.get_list_members(uuid);
drop function if exists public.get_shopping_list_items(uuid);
drop function if exists public.remove_list_member(uuid);
drop function if exists public.is_list_member(uuid);
drop function if exists public.is_list_owner(uuid);

create or replace function public.is_list_member(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_members
    where list_id = target_list_id
      and user_id = auth.uid()
      and status = 'approved'
  );
$$;

create or replace function public.is_list_owner(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.list_members
    where list_id = target_list_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'approved'
  );
$$;

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

create or replace function public.join_shopping_list(list_access_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_list_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into target_list_id
  from public.shopping_lists
  where access_code = upper(trim(list_access_code));

  if target_list_id is null then
    raise exception 'List not found';
  end if;

  insert into public.list_members (list_id, user_id, role, status)
  values (target_list_id, auth.uid(), 'member', 'pending')
  on conflict (list_id, user_id) do update
    set status = case
          when public.list_members.role = 'owner' then 'approved'
          else 'pending'
        end;

  return target_list_id;
end;
$$;

create or replace function public.delete_shopping_list(target_list_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_list_owner(target_list_id) then
    raise exception 'Only the list owner can delete this list';
  end if;

  delete from public.shopping_lists
  where id = target_list_id;
end;
$$;

create or replace function public.get_pending_join_requests(target_list_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  user_email text,
  user_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_list_owner(target_list_id) then
    raise exception 'Only the list owner can view join requests';
  end if;

  return query
    select
      lm.id as membership_id,
      lm.user_id,
      coalesce(au.email, 'משתמש ללא מייל')::text as user_email,
      coalesce(
        au.raw_user_meta_data->>'display_name',
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.email,
        'משתמש ללא שם'
      )::text as user_name,
      lm.created_at
    from public.list_members lm
    left join auth.users au on au.id = lm.user_id
    where lm.list_id = target_list_id
      and lm.role = 'member'
      and lm.status = 'pending'
    order by lm.created_at asc;
end;
$$;

create or replace function public.approve_join_request(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_list_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select list_id
  into target_list_id
  from public.list_members
  where id = target_membership_id
    and role = 'member'
    and status = 'pending';

  if target_list_id is null then
    raise exception 'Join request not found';
  end if;

  if not public.is_list_owner(target_list_id) then
    raise exception 'Only the list owner can approve join requests';
  end if;

  update public.list_members
  set status = 'approved'
  where id = target_membership_id;
end;
$$;

create or replace function public.reject_join_request(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_list_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select list_id
  into target_list_id
  from public.list_members
  where id = target_membership_id
    and role = 'member'
    and status = 'pending';

  if target_list_id is null then
    raise exception 'Join request not found';
  end if;

  if not public.is_list_owner(target_list_id) then
    raise exception 'Only the list owner can reject join requests';
  end if;

  update public.list_members
  set status = 'rejected'
  where id = target_membership_id;
end;
$$;

create or replace function public.get_list_members(target_list_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  user_email text,
  user_name text,
  role text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_list_member(target_list_id) then
    raise exception 'Only list members can view members';
  end if;

  return query
    select
      lm.id as membership_id,
      lm.user_id,
      coalesce(au.email, 'משתמש ללא מייל')::text as user_email,
      coalesce(
        au.raw_user_meta_data->>'display_name',
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.email,
        'משתמש ללא שם'
      )::text as user_name,
      lm.role,
      lm.status,
      lm.created_at
    from public.list_members lm
    left join auth.users au on au.id = lm.user_id
    where lm.list_id = target_list_id
      and lm.status = 'approved'
    order by
      case when lm.role = 'owner' then 0 else 1 end,
      lm.created_at asc;
end;
$$;

create or replace function public.get_shopping_list_items(target_list_id uuid)
returns table (
  id uuid,
  list_id uuid,
  name text,
  quantity integer,
  is_bought boolean,
  created_by uuid,
  created_by_name text,
  is_created_by_current_user boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_list_member(target_list_id) then
    raise exception 'Only list members can view items';
  end if;

  return query
    select
      sli.id,
      sli.list_id,
      sli.name,
      sli.quantity,
      sli.is_bought,
      sli.created_by,
      nullif(
        coalesce(
          au.raw_user_meta_data->>'display_name',
          au.raw_user_meta_data->>'full_name',
          au.raw_user_meta_data->>'name',
          au.email,
          ''
        ),
        ''
      )::text as created_by_name,
      (sli.created_by = auth.uid()) as is_created_by_current_user,
      sli.created_at
    from public.shopping_list_items sli
    left join auth.users au on au.id = sli.created_by
    where sli.list_id = target_list_id
    order by sli.created_at asc;
end;
$$;

create or replace function public.remove_list_member(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_list_id uuid;
  target_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select list_id, role
  into target_list_id, target_role
  from public.list_members
  where id = target_membership_id
    and status = 'approved';

  if target_list_id is null then
    raise exception 'Member not found';
  end if;

  if target_role = 'owner' then
    raise exception 'Cannot remove the list owner';
  end if;

  if not public.is_list_owner(target_list_id) then
    raise exception 'Only the list owner can remove members';
  end if;

  delete from public.list_members
  where id = target_membership_id;
end;
$$;

create policy "Members can view their own memberships"
on public.list_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_list_owner(list_id)
);

create policy "Users can create their own memberships"
on public.list_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'
  and status = 'pending'
);

create policy "Owners can update memberships in their lists"
on public.list_members
for update
to authenticated
using (public.is_list_owner(list_id))
with check (public.is_list_owner(list_id));

create policy "Users can leave lists they joined"
on public.list_members
for delete
to authenticated
using (
  user_id = auth.uid()
  and role = 'member'
);

create policy "Members can view their shopping lists"
on public.shopping_lists
for select
to authenticated
using (public.is_list_member(id));

create policy "Users can create shopping lists"
on public.shopping_lists
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owners can update their shopping lists"
on public.shopping_lists
for update
to authenticated
using (public.is_list_owner(id))
with check (public.is_list_owner(id));

create policy "Owners can delete their shopping lists"
on public.shopping_lists
for delete
to authenticated
using (owner_id = auth.uid());

create policy "Members can view list items"
on public.shopping_list_items
for select
to authenticated
using (public.is_list_member(list_id));

create policy "Members can create list items"
on public.shopping_list_items
for insert
to authenticated
with check (public.is_list_member(list_id));

create policy "Members can update list items"
on public.shopping_list_items
for update
to authenticated
using (public.is_list_member(list_id))
with check (public.is_list_member(list_id));

create policy "Members can delete list items"
on public.shopping_list_items
for delete
to authenticated
using (public.is_list_member(list_id));

grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.create_shopping_list(text) to authenticated;
grant execute on function public.join_shopping_list(text) to authenticated;
grant execute on function public.delete_shopping_list(uuid) to authenticated;
grant execute on function public.get_pending_join_requests(uuid) to authenticated;
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.reject_join_request(uuid) to authenticated;
grant execute on function public.get_list_members(uuid) to authenticated;
grant execute on function public.get_shopping_list_items(uuid) to authenticated;
grant execute on function public.remove_list_member(uuid) to authenticated;

notify pgrst, 'reload schema';
