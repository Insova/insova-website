-- Presence tracking: last_seen_at on profiles, updated only via
-- touch_last_seen() so a caller can never touch any other column or
-- any other user's row. Paste into the Supabase SQL editor and run.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid();
end;
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;
