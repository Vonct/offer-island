import {emptyState,applyCommand,demoState,normalize,normalizeImport} from './model.mjs';
export class Store {
 constructor(){this.demo=new URLSearchParams(location.search).has('demo');this.key=window.OFFER_CONFIG?.storageKey||'offer-island-v3';this.state=emptyState();this.mode='浏览器本地';this.listeners=[];}
 async init(){
  if(this.demo){this.state=demoState();this.mode='示例 · 不保存';return;}
  if(['localhost','127.0.0.1'].includes(location.hostname)){
   try{const r=await fetch('/api/state',{headers:{'X-Offer-Client':'web'}});if(r.ok){const d=await r.json();if(d.app==='offer-island'){this.remote=true;this.state=d.state;this.mode='桌面 · SQLite';}}}catch{}
  }
  if(!this.remote){const raw=localStorage.getItem(this.key);if(raw){this.state=JSON.parse(raw);if(this.state.version!==3)throw Error('不支持此数据版本，请导出原数据后再迁移');normalizeImport(this.state);}else await this.migrate();
   addEventListener('storage',e=>{if(e.key===this.key&&e.newValue){try{this.state=JSON.parse(e.newValue);this.emit();}catch{}}});
  }else setInterval(async()=>{try{const r=await fetch('/api/state',{headers:{'X-Offer-Client':'web'}});const d=await r.json();if(d.state.revision!==this.state.revision){this.state=d.state;this.emit();}}catch{}},3000);
 }
 async migrate(){
  const cfg=window.OFFER_CONFIG||{},appKeys=cfg.legacyApps||['offer-island-applications-v1','offer-applications-v1','job-island-applications-v1'],eventKeys=cfg.legacyEvents||['offer-island-calendar-v1','offer-calendar-v1','job-island-calendar-v1'];
  let apps=null,events=null;for(const k of appKeys){if(localStorage.getItem(k)){apps=JSON.parse(localStorage.getItem(k));break;}}
  for(const k of eventKeys){if(localStorage.getItem(k)){events=JSON.parse(localStorage.getItem(k));break;}}
  apps=apps||cfg.seed||[];events=events||[];
  if(!Array.isArray(apps)||!Array.isArray(events))throw Error('旧数据格式异常，原数据已保留');
  const merged=apps.map(x=>normalize('applications',x));for(const r of cfg.seed||[])if(!merged.some(x=>x.id===r.id))merged.push(normalize('applications',r));
  this.state.applications=merged;this.state.events=events.map(x=>normalize('events',x));localStorage.setItem(this.key,JSON.stringify(this.state));
 }
 on(fn){this.listeners.push(fn);}emit(){this.listeners.forEach(fn=>fn(this.state));}
 async dispatch(command,expected=this.state.revision){
  if(this.remote){const r=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-Offer-Client':'web'},body:JSON.stringify({command,expectedRevision:expected})});const d=await r.json();if(!r.ok){if(d.state){this.state=d.state;this.emit();}throw Error(d.error||'保存失败');}this.state=d.state;}
  else {const work=()=>{if(!this.demo){const latest=JSON.parse(localStorage.getItem(this.key)||'null');if(latest&&latest.revision!==expected){this.state=latest;this.emit();throw Error('另一窗口已更新数据。请重新打开编辑，避免覆盖。');}}const next=applyCommand(this.state,command);if(!this.demo)localStorage.setItem(this.key,JSON.stringify(next));this.state=next;};if(navigator.locks)await navigator.locks.request(this.key,work);else work();}
  this.emit();return this.state;
 }
}
