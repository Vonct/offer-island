-- Additive v3 extension. Existing records stay untouched until their next save.
begin;
create or replace function public.offer_preserve_pool() returns trigger
language plpgsql security invoker set search_path='' as $$
declare pool jsonb;
begin
 if not (new.data ? 'offers') then
  pool := case when tg_op='UPDATE' then coalesce(old.data->'offers','[]'::jsonb) else '[]'::jsonb end;
 else pool := new.data->'offers'; end if;
 if jsonb_typeof(pool) is distinct from 'array' then raise exception 'Invalid offers array'; end if;
 -- Older clients can delete applications without knowing about offer links.
 select coalesce(jsonb_agg(case
  when coalesce(item->>'job','')<>'' and not exists(
   select 1 from jsonb_array_elements(new.data->'applications') a where a->>'id'=item->>'job'
  ) then jsonb_set(item,'{job}','""'::jsonb) else item end order by n),'[]'::jsonb)
 into pool from jsonb_array_elements(pool) with ordinality as items(item,n);
 new.data := jsonb_set(new.data,'{offers}',pool);
 return new;
end $$;
revoke all on function public.offer_preserve_pool() from public,anon,authenticated;
drop trigger if exists offer_preserve_pool on public.offer_workspaces;
create trigger offer_preserve_pool before insert or update on public.offer_workspaces
 for each row execute function public.offer_preserve_pool();
commit;
