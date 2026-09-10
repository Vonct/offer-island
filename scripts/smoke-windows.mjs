// Verify the packaged Electron Node runtime can serve the bundled workspace and
// persist a record. All writes go to a disposable directory, never user data.
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory=await mkdtemp(path.join(tmpdir(),'offer-windows-smoke-'));
const exe=path.resolve('dist/windows/win-unpacked/Offer Island.exe');
const entry=path.resolve('dist/windows/win-unpacked/resources/app/server/http.mjs');
const origin='http://127.0.0.1:19783';
let child;
async function start(){
 child=spawn(exe,[entry],{env:{...process.env,ELECTRON_RUN_AS_NODE:'1',OFFER_DB:path.join(directory,'test.sqlite'),OFFER_PORT:'19783'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Packaged server startup timeout')),20000);
  child.stdout.on('data',chunk=>{if(chunk.toString().includes('Offer Island:')){clearTimeout(timeout);resolve()}});
  child.stderr.on('data',chunk=>process.stderr.write(chunk));
  child.once('error',error=>{clearTimeout(timeout);reject(error)});
  child.once('exit',code=>{clearTimeout(timeout);reject(Error(`Packaged server exited ${code}`))});
 });
}
async function stop(){if(child&&child.exitCode===null){await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}}
try{
 await start();
 for(const file of ['/','/island.html','/assets/island.mjs','/core/model.mjs'])assert.equal((await fetch(origin+file)).status,200,file);
 assert.equal((await fetch(origin+'/api/state')).status,403,'API requires client header');
 const headers={'x-offer-client':'web','Content-Type':'application/json'};
 const state=(await (await fetch(origin+'/api/state',{headers})).json()).state;
 const response=await fetch(origin+'/api/command',{method:'POST',headers,body:JSON.stringify({expectedRevision:state.revision,command:{type:'upsert',kind:'applications',record:{id:'windows-smoke',company:'Example Co',role:'Test role',status:'已投递'}}})});
 assert.equal(response.status,200,await response.text());
 await stop();await start();
 const saved=(await (await fetch(origin+'/api/state',{headers})).json()).state;
 assert.ok(saved.applications.some(record=>record.id==='windows-smoke'),'record survives restart');
 console.log('Packaged Windows runtime: static pages, API protection, SQLite write and restart passed.');
}finally{await stop();await rm(directory,{recursive:true,force:true})}
