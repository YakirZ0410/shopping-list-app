-- Check whether shopping_list_items is enabled for Supabase Realtime.
-- Run this in Supabase Dashboard -> SQL Editor.

select
  case
    when exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'shopping_list_items'
    )
    then 'enabled'
    else 'not enabled'
  end as shopping_list_items_realtime_status;
