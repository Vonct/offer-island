import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {emptyState,applyCommand} from '../web/core/model.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('cloud schema isolates accounts, rejects anonymous access and stale writes',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values ('${A}'),('${B}');`);
  await db.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');
  const login=async id=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  const next=applyCommand(emptyState(),{type:'upsert',kind:'applications',record:{company:'Fictional test',role:'Engineer'}});
  await login(A);
  await db.query('select public.offer_save_workspace($1,$2::jsonb)',[0,JSON.stringify(next)]);
  assert.equal((await db.query('select * from public.offer_workspaces')).rows.length,1);
  await assert.rejects(db.query('select public.offer_save_workspace($1,$2::jsonb)',[0,JSON.stringify(next)]),/OFFER_CONFLICT/);
  await login(B);
  assert.equal((await db.query('select * from public.offer_workspaces')).rows.length,0);
  assert.equal((await db.query('update public.offer_workspaces set revision=revision where user_id=$1 returning user_id',[A])).rows.length,0);
  await assert.rejects(db.query('insert into public.offer_workspaces(user_id,revision,data) values ($1,1,$2)',[A,JSON.stringify(next)]),/row-level security/);
  await db.query('select public.offer_save_workspace($1,$2::jsonb)',[0,JSON.stringify(next)]);
  assert.equal((await db.query('select user_id from public.offer_workspaces')).rows[0].user_id,B);
  await assert.rejects(db.query('update public.offer_workspaces set user_id=$1',[A]),/row-level security/);
  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select * from public.offer_workspaces'),/permission denied/);
  await assert.rejects(db.query('select public.offer_save_workspace($1,$2::jsonb)',[0,JSON.stringify(next)]),/permission denied/);
 }finally{await db.close()}
});
