// One successful heartbeat per visible account/day. No content or anonymous tracking.
export function startActivityTracking(cloud, env=globalThis){
 let recordedDay='',busy=false;
 const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 async function record(){
  const current=day();
  if(env.document.visibilityState!=='visible'||busy||recordedDay===current)return;
  busy=true;
  try{const {error}=await cloud.rpc('offer_record_activity');if(!error)recordedDay=current;}catch{}finally{busy=false;}
 }
 env.document.addEventListener('visibilitychange',record);
 const timer=env.setInterval(record,60000);record();
 return ()=>{env.clearInterval(timer);env.document.removeEventListener('visibilitychange',record);};
}
