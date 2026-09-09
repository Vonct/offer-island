import test from 'node:test';import assert from 'node:assert/strict';import {Store} from '../web/core/store.mjs';
test('legacy migration preserves user-edited fields and events; stale tabs cannot overwrite',async()=>{const data=new Map([['legacy-apps',JSON.stringify([{id:'a',company:'示例',role:'开发',status:'面试',evidence:'旧备注',link:'https://example.com'}])],['legacy-events',JSON.stringify([{id:'e',title:'面试',date:'2026-09-08',type:'面试',job:'a'}])]]);globalThis.window={OFFER_CONFIG:{storageKey:'test-v3',legacyApps:['legacy-apps'],legacyEvents:['legacy-events'],seed:[]}};globalThis.location={search:'',hostname:'localhost'};globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};globalThis.addEventListener=()=>{};const a=new Store();await a.init();assert.equal(a.state.applications[0].notes,'旧备注');assert.equal(a.state.events.length,1);const b=new Store();await b.init();await a.dispatch({type:'upsert',kind:'applications',record:{id:'a',status:'Offer'}});await assert.rejects(b.dispatch({type:'upsert',kind:'applications',record:{id:'a',status:'测评中'}}),/另一窗口/);assert.equal(JSON.parse(data.get('test-v3')).applications[0].status,'Offer');assert.ok(data.has('legacy-apps'));});

test('hosted guest saves locally without network and survives reload',async()=>{
 const data=new Map();globalThis.window={};globalThis.location={search:'',hostname:'offer-island-milan.netlify.app'};
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 globalThis.addEventListener=()=>{};
 const originalFetch=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('offline')};
 try{
  const store=new Store();await store.init();assert.deepEqual(store.state.applications,[]);
  await store.dispatch({type:'upsert',kind:'applications',record:{id:'local-job',company:'Local company',role:'Developer'}});
  const reloaded=new Store();await reloaded.init();assert.equal(reloaded.state.applications[0].company,'Local company');
  assert.equal(requests,0);assert.equal(reloaded.cloudUser,undefined);
 }finally{globalThis.fetch=originalFetch;}
});

test('local snapshot reads only local records even with saved cloud session',async()=>{
 const data=new Map();globalThis.window={};globalThis.location={search:'',hostname:'example.com'};
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};globalThis.addEventListener=()=>{};
 const local=new Store();await local.initLocal(false);await local.dispatch({type:'upsert',kind:'applications',record:{id:'a',company:'Preserved',role:'Developer'}});
 data.set('offer-cloud-session-v1','saved-session');
 const snapshot=new Store();await snapshot.initLocal(false);assert.equal(snapshot.state.applications[0].company,'Preserved');assert.equal(snapshot.cloudUser,undefined);assert.equal(data.get('offer-cloud-session-v1'),'saved-session');
});
