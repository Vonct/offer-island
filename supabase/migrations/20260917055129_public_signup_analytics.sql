-- Existing installations: apply after setup.sql. No user/workspace data is removed.
begin;
drop trigger if exists offer_require_invite on auth.users;
create schema if not exists offer_private;
revoke all on schema offer_private from public, anon;
grant usage on schema offer_private to authenticated;
create table if not exists offer_private.admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists offer_private.activity_daily (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 saves bigint not null default 0 check(saves >= 0),
 primary key(user_id,day)
);
create index if not exists offer_activity_day on offer_private.activity_daily(day);
create table if not exists offer_private.analytics_config (
 singleton boolean primary key default true check(singleton),
 started_at timestamptz not null default now()
);
insert into offer_private.analytics_config(singleton) values(true) on conflict do nothing;
alter table offer_private.admins enable row level security;
alter table offer_private.activity_daily enable row level security;
alter table offer_private.analytics_config enable row level security;
revoke all on offer_private.admins,offer_private.activity_daily,offer_private.analytics_config from public,anon,authenticated;

-- Authorization reads a private allowlist; user-editable metadata is never trusted.
create or replace function offer_private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from offer_private.admins where user_id=auth.uid());
$$;
create or replace function public.offer_is_admin() returns boolean
language sql stable security invoker set search_path='' as $$ select offer_private.is_admin(); $$;

create or replace function offer_private.record_activity() returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then
  raise exception 'Sign in required' using errcode='42501';
 end if;
 insert into offer_private.activity_daily(user_id,day)
 values(auth.uid(),(now() at time zone 'Asia/Shanghai')::date) on conflict do nothing;
end $$;
create or replace function public.offer_record_activity() returns void
language sql security invoker set search_path='' as $$ select offer_private.record_activity(); $$;

-- Successful saves are recorded by the database, including older desktop clients.
create or replace function offer_private.record_workspace_save() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() <> new.user_id then
  raise exception 'Sign in required' using errcode='42501';
 end if;
 if new.revision=0 then return new; end if;
 insert into offer_private.activity_daily as a(user_id,day,saves)
 values(new.user_id,(now() at time zone 'Asia/Shanghai')::date,1)
 on conflict(user_id,day) do update set saves=a.saves+1;
 return new;
end $$;
drop trigger if exists offer_track_save on public.offer_workspaces;
create trigger offer_track_save after insert or update on public.offer_workspaces
 for each row execute function offer_private.record_workspace_save();

create or replace function offer_private.analytics(window_days integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare today date := (now() at time zone 'Asia/Shanghai')::date; result jsonb;
begin
 if not offer_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if window_days is null or window_days not in (7,30,90) then raise exception 'Invalid date range'; end if;
 with days as (
  select today-i as day from generate_series(0,window_days-1) i
 ), registrations as (
  select (created_at at time zone 'Asia/Shanghai')::date as day,count(*) as registrations
  from auth.users where created_at >= ((today-window_days+1)::timestamp at time zone 'Asia/Shanghai') group by 1
 ), activity as (
  select day,count(*) as active,count(*) filter(where saves>0) as writers,sum(saves) as saves
  from offer_private.activity_daily where day>=today-window_days+1 group by day
 ), workspace_totals as (
  select count(*) as workspaces,
   count(*) filter(where jsonb_array_length(data->'applications')+jsonb_array_length(data->'events')+jsonb_array_length(data->'experiences')>0) as populated,
   coalesce(sum(jsonb_array_length(data->'applications')),0) as applications,
   coalesce(sum(jsonb_array_length(data->'events')),0) as events,
   coalesce(sum(jsonb_array_length(data->'experiences')),0) as experiences
  from public.offer_workspaces
 ) select jsonb_build_object(
  'generated_at',now(),'timezone','Asia/Shanghai',
  'started_at',(select started_at from offer_private.analytics_config where singleton),
  'summary',jsonb_build_object(
   'registered',(select count(*) from auth.users),
   'confirmed',(select count(*) from auth.users where email_confirmed_at is not null),
   'today_new',(select count(*) from auth.users where created_at >= (today::timestamp at time zone 'Asia/Shanghai')),
   'active_today',(select count(*) from offer_private.activity_daily where day=today),
   'active_7',(select count(distinct user_id) from offer_private.activity_daily where day>=today-6),
   'active_30',(select count(distinct user_id) from offer_private.activity_daily where day>=today-29),
   'period_active',(select count(distinct user_id) from offer_private.activity_daily where day>=today-window_days+1),
   'period_new',(select coalesce(sum(registrations),0) from registrations),
   'period_saves',(select coalesce(sum(saves),0) from activity),
   'workspaces',w.workspaces,'populated',w.populated,'applications',w.applications,'events',w.events,'experiences',w.experiences),
  'daily',(select jsonb_agg(jsonb_build_object('day',d.day,'registrations',coalesce(r.registrations,0),
   'active',coalesce(a.active,0),'writers',coalesce(a.writers,0),'saves',coalesce(a.saves,0)) order by d.day)
   from days d left join registrations r using(day) left join activity a using(day))
 ) into result from workspace_totals w;
 return result;
end $$;
create or replace function public.offer_analytics(window_days integer default 30) returns jsonb
language sql stable security invoker set search_path='' as $$ select offer_private.analytics(window_days); $$;

revoke all on function offer_private.is_admin(),offer_private.record_activity(),offer_private.record_workspace_save(),offer_private.analytics(integer) from public,anon,authenticated;
grant execute on function offer_private.is_admin(),offer_private.record_activity(),offer_private.analytics(integer) to authenticated;
revoke all on function public.offer_is_admin(),public.offer_record_activity(),public.offer_analytics(integer) from public,anon,authenticated;
grant execute on function public.offer_is_admin(),public.offer_record_activity(),public.offer_analytics(integer) to authenticated;
commit;
