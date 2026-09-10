import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createHandler} from '../supabase/functions/offer-ocr/handler.mjs';
const user='11111111-1111-4111-8111-111111111111';
const image=new Uint8Array([137,80,78,71,13,10,26,10,0]);
const req=(body=image,headers={})=>new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer user-token',Origin:'http://localhost:8780',...headers},body});
function fixture({auth=200,anonymous=false,quota=true,key='secret',modelStatus=200,finish='stop'}={}){
 const calls=[];const env=k=>({SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'publishable',SUPABASE_SERVICE_ROLE_KEY:'server-only',DEEPSEEK_API_KEY:key}[k]);
 const handler=createHandler({env,fetcher:async(url,options)=>{calls.push({url,options});if(url.endsWith('/user'))return Response.json({id:user,is_anonymous:anonymous,email_confirmed_at:'2026-01-01'},{status:auth});if(url.includes('/rpc/'))return Response.json(quota);return Response.json({choices:[{finish_reason:finish,message:{content:'示例公司\n软件工程师'}}]},{status:modelStatus});}});
 return {handler,calls};
}
test('cloud OCR validates login, image and quota before any model call',async()=>{
 for(const settings of [{auth:401},{anonymous:true},{quota:false},{key:''}]){const {handler,calls}=fixture(settings);const r=await handler(req());assert.ok(r.status>=400);assert.equal(calls.some(c=>c.url.includes('deepseek')),false);}
 const {handler,calls}=fixture();assert.equal((await handler(req('not an image'))).status,400);assert.equal(calls.length,1);
 assert.equal((await handler(req(image,{Origin:'https://evil.example'}))).status,403);
 assert.equal((await handler(req(image,{'Content-Length':'8000001'}))).status,400);
 const noAuth=new Request('https://example.com',{method:'POST',body:image});assert.equal((await handler(noAuth)).status,401);
});
test('OCR makes one fixed-endpoint model call and returns only reviewed text, never saves data',async()=>{
 const {handler,calls}=fixture();const response=await handler(req());assert.equal(response.status,200);assert.deepEqual(await response.json(),{text:'示例公司\n软件工程师'});
 const modelCalls=calls.filter(c=>c.url.includes('deepseek'));assert.equal(modelCalls.length,1);const body=JSON.parse(modelCalls[0].options.body);assert.equal(body.model,'deepseek-flash');assert.equal(body.tools,undefined);assert.match(body.messages[1].content[1].image_url.url,/^data:image\/png;base64,/);
 assert.equal(calls.some(c=>c.url.includes('offer_save_workspace')),false);
 const failed=await fixture({modelStatus:401}).handler(req());assert.equal(failed.status,502);assert.doesNotMatch(await failed.text(),/secret|server-only/);
 assert.equal((await fixture({finish:'length'}).handler(req())).status,502);
});
test('OCR quota is service-only, atomic, per-account and resets by UTC date',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${user}');grant usage on schema public to service_role,anon,authenticated;`);
  await db.exec(await readFile(new URL('../supabase/ocr-quota.sql',import.meta.url),'utf8'));
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select public.offer_consume_ocr_quota($1)',[user]),/permission denied/);await assert.rejects(db.query('select * from offer_private.ocr_usage'),/permission denied/);await db.exec('reset role');}
  await db.exec('set role service_role');const use=async()=> (await db.query('select public.offer_consume_ocr_quota($1) as ok',[user])).rows[0].ok;
  assert.equal(await use(),true);assert.equal(await use(),false);
  await db.exec("update offer_private.ocr_usage set next_at=now()-interval '1 minute',requests=29");assert.equal(await use(),true);
  await db.exec("update offer_private.ocr_usage set next_at=now()-interval '1 minute'");assert.equal(await use(),false);
  await db.exec("update offer_private.ocr_usage set day=current_date-1");assert.equal(await use(),true);
 }finally{await db.close();}
});
