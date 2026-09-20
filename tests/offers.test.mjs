import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {emptyState,applyCommand,normalize,previewImport,normalizeImport,exportState,offerAnnualFixed} from '../web/core/model.mjs';
import {openStore} from '../server/db.mjs';
const offer={id:'o',company:'虚构公司',role:'开发',monthlySalary:23000,salaryMonths:14,location:'杭州',benefits:'六险一金',signOn:10000,annualBonus:20000,equity:'另行确认'};
test('offers can be standalone or linked; application deletion detaches without losing terms; undo restores',()=>{
 let s=emptyState();s=applyCommand(s,{type:'upsert',kind:'offers',record:offer});
 s=applyCommand(s,{type:'upsert',kind:'applications',record:{id:'a',company:'虚构公司',role:'开发',status:'面试'}});
 s=applyCommand(s,{type:'upsert',kind:'offers',record:{id:'o',job:'a'}});
 assert.equal(s.applications[0].status,'面试');assert.equal(s.offers[0].monthlySalary,23000);
 s=applyCommand(s,{type:'delete',kind:'applications',id:'a'});assert.equal(s.offers[0].job,'');assert.equal(s.offers[0].benefits,'六险一金');
 s=applyCommand(s,{type:'undo'});assert.equal(s.offers[0].job,'a');
 s=applyCommand(s,{type:'delete',kind:'offers',id:'o'});assert.equal(s.offers.length,0);
 s=applyCommand(s,{type:'undo'});assert.equal(s.offers[0].equity,'另行确认');
 assert.throws(()=>applyCommand(s,{type:'upsert',kind:'offers',record:{...offer,job:'missing'}}),/关联职位/);
});
test('compensation preserves unknown vs zero and does not add variable bonuses to fixed salary',()=>{
 const o=normalize('offers',offer);assert.equal(offerAnnualFixed(o),322000);
 assert.equal(normalize('offers',{...offer,monthlySalary:''}).monthlySalary,null);
 assert.equal(offerAnnualFixed(normalize('offers',{...offer,salaryMonths:''})),null);
 assert.equal(offerAnnualFixed(normalize('offers',{...offer,monthlySalary:0})),0);
 for(const monthlySalary of [-1,'1e5',NaN,Infinity,{},'20,000',1000000001,'1.234'])assert.throws(()=>normalize('offers',{...offer,monthlySalary}));
 for(const salaryMonths of [0,25,-1])assert.throws(()=>normalize('offers',{...offer,salaryMonths}));
 assert.throws(()=>normalize('offers',{...offer,receivedDate:'2026-02-30'}));
 assert.throws(()=>normalize('offers',{...offer,status:'已入职'}));
 assert.throws(()=>normalize('offers',{...offer,currency:'XXX'}));
});
test('old v3 workspaces and undo snapshots upgrade without dropping offers; backups roundtrip and deduplicate IDs',()=>{
 const legacy=emptyState();delete legacy.offers;
 let s=applyCommand(legacy,{type:'upsert',kind:'offers',record:offer});
 const exported=exportState(s);assert.equal(normalizeImport(exported).offers.length,1);
 let restored=applyCommand(emptyState(),{type:'import',data:exported});assert.deepEqual(restored.offers,s.offers);
 restored=applyCommand(restored,{type:'import',data:exported});assert.equal(restored.offers.length,1);
 s.undo.push({applications:[],events:[],experiences:[]});s=applyCommand(s,{type:'undo'});assert.equal(s.offers[0].monthlySalary,23000);
 assert.equal(previewImport(legacy,{offers:[offer]})[0].action,'add');
 const changed=applyCommand(s,{type:'import',data:{offers:[{...offer,monthlySalary:26000}]},overwrite:false});assert.equal(changed.offers[0].monthlySalary,23000);
 assert.equal(applyCommand(s,{type:'import',data:{offers:[{...offer,monthlySalary:26000}]},overwrite:true}).offers[0].monthlySalary,26000);
});
test('import remaps deduplicated application links for offers; SQLite shares validation and revision checks',()=>{
 const db=openStore(':memory:');try{
 db.dispatch({type:'upsert',kind:'applications',record:{id:'a',company:'虚构公司',role:'开发'}},0);
 db.dispatch({type:'import',data:{applications:[{id:'alias',company:'虚构公司',role:'开发'}],offers:[{...offer,job:'alias'}]}},1);
 assert.equal(db.read().offers[0].job,'a');
 assert.throws(()=>db.dispatch({type:'upsert',kind:'offers',record:{id:'o',monthlySalary:26000}},1),/其他窗口/);
 assert.equal(db.read().offers[0].monthlySalary,23000);
 assert.throws(()=>db.dispatch({type:'upsert',kind:'offers',record:{id:'o',monthlySalary:-1}},2));
 assert.equal(db.read().revision,2);
 }finally{db.close();}
});
test('cloud saves preserve offers omitted by older clients; detach stale links; explicit removal and RLS still work',async()=>{
 const db=new PGlite();const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;insert into auth.users values('${A}'),('${B}');`);
 await db.exec(await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20260917075309_offer_pool.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${A}',false);`);
 let s=applyCommand(emptyState(),{type:'upsert',kind:'applications',record:{id:'a',company:'虚构公司',role:'开发'}});
 await db.query('select public.offer_save_workspace($1,$2)',[0,s]);
 s=applyCommand(s,{type:'upsert',kind:'offers',record:{...offer,job:'a'}});
 await db.query('select public.offer_save_workspace($1,$2)',[1,s]);
 const older={...s,revision:3,applications:[]};delete older.offers;
 const saved=(await db.query('select public.offer_save_workspace($1,$2) as state',[2,older])).rows[0].state;
 assert.equal(saved.offers[0].monthlySalary,23000);assert.equal(saved.offers[0].job,'');
 await assert.rejects(db.query('select public.offer_save_workspace($1,$2)',[3,{...saved,revision:4,offers:null}]),/Invalid offers/);
 await db.exec(`select set_config('request.jwt.claim.sub','${B}',false)`);
 assert.equal((await db.query('select data from public.offer_workspaces')).rows.length,0);
 await db.exec(`select set_config('request.jwt.claim.sub','${A}',false)`);
 const removed=(await db.query('select public.offer_save_workspace($1,$2) as state',[3,{...saved,revision:4,offers:[]}])).rows[0].state;
 assert.equal(removed.offers.length,0);
 }finally{await db.close();}
});
