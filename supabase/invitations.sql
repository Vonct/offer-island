begin;
create schema if not exists offer_private;
revoke all on schema offer_private from public, anon, authenticated;
grant usage on schema offer_private to supabase_auth_admin;
create table if not exists offer_private.invites (
 code_hash text primary key,
 remaining integer not null default 1 check (remaining >= 0),
 expires_at timestamptz not null default now()+interval '90 days',
 created_at timestamptz not null default now()
);
alter table offer_private.invites enable row level security;
revoke all on offer_private.invites from public,anon,authenticated;
grant select,update on offer_private.invites to supabase_auth_admin;
create policy auth_invite_check on offer_private.invites to supabase_auth_admin using (true) with check (true);
create or replace function offer_private.require_invite() returns trigger
language plpgsql security invoker set search_path='' as $$
declare accepted text;
begin
 update offer_private.invites set remaining=remaining-1
 where code_hash=encode(sha256(convert_to(trim(coalesce(new.raw_user_meta_data->>'invite_code','')),'UTF8')),'hex')
 and remaining>0 and expires_at>now()
 returning code_hash into accepted;
 if accepted is null then raise exception 'Invitation required or expired' using errcode='P0001'; end if;
 new.raw_user_meta_data=coalesce(new.raw_user_meta_data,'{}'::jsonb)-'invite_code';
 return new;
end $$;
revoke all on function offer_private.require_invite() from public,anon,authenticated;
grant execute on function offer_private.require_invite() to supabase_auth_admin;
create trigger offer_require_invite before insert on auth.users for each row execute function offer_private.require_invite();
commit;
