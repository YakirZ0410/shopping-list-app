-- Fix infinite recursion in RLS policies for the shopping list app.
-- Run this in Supabase Dashboard -> SQL Editor.

alter table public.shopping_lists enable row level security;
alter table public.list_members enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('shopping_lists', 'list_members')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

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
with check (user_id = auth.uid());

create policy "Owners can update memberships in their lists"
on public.list_members
for update
to authenticated
using (public.is_list_owner(list_id))
with check (public.is_list_owner(list_id));

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
