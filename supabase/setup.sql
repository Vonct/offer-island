-- Offer Island: run once in this project's SQL Editor. No existing data is removed.
begin;
create table if not exists public.offer_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check (revision >= 0),
 data jsonb not null check (
  coalesce(jsonb_typeof(data) = 'object' and data->>'version' = '3'
  and jsonb_typeof(data->'applications') = 'array'
  and jsonb_typeof(data->'events') = 'array'
  and jsonb_typeof(data->'experiences') = 'array'
  and jsonb_typeof(data->'undo') = 'array'
  and jsonb_typeof(data->'history') = 'array'
  and (data->>'revision')::bigint = revision,false)
 ),
 updated_at timestamptz not null default now()
);
alter table public.offer_workspaces enable row level security;
revoke all on public.offer_workspaces from anon;
grant select, insert, update on public.offer_workspaces to authenticated;
drop policy if exists offer_owner on public.offer_workspaces;
create policy offer_owner on public.offer_workspaces for all to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
-- Atomic compare-and-swap: stale clients cannot overwrite a newer workspace.
create or replace function public.offer_save_workspace(expected_revision bigint, next_data jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if expected_revision < 0 or (next_data->>'revision')::bigint is distinct from expected_revision+1
 then raise exception 'Invalid revision'; end if;
 insert into public.offer_workspaces(user_id,revision,data)
 select auth.uid(),0,jsonb_build_object('version',3,'revision',0,'applications','[]'::jsonb,'events','[]'::jsonb,'experiences','[]'::jsonb,'undo','[]'::jsonb,'history','[]'::jsonb)
 where expected_revision=0 on conflict(user_id) do nothing;
 update public.offer_workspaces set data=next_data,revision=expected_revision+1,updated_at=now()
 where user_id=auth.uid() and revision=expected_revision returning data into saved;
 if saved is null then raise exception 'OFFER_CONFLICT'; end if;
 return saved;
end $$;
revoke all on function public.offer_save_workspace(bigint,jsonb) from public,anon;
grant execute on function public.offer_save_workspace(bigint,jsonb) to authenticated;
commit;
