import {getCloud} from '../core/cloud.mjs';
const $=s=>document.querySelector(s);
let report,cloud,busy=false,authorized=false;
const fmt=n=>Number(n||0).toLocaleString('zh-CN');
const localDay=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s));
const date=s=>new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
function access(title,message){
 authorized=false;report=null;$('#dashboard').hidden=true;$('#access').hidden=false;
 $('#access-title').textContent=title;$('#access-message').textContent=message;
 $('#range').disabled=true;$('#refresh').disabled=true;$('#status').textContent='仅管理员可查看运营数据';
}
function render(data){
 const s=data.summary;
 $('#metrics').innerHTML=[['累计注册',s.registered,`今日新增 ${fmt(s.today_new)} 人`],['今日活跃',s.active_today,'按账号去重 · 北京时间'],['近 7 天活跃',s.active_7,'过去 7 个自然日去重'],['近 30 天活跃',s.active_30,'过去 30 个自然日去重']].map(([label,n,note])=>`<div class="metric"><p>${label}</p><strong>${fmt(n)}</strong><small>${note}</small></div>`).join('');
 $('#period-summary').textContent=`本期新增 ${fmt(s.period_new)} 人 · ${fmt(s.period_active)} 个活跃账号 · ${fmt(s.period_saves)} 次成功保存`;
 const rows=[['注册账号',s.registered],['已验证邮箱',s.confirmed],['云端已有内容',s.populated]];
 $('#funnel').innerHTML=rows.map(([name,n])=>`<div class="funnel-row"><div class="funnel-label"><span>${name}</span><span>${fmt(n)} <small>/ ${s.registered?Math.round(n/s.registered*100):0}%</small></span></div><div class="track"><div style="width:${s.registered?Math.min(100,n/s.registered*100):0}%"></div></div></div>`).join('');
 $('#content-totals').innerHTML=[['投递记录',s.applications],['日程安排',s.events],['面试手记',s.experiences]].map(([label,n])=>`<div class="total-row"><span>${label}</span><b>${fmt(n)}</b></div>`).join('');
 $('#daily').replaceChildren(...[...data.daily].reverse().map(row=>{const tr=document.createElement('tr');for(const value of [row.day,row.registrations,...(row.day<localDay(data.started_at)?['未采集','未采集','未采集']:[row.active,row.writers,row.saves])]){const td=document.createElement('td');td.textContent=typeof value==='number'?fmt(value):value;tr.append(td);}return tr;}));
 $('#coverage').textContent=`使用统计自 ${date(data.started_at)} 启用，启用当日可能不完整；此前的活跃与保存次数未采集。注册趋势来自当前仍存在的账号，注销账号不再计入。`;
 chart(data.daily,data.started_at);
}
function chart(rows,started){
 const width=1080,height=270,left=38,right=18,top=20,bottom=36;
 const rawMax=Math.max(1,...rows.flatMap(r=>[r.active,r.registrations]));
 const step=Math.max(1,Math.ceil(rawMax/4)),max=step*4;
 const x=i=>left+i*(width-left-right)/Math.max(1,rows.length-1),y=n=>height-bottom-n/max*(height-top-bottom);
 const startDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(started));
 const observed=rows.map((r,i)=>({...r,i})).filter(r=>r.day>=startDay);
 const points=(items,key)=>items.map(r=>`${x(r.i)},${y(r[key])}`).join(' ');
 let svg=`<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="每日新增注册与活跃账号趋势，完整数值见下方表格">`;
 for(let i=0;i<=4;i++){const n=i*step;svg+=`<line class="grid" x1="${left}" y1="${y(n)}" x2="${width-right}" y2="${y(n)}"/><text x="${left-12}" y="${y(n)+4}" text-anchor="end">${n}</text>`;}
 svg+=`<polyline fill="none" stroke="#c65325" stroke-width="2.5" points="${points(rows.map((r,i)=>({...r,i})),'registrations')}"/><polyline fill="none" stroke="#477965" stroke-width="2.5" points="${points(observed,'active')}"/>`;
 rows.forEach((r,i)=>{
  svg+=`<circle cx="${x(i)}" cy="${y(r.registrations)}" r="3" fill="#c65325"/>`;
  if(r.day>=startDay)svg+=`<circle cx="${x(i)}" cy="${y(r.active)}" r="3" fill="#477965"/>`;
  const label=`${r.day}：新增 ${r.registrations}，活跃 ${r.day>=startDay?r.active:'未采集'}`;
  svg+=`<rect class="hit" data-i="${i}" tabindex="0" role="button" aria-label="${label}" x="${x(i)-Math.min(15,(width-left-right)/rows.length/2)}" y="${top}" width="${Math.min(30,(width-left-right)/rows.length)}" height="${height-top-bottom}"><title>${label}</title></rect>`;
  if(i===0||i===rows.length-1||i%Math.ceil(rows.length/6)===0)svg+=`<text x="${x(i)}" y="${height-8}" text-anchor="middle">${r.day.slice(5).replace('-','/')}</text>`;
 });
 $('#chart').innerHTML=svg+'</svg>';
 const detail=el=>{const r=rows[Number(el.dataset.i)];$('#chart-detail').textContent=`${r.day}　新增注册 ${fmt(r.registrations)} 人　·　${r.day>=startDay?`活跃 ${fmt(r.active)} 人　·　保存 ${fmt(r.saves)} 次`:'使用统计未采集'}`;};
 $('#chart').querySelectorAll('[data-i]').forEach(el=>{el.onfocus=()=>detail(el);el.onclick=()=>detail(el);el.onpointerenter=()=>detail(el);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();detail(el);}};});
 $('#chart-detail').textContent='';
}
async function refresh(){
 if(busy||!authorized)return;busy=true;$('#refresh').disabled=true;$('#range').disabled=true;$('#status').textContent='正在读取汇总数据…';
 try{
  const {data,error}=await cloud.rpc('offer_analytics',{window_days:Number($('#range').value)});
  if(error)throw error;
  report=data;render(data);$('#access').hidden=true;$('#dashboard').hidden=false;$('#status').textContent=`更新于 ${date(data.generated_at)} · 北京时间`;
 }catch(e){
  report=null;$('#dashboard').hidden=true;
  if(e.code==='42501'||e.code==='PGRST301'){access('暂无查看权限','请使用已授权的管理员账号登录。');}
  else $('#status').textContent='统计暂时无法加载，请点击刷新重试。';
 }finally{busy=false;$('#refresh').disabled=!authorized;$('#range').disabled=!authorized;}
}
$('#refresh').onclick=refresh;$('#range').onchange=refresh;
$('#export').onclick=()=>{
 if(!report)return;
 const csv='\uFEFF日期,新增注册,活跃账号,保存账号,成功保存次数\r\n'+report.daily.map(r=>[r.day,r.registrations,...(r.day<localDay(report.started_at)?['','','']:[r.active,r.writers,r.saves])].join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`offer-island-${report.daily[0].day}-${report.daily.at(-1).day}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
async function init(){
 try{
  cloud=await getCloud();const {data,error}=await cloud.auth.getSession();if(error)throw error;
  if(!data.session){access('需要管理员登录','在工作台登录你的管理账号，再回到这里查看。');return;}
  cloud.auth.onAuthStateChange((event,current)=>{if(event==='SIGNED_OUT'||(current&&current.user.id!==data.session.user.id))location.reload();});
  const check=await cloud.rpc('offer_is_admin');if(check.error)throw check.error;
  if(check.data!==true){access('暂无查看权限','这个账号还未被授权查看运营统计。');return;}
  authorized=true;await refresh();
 }catch{access('暂时无法连接','请检查网络，稍后重新打开看板。');}
}
addEventListener('storage',e=>{if(e.key==='offer-cloud-session-v1')location.reload();});
init();
