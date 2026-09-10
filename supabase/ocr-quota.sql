begin;
create schema if not exists offer_private;
create table if not exists offer_private.ocr_usage (
 user_id uuid primary key references auth.users(id) on delete cascade,
 day date not null,
 requests integer not null check(requests between 1 and 30),
 next_at timestamptz not null
);
alter table offer_private.ocr_usage enable row level security;
revoke all on offer_private.ocr_usage from public,anon,authenticated;
grant usage on schema offer_private to service_role;
grant select,insert,update on offer_private.ocr_usage to service_role;
create or replace function public.offer_consume_ocr_quota(target_user uuid)
returns boolean language sql security invoker set search_path='' as $$
 with reserved as (
  insert into offer_private.ocr_usage as usage(user_id,day,requests,next_at)
  values(target_user,(now() at time zone 'UTC')::date,1,now()+interval '5 seconds')
  on conflict(user_id) do update set
   day=excluded.day,
   requests=case when usage.day=excluded.day then usage.requests+1 else 1 end,
   next_at=excluded.next_at
  where usage.next_at<=now() and (usage.day<>excluded.day or usage.requests<30)
  returning 1
 ) select exists(select 1 from reserved);
$$;
revoke all on function public.offer_consume_ocr_quota(uuid) from public,anon,authenticated;
grant execute on function public.offer_consume_ocr_quota(uuid) to service_role;
commit;
