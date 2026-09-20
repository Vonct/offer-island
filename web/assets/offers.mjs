import {OFFER_STATUSES,CURRENCIES,normalize,offerAnnualFixed} from '../core/model.mjs';
import {dismissOnBackdrop} from './dialog.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(n,currency)=>n==null?'待补充':new Intl.NumberFormat('zh-CN',{style:'currency',currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
const statusClass=s=>['thinking','accepted','declined','expired'][OFFER_STATUSES.indexOf(s)]||'thinking';
const input=(name,label,value='',type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const area=(name,label,value='')=>`<label class="full">${label}<textarea name="${name}" rows="3" maxlength="20000">${esc(value)}</textarea></label>`;
const select=(name,label,items,value)=>`<label>${label}<select name="${name}">${items.map(item=>{const [v,t]=Array.isArray(item)?item:[item,item];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`}).join('')}</select></label>`;
function animate(el,keyframes,options){if(el?.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate(keyframes,options);}
export function mountOffers(store,{toast}){
 const grid=document.querySelector('#offer-grid'),dialog=document.querySelector('#offer-editor'),detail=document.querySelector('#offer-detail');
 let filter='',signature='',freshId='';
 dismissOnBackdrop(dialog);dismissOnBackdrop(detail);
 function render(){
  const offers=store.state.offers||[];
  const next=JSON.stringify([offers,filter]);if(next===signature)return;signature=next;
  const list=offers.filter(o=>!filter||o.status===filter);
  document.querySelector('#offer-count').textContent=`${offers.length} 份好消息 · ${offers.filter(o=>o.status==='考虑中').length} 份考虑中`;
  grid.innerHTML=list.length?list.map((o,i)=>`<article class="offer-card ${statusClass(o.status)}" data-offer-card="${esc(o.id)}"><button class="offer-card-open" data-open-offer="${esc(o.id)}" aria-label="查看 ${esc(o.company)} ${esc(o.role)} 的 Offer"><div class="offer-card-top"><span class="offer-monogram" aria-hidden="true">${esc(o.company.slice(0,1))}</span><span class="offer-sequence">GOOD NEWS / ${String(i+1).padStart(2,'0')}</span></div><h3>${esc(o.company)}</h3><p class="offer-role">${esc(o.role)}</p><div class="offer-pay"><strong>${o.monthlySalary==null?'薪资待补充':esc(money(o.monthlySalary,o.currency))}</strong>${o.monthlySalary!=null?`<span> / 月${o.salaryMonths!=null?' × '+esc(o.salaryMonths)+' 薪':''}</span>`:''}</div><p class="offer-annual">${offerAnnualFixed(o)==null?'补充薪资后，方便慢慢比较':`年固定薪资参考 ${esc(money(offerAnnualFixed(o),o.currency))}`}</p><p class="offer-location"><span aria-hidden="true">⌖</span> ${esc(o.location||'Base 待补充')}</p><p class="offer-benefits">${esc(o.benefits||'福利、假期与其他心动的细节，等你记下。')}</p><div class="offer-card-bottom"><span class="offer-status">${esc(o.status)}</span><span class="offer-arrow" aria-hidden="true">↗</span></div></button></article>`).join(''):`<div class="offer-empty"><div class="offer-envelope" aria-hidden="true"><span>✳</span></div><h3>${filter?'这里暂时没有对应的 Offer':'下一封好消息，留在这里。'}</h3><p>${filter?'切换筛选，看看其他机会。':'从投递清单带入，或手动记下新的机会。薪资和福利可以之后补充。'}</p><button data-new-offer>＋ 记录收到的 Offer</button></div>`;
  if(freshId){const card=[...grid.querySelectorAll('[data-offer-card]')].find(el=>el.dataset.offerCard===freshId);animate(card,[{transform:'translateY(18px) scale(.95)',opacity:0},{transform:'translateY(-4px) scale(1.018,.987)',opacity:1,offset:.65},{transform:'translateY(0) scale(1)'}],{duration:500,easing:'cubic-bezier(.22,.8,.3,1)'});freshId='';}
 }
 function edit(record={},onSave=null){
  const revision=store.state.revision;
  const jobs=[['','手动填写 · 不关联投递'],...store.state.applications.map(a=>[a.id,`${a.company} · ${a.role}`])];
  dialog.innerHTML=`<form><div class="offer-dialog-head"><div><p class="eyebrow">A LETTER OF POSSIBILITY</p><h2 id="offer-editor-title">${record.id?'编辑':'收下'}这份好消息</h2></div><button type="button" data-close aria-label="关闭 Offer 编辑">×</button></div><p class="offer-form-intro">先记下确定的部分，其他留待慢慢确认。金额使用所选币种；带入投递只填写公司与职位。</p><div class="form-grid">${select('job','从投递清单带入',jobs,record.job||'')}${select('status','当前决定',OFFER_STATUSES,record.status||'考虑中')}${input('company','公司 *',record.company,'text','required maxlength="20000"')}${input('role','职位 *',record.role,'text','required maxlength="20000"')}${input('location','Base / 工作城市',record.location,'text','placeholder="例如：杭州 · 滨江 / 远程" maxlength="20000"')}${select('currency','薪资币种',CURRENCIES,record.currency||'CNY')}<div class="offer-form-divider full"><span>01 / 薪资，认真算一算</span></div>${input('monthlySalary','税前月薪',record.monthlySalary,'number','min="0" max="1000000000" step="0.01" placeholder="待确认可留空"')}${input('salaryMonths','确认的计薪月数',record.salaryMonths,'number','min="1" max="24" step="0.01" placeholder="例如 12、14；不默认填入"')}<output class="offer-calculation full" aria-live="polite"></output>${input('annualBonus','额外年终 / 绩效奖金',record.annualBonus,'number','min="0" max="1000000000" step="0.01" placeholder="不含上面计薪月数里的薪资"')}${input('signOn','一次性签字费',record.signOn,'number','min="0" max="1000000000" step="0.01"')}${area('equity','股票 / 期权',record.equity)}${area('salaryNotes','薪资口径与待确认事项',record.salaryNotes)}<div class="offer-form-divider full"><span>02 / 薪资之外，也很重要</span></div>${area('benefits','其他福利',record.benefits)}${input('receivedDate','收到日期',record.receivedDate,'date')}${input('deadline','答复截止日期',record.deadline,'date')}${input('startDate','预计入职日期',record.startDate,'date')}${area('notes','其他备注 / 你的想法',record.notes)}</div><p class="form-error" role="alert"></p><div class="dialog-actions">${record.id&&!onSave?'<button type="button" class="danger" data-delete>删除 Offer</button>':''}<button type="button" data-cancel>取消</button><button type="submit">${onSave?'确认核对':'保存好消息'} ↗</button></div></form>`;
  const form=dialog.querySelector('form');let busy=false;
  const error=dialog.querySelector('.form-error');
  const close=()=>{if(!busy)dialog.close();};dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-cancel]').onclick=close;
  form.elements.job.onchange=()=>{const job=store.state.applications.find(a=>a.id===form.elements.job.value);if(job){form.elements.company.value=job.company;form.elements.role.value=job.role;}};
  const calculate=()=>{const salary=form.elements.monthlySalary.value,months=form.elements.salaryMonths.value;const valid=salary!==''&&months!==''&&form.elements.monthlySalary.validity.valid&&form.elements.salaryMonths.validity.valid;form.querySelector('output').textContent=valid?`年固定薪资参考 ${money(Math.round(Number(salary)*Number(months)*100)/100,form.elements.currency.value)} · 不含额外奖金、签字费和股权`:'填写已确认的月薪与计薪月数后显示年固定薪资参考。';};
  for(const key of ['monthlySalary','salaryMonths','currency'])form.elements[key].addEventListener('input',calculate);calculate();
  form.onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   try{
    const value=normalize('offers',{...record,...Object.fromEntries(new FormData(form))});
    if(onSave){onSave(value);dialog.close();return;}
    busy=true;form.querySelector('[type=submit]').disabled=true;
    await store.dispatch({type:'upsert',kind:'offers',record:value},revision);
    filter='';document.querySelector('#offer-filter').value='';freshId=value.id;signature='';render();dialog.close();toast('好消息已收好 · 可撤销');
   }catch(err){freshId='';error.textContent=err.message;}finally{busy=false;form.querySelector('[type=submit]').disabled=false;}
  };
  const del=form.querySelector('[data-delete]');if(del)del.onclick=async()=>{
   if(busy)return;
   if(del.dataset.confirm!=='yes'){del.dataset.confirm='yes';del.textContent='再次点击确认删除';return;}
   busy=true;del.disabled=true;
   try{await store.dispatch({type:'delete',kind:'offers',id:record.id},revision);dialog.close();toast('Offer 已删除 · 可撤销');}catch(err){error.textContent=err.message;}finally{busy=false;del.disabled=false;}
  };
  if(!dialog.open)dialog.showModal();form.elements[record.id?'company':'job'].focus();
  animate(dialog,[{opacity:0,transform:'translateY(16px) scale(.97)'},{opacity:1,transform:'translateY(-2px) scale(1.006)',offset:.75},{opacity:1,transform:'none'}],{duration:320,easing:'ease-out'});
 }
 function open(id){
  const o=store.state.offers?.find(x=>x.id===id);if(!o)return;
  const job=store.state.applications.find(a=>a.id===o.job);
  const row=(label,value)=>`<div class="offer-detail-row"><dt>${label}</dt><dd>${esc(value||'待补充')}</dd></div>`;
  detail.innerHTML=`<div class="offer-dialog-head"><p class="eyebrow">YOUR NEXT CHAPTER</p><button type="button" data-close aria-label="关闭 Offer 详情">×</button></div><div class="offer-letter"><span class="offer-seal" aria-hidden="true">✳</span><span class="offer-status ${statusClass(o.status)}">${esc(o.status)}</span><h2 id="offer-detail-title">${esc(o.company)}</h2><p class="offer-detail-role">${esc(o.role)}</p><p class="offer-detail-pay">${esc(money(o.monthlySalary,o.currency))}<small>${o.monthlySalary!=null?' / 月':''}${o.salaryMonths!=null?' × '+esc(o.salaryMonths)+' 薪':''}</small></p><p class="offer-annual">年固定薪资参考：${esc(money(offerAnnualFixed(o),o.currency))}</p><dl>${row('Base / 工作城市',o.location)}${row('额外年终 / 绩效奖金',money(o.annualBonus,o.currency))}${row('一次性签字费',money(o.signOn,o.currency))}${row('股票 / 期权',o.equity)}${row('薪资口径与待确认事项',o.salaryNotes)}${row('其他福利',o.benefits)}${row('收到日期',o.receivedDate)}${row('答复截止',o.deadline)}${row('预计入职',o.startDate)}${row('其他备注',o.notes)}${row('关联投递',job?job.company+' · '+job.role:'独立 Offer')}</dl></div><div class="dialog-actions"><button data-close-bottom>关闭</button><button data-edit-offer>编辑这份 Offer ↗</button></div>`;
  detail.querySelector('[data-close]').onclick=()=>detail.close();detail.querySelector('[data-close-bottom]').onclick=()=>detail.close();
  detail.querySelector('[data-edit-offer]').onclick=()=>{detail.close();const latest=store.state.offers?.find(x=>x.id===id);if(latest)edit(latest);else toast('这份 Offer 已在另一端删除，请刷新列表。');};
  detail.showModal();animate(detail,[{transform:'translateY(18px) scale(.96)',opacity:0},{transform:'translateY(-3px) scale(1.008)',opacity:1,offset:.7},{transform:'none',opacity:1}],{duration:380,easing:'ease-out'});
 }
 grid.onclick=e=>{const button=e.target.closest('button');if(button?.dataset.openOffer)open(button.dataset.openOffer);else if(button?.hasAttribute('data-new-offer'))edit();};
 grid.onpointerup=e=>{const card=e.target.closest('[data-offer-card]');animate(card,[{transform:'scale(.98,1.01)'},{transform:'scale(1.015,.99)',offset:.4},{transform:'scale(.998,1.002)',offset:.7},{transform:'none'}],{duration:360,easing:'ease-out'});};
 document.querySelector('#add-offer').onclick=()=>edit();
 document.querySelector('#offer-filter').onchange=e=>{filter=e.target.value;render();};
 return {render,edit};
}
