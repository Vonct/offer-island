import {parseRecognitions} from '../core/recognition.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createRecognitionReview({store,toast,fields}){
 const sessions=new WeakMap(),dialog=document.createElement('dialog');
 dialog.className='recognition-dialog';dialog.setAttribute('aria-label','核对截图中的职位');document.body.append(dialog);
 let session,busy=false;
 const capture=()=>{const form=dialog.querySelector('form');if(form&&session?.items.length)session.items[session.index].application=Object.fromEntries(new FormData(form));};
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else capture();});
 function render(){
  const {items,index,total,saved,discarded}=session;
  if(!items.length){
   dialog.innerHTML=`<div class="recognition-complete"><p class="eyebrow">all sorted out.</p><h2>这张截图，整理好了。</h2><p>共 ${total} 个职位 · 已保存 ${saved} 张 · 已丢弃 ${discarded} 张</p><button type="button">返回收件箱</button></div>`;
   dialog.querySelector('button').onclick=()=>dialog.close();return;
  }
  const current=items[index],rev=store.state.revision;
  const side=(item,target,direction)=>item?`<button type="button" class="recognition-side ${direction}" data-select="${target}" aria-label="切换到 ${esc(item.application.company)} · ${esc(item.application.role)}"><span aria-hidden="true"><small>APPLICATION / ${String(item.number).padStart(2,'0')}</small><h3>${esc(item.application.company||'公司待确认')}</h3><p>${esc(item.application.role||'职位待确认')}</p><hr><p>${esc(item.application.status)}</p><p>${esc(item.application.date||'日期待确认')}</p><i></i><i></i><i></i></span></button>`:'';
  dialog.innerHTML=`<header class="recognition-header"><div><p class="eyebrow">one screenshot, more possibilities.</p><h2>逐张核对，留下想要的。</h2><p role="status">识别到 ${total} 个职位 · 待处理 ${items.length} · 已保存 ${saved} · 已丢弃 ${discarded}</p></div><button type="button" data-close aria-label="收起并保留草稿">×</button></header><nav class="recognition-tabs" aria-label="选择待核对职位">${items.map((item,i)=>`<button type="button" data-select="${i}" aria-pressed="${i===index}">${String(item.number).padStart(2,'0')} · ${esc(item.application.role||'职位待确认')}</button>`).join('')}</nav><div class="recognition-deck">${side(items[index-1],index-1,'left')}${side(items[index+1],index+1,'right')}<form class="recognition-card"><div class="recognition-card-heading"><span>APPLICATION / ${String(current.number).padStart(2,'0')}</span><span>${index+1} / ${items.length}</span></div><h3>${esc(current.application.company||'公司待确认')}</h3><p class="recognition-role">${esc(current.application.role||'职位待确认')}</p><p class="import-help">请核对后保存；切换卡片会保留修改。${current.warnings.length?' 待确认：'+esc(current.warnings.join('；')):''}</p><div class="recognition-fields form-grid">${fields(current.application)}</div><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="danger" data-discard>丢弃这张 · Discard</button><button type="submit">保存这张 ↗</button></div></form></div>`;
  dialog.querySelector('[data-close]').onclick=()=>{capture();dialog.close();};
  dialog.querySelectorAll('[data-select]').forEach(button=>button.onclick=()=>{capture();session.index=Number(button.dataset.select);render();dialog.querySelector(`[data-select="${session.index}"]`)?.focus();});
  function remove(kind){session[kind]++;session.items.splice(session.index,1);session.index=Math.min(session.index,session.items.length-1);render();dialog.querySelector('input,button')?.focus();}
  dialog.querySelector('[data-discard]').onclick=()=>remove('discarded');
  dialog.querySelector('form').onsubmit=async event=>{
   event.preventDefault();if(busy)return;capture();busy=true;
   dialog.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=true);
   try{await store.dispatch({type:'upsert',kind:'applications',record:{...current.application}},rev);remove('saved');toast('这张已保存 · 可撤销');}
   catch(error){dialog.querySelector('.form-error').textContent=error.message;}
   finally{busy=false;dialog.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);}
  };
 }
 return result=>{
  if(busy)return;
  if(!sessions.has(result)){const {applications}=parseRecognitions(result);sessions.set(result,{items:applications.map((item,index)=>({...item,number:index+1})),index:0,total:applications.length,saved:0,discarded:0});}
  capture();session=sessions.get(result);render();if(!dialog.open)dialog.showModal();
 };
}
