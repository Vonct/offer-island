import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
test('invite gate rejects missing, reused, expired codes and preserves existing users',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create table auth.users(id int primary key,raw_user_meta_data jsonb);grant usage on schema auth to supabase_auth_admin;grant insert,select,update on auth.users to supabase_auth_admin;insert into auth.users values(0,'{}');`);
 await db.exec(await readFile(new URL('../supabase/invitations.sql',import.meta.url),'utf8'));
 await db.exec(`insert into offer_private.invites(code_hash) values(encode(sha256(convert_to('test-code','UTF8')),'hex'));set role supabase_auth_admin;`);
 await assert.rejects(db.exec(`insert into auth.users values(1,'{}')`),/Invitation/);
 await db.exec(`insert into auth.users values(1,'{"invite_code":"test-code","name":"test"}')`);
 assert.deepEqual((await db.query('select raw_user_meta_data from auth.users where id=1')).rows[0].raw_user_meta_data,{name:'test'});
 await assert.rejects(db.exec(`insert into auth.users values(2,'{"invite_code":"test-code"}')`),/Invitation/);
 await db.exec(`update auth.users set raw_user_meta_data='{"name":"existing"}' where id=0;reset role;update offer_private.invites set remaining=1,expires_at=now()-interval '1 day';set role supabase_auth_admin;`);
 await assert.rejects(db.exec(`insert into auth.users values(3,'{"invite_code":"test-code"}')`),/Invitation/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from offer_private.invites'),/permission denied/);await db.close();
});
