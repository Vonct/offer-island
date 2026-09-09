export const STATUSES=['已投递','筛选中','测评中','面试','Offer','拒绝/已结束','待确认'];
export const TYPES=['面试','笔试','测评','宣讲会','准备','其他'];
export const emptyState=()=>({version:3,revision:0,applications:[],events:[],experiences:[],history:[],undo:[]});
export const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const id=()=>crypto.randomUUID();
const str=(v,max=20000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)throw Error('字段类型或长度不正确');return v.trim()};
export function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(`${v}T12:00:00Z`).toISOString().slice(0,10)===v;}
export function normalize(kind,x){
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('记录必须是对象');
 const out={id:str(x.id,120)||id()};
 if(kind==='applications'){
  for(const k of ['company','role','jd','date','status','notes','next','link','source','rawStatus'])out[k]=str(x[k]??(k==='notes'?x.evidence:undefined));
  if(!out.company||!out.role)throw Error('公司和职位必填');out.status||='待确认';
  if(!STATUSES.includes(out.status))throw Error('未知投递状态');
  if(out.link&&!/^https?:\/\//i.test(out.link))throw Error('链接须以 https:// 或 http:// 开头');
 }else if(kind==='events'){
  for(const k of ['title','type','date','time','job','location','notes','source'])out[k]=str(x[k]);
  out.type||='面试';if(!out.title||!validDate(out.date)||!TYPES.includes(out.type))throw Error('请填写日程名称、有效日期和类型');
  if(out.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(out.time))throw Error('时间格式应为 HH:MM');
  if(x.done!==undefined&&typeof x.done!=='boolean')throw Error('完成状态须为布尔值');out.done=x.done??false;
 }else if(kind==='experiences'){
  for(const k of ['title','job','date','round','questions','reflection','notes'])out[k]=str(x[k]);
  if(!out.title)throw Error('经验标题必填');if(out.date&&!validDate(out.date))throw Error('经验日期无效');
 }else throw Error('未知记录类型');
 return out;
}
export function normalizeImport(input){
 if(Array.isArray(input)) input={applications:input};
 if(!input||typeof input!=='object')throw Error('无法读取导入内容');
 if(input.version!==undefined&&![1,3].includes(input.version))throw Error('不支持此备份版本');
 const out={};let found=false;
 for(const kind of ['applications','events','experiences']){const list=input[kind]??[];if(input[kind])found=true;if(!Array.isArray(list)||list.length>5000)throw Error('导入记录过多或格式不正确');out[kind]=list.map(x=>normalize(kind,x));const ids=out[kind].map(x=>x.id);if(new Set(ids).size!==ids.length)throw Error('导入文件包含重复 ID');}
 if(!found)throw Error('未找到 applications、events 或 experiences');return out;
}
const fingerprint=(kind,x)=>kind==='applications'?`${(x.company||'').toLowerCase()}|${(x.role||'').toLowerCase()}`:kind==='events'?`${x.title}|${x.date}|${x.time}|${x.job}`:null;
export function previewImport(state,input){
 const data=normalizeImport(input),changes=[],working=structuredClone(state);
 for(const kind of Object.keys(data))for(const record of data[kind]){
  const old=working[kind].find(x=>x.id===record.id)||working[kind].find(x=>fingerprint(kind,x)&&fingerprint(kind,x)===fingerprint(kind,record));
  const resolved=old?{...record,id:old.id}:record;
  changes.push({kind,record:resolved,action:old?(JSON.stringify(old)===JSON.stringify(resolved)?'duplicate':'update'):'add'});
  if(!old)working[kind].push(resolved);
 }
 return changes;
}
export function applyCommand(state,command){
 const next=structuredClone(state);const c=command||{};const before={applications:state.applications,events:state.events,experiences:state.experiences};
 if(c.type==='undo'){const previous=next.undo.pop();if(!previous)throw Error('没有可以撤销的操作');Object.assign(next,previous);}
 else {
  if(c.type==='upsert'){
   if(!['applications','events','experiences'].includes(c.kind))throw Error('未知记录类型');
   const candidate=c.record||{};const old=next[c.kind].find(x=>x.id===candidate.id)||(!candidate.id?next[c.kind].find(x=>fingerprint(c.kind,candidate)&&fingerprint(c.kind,x)===fingerprint(c.kind,candidate)):null);const record=normalize(c.kind,{...old,...candidate,id:old?.id||candidate.id});
   if(c.kind!=='applications'&&record.job&&!next.applications.some(x=>x.id===record.job))throw Error('关联职位不存在');
   const index=next[c.kind].findIndex(x=>x.id===record.id);if(index<0)next[c.kind].push(record);else next[c.kind][index]=record;
  }else if(c.type==='delete'){
   if(!['applications','events','experiences'].includes(c.kind))throw Error('未知记录类型');
   if(!next[c.kind].some(x=>x.id===c.id))throw Error('记录不存在');next[c.kind]=next[c.kind].filter(x=>x.id!==c.id);
   if(c.kind==='applications')for(const kind of ['events','experiences'])next[kind]=next[kind].map(x=>x.job===c.id?{...x,job:''}:x);
  }else if(c.type==='import'){
   const changes=previewImport(next,c.data),aliases=new Map();
   if(c.data.history!==undefined){if(!Array.isArray(c.data.history)||c.data.history.length>500)throw Error('历史记录格式无效');const history=c.data.history.map(h=>{if(!h||!h.id||!h.at||isNaN(Date.parse(h.at)))throw Error('历史记录无效');return Object.fromEntries(['id','at','actor','type','kind','recordId','beforeStatus','afterStatus'].map(k=>[k,str(h[k])]));});const known=new Set(next.history.map(h=>h.id));next.history.push(...history.filter(h=>!known.has(h.id)));}
   const original=normalizeImport(c.data);for(const kind of ['applications'])original[kind].forEach((x,i)=>aliases.set(x.id,changes.filter(v=>v.kind===kind)[i].record.id));
   for(const {kind,record,action} of changes){if(action==='duplicate'||(action==='update'&&!c.overwrite))continue;if(record.job)record.job=aliases.get(record.job)||record.job;const i=next[kind].findIndex(x=>x.id===record.id);if(i<0)next[kind].push(record);else next[kind][i]=record;}
   for(const kind of ['events','experiences'])if(next[kind].some(x=>x.job&&!next.applications.some(a=>a.id===x.job)))throw Error('导入包含不存在的关联职位');
  }else throw Error('未知操作');
  if(JSON.stringify(before)===JSON.stringify({applications:next.applications,events:next.events,experiences:next.experiences})&&JSON.stringify(next.history)===JSON.stringify(state.history))return state;
  next.undo=[...next.undo,before].slice(-20);
 }
 next.revision=state.revision+1;next.history=[...next.history,{id:id(),at:new Date().toISOString(),actor:str(c.actor)||'manual',type:c.type,kind:c.kind||'',recordId:c.record?.id||c.id||'',beforeStatus:state.applications.find(x=>x.id===c.record?.id)?.status||'',afterStatus:next.applications.find(x=>x.id===c.record?.id)?.status||''}].slice(-500);
 return next;
}
export function exportState(s){return {version:3,applications:s.applications,events:s.events,experiences:s.experiences,history:s.history};}
export function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('CSV 引号未闭合');if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}const head=rows.shift()||[];
 const aliases={'公司':'company','职位':'role','岗位JD':'jd','岗位 JD':'jd','JD':'jd','状态':'status','备注':'notes','链接':'link','日期':'date','来源':'source','原始状态':'rawStatus'};
 return {applications:rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(head.map((h,i)=>[aliases[h.trim()]||h.trim(),r[i]||''])))};
}
export function demoState(){const s=emptyState();s.applications=[{id:'demo-a',company:'橡果工作室',role:'前端开发工程师',jd:'负责求职小岛的界面开发与体验打磨。\n\n希望你熟悉现代 JavaScript、CSS 与可访问性，并愿意把复杂流程做得温柔而清晰。',status:'面试',date:'日期待确认',notes:'喜欢这里对产品细节的关注。',next:'准备项目讲解',link:'',source:'虚构示例',rawStatus:''},{id:'demo-b',company:'纸飞机科技',role:'AI 应用工程师',jd:'参与 AI 工作流的原型设计、评测和产品化落地。',status:'筛选中',date:'日期待确认',notes:'已提交作品集，等待下一步。',next:'等待反馈',link:'',source:'虚构示例',rawStatus:''},{id:'demo-c',company:'小熊实验室',role:'软件工程师',jd:'',status:'测评中',date:'日期待确认',notes:'留出安静的一小时。',next:'完成笔试',link:'',source:'虚构示例',rawStatus:''}];s.events=[{id:'demo-event',title:'橡果工作室 · 技术一面',type:'面试',date:dateKey(),time:'14:30',job:'demo-a',location:'线上会议',notes:'带上你最喜欢的那个项目。',source:'虚构示例',done:false}];s.experiences=[{id:'demo-note',title:'把项目讲成一个故事',job:'demo-a',date:dateKey(),round:'一面',questions:'遇到最棘手的问题是什么？',reflection:'先说问题和取舍，再解释实现。',notes:'下一次可以更从容一点。'}];return s;}
export function draftFromText(text){
 const source=str(text);const pick=pattern=>source.match(pattern)?.[1]?.trim()||'';
 const company=pick(/(?:公司|企业|Company)\s*[:：]\s*([^\n]+)/i);
 const role=pick(/(?:职位|岗位|Role)\s*[:：]\s*([^\n]+)/i);
 const rawStatus=pick(/(?:当前进度|当前状态|状态|Status)\s*[:：]\s*([^\n]+)/i);
 const date=pick(/(?:投递日期|投递时间)\s*[:：]\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/);
 return {company,role,rawStatus,date,status:STATUSES.includes(rawStatus)?rawStatus:'待确认',source,notes:''};
}
