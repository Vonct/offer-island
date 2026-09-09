import {Store} from '../core/store.mjs';
import {hostedWorkbench} from '../core/cloud-config.mjs';
import {normalizeImport,previewImport} from '../core/model.mjs';
import {getCloud} from '../core/cloud.mjs';
export async function mountAccount(store){
 if(store.demo)return;
 const slot=document.getElementById('account-slot');if(!slot)return;
 const button=document.createElement('button');button.type='button';button.textContent=store.cloudUser?'账号 · 已登录':'启用云同步';slot.append(button);
 const dialog=document.createElement('dialog');dialog.className='account-dialog';
 dialog.innerHTML=`<form><h2>账号与云同步</h2><p class="account-info"></p><label>邮箱<input name="email" type="email" autocomplete="email" required></label><label>密码<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><label data-invite>邀请码（仅注册需要）<input name="invite" autocomplete="off" maxlength="128"></label><p class="account-message" role="status"></p><div class="account-actions"><button type="button" data-close>关闭</button><button type="button" data-signup>注册</button><button type="submit">登录</button><button type="button" data-signout hidden>退出云同步，使用本地数据</button></div></form>`;
 document.body.append(dialog);
 if(store.cloudUser&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
  const online=document.createElement('a');online.href=hostedWorkbench;online.target='_blank';online.rel='noopener';online.textContent='打开在线工作台 ↗';online.className='account-online';dialog.querySelector('.account-actions').append(online);
 }

 const form=dialog.querySelector('form'),info=dialog.querySelector('.account-info'),message=dialog.querySelector('.account-message');
 info.textContent=store.cloudUser?`已登录 ${store.cloudUser.email}。在线修改保存到账号，另一端约 3 秒更新。`:'现在的数据仅保存在本机。登录后切换到账号工作区，可手动合并本地记录；原本地数据保留，退出云同步后可继续使用。';
 if(store.cloudUser){form.querySelectorAll('label,[data-signup],[type="submit"]').forEach(el=>el.hidden=true);form.querySelector('[data-signout]').hidden=false;}
 button.onclick=()=>{dialog.showModal();window.webkit?.messageHandlers?.native?.postMessage({action:'accountModal',open:true})};dialog.addEventListener('close',()=>window.webkit?.messageHandlers?.native?.postMessage({action:'accountModal',open:false}));form.querySelector('[data-close]').onclick=()=>dialog.close();
 if(store.cloudUser){
  const migration=document.createElement('section');migration.className='account-migration';
  migration.innerHTML='<h3>迁移已有数据</h3><button type="button" data-local>预览本机数据</button><label>选择 JSON 备份<input type="file" accept=".json,application/json"></label><p class="migration-summary" role="status"></p><button type="button" data-import disabled>确认合并到当前账号</button>';
  form.append(migration);let pending=null,revision=null;
  const summary=migration.querySelector('.migration-summary'),commit=migration.querySelector('[data-import]');
  migration.querySelector('[data-local]').onclick=async()=>{
   commit.disabled=true;pending=null;
   try{const local=new Store();await local.initLocal(false);pending=normalizeImport(local.state);revision=store.state.revision;const changes=previewImport(store.state,pending);summary.textContent=`本机数据：${changes.filter(c=>c.action==='add').length} 条新增，${changes.filter(c=>c.action==='update').length} 条差异，${changes.filter(c=>c.action==='duplicate').length} 条重复。确认后仅新增，不覆盖云端记录。`;commit.disabled=store.cloudFailed===true;}catch(e){summary.textContent=e.message;}
  };
  migration.querySelector('input').onchange=async e=>{
   commit.disabled=true;pending=null;
   try{const file=e.target.files[0];if(!file)return;if(file.size>8000000)throw Error('备份最大 8 MB');pending=normalizeImport(JSON.parse(await file.text()));revision=store.state.revision;const changes=previewImport(store.state,pending);summary.textContent=`${changes.filter(c=>c.action==='add').length} 条新增，${changes.filter(c=>c.action==='update').length} 条差异，${changes.filter(c=>c.action==='duplicate').length} 条重复。仅新增，保留账号已有记录。`;commit.disabled=store.cloudFailed===true;}catch(e){summary.textContent=e.message}
  };
  commit.onclick=async()=>{if(!pending)return;commit.disabled=true;try{await store.dispatch({type:'import',data:pending,overwrite:false},revision);summary.textContent=`迁移完成：账号现有 ${store.state.applications.length} 份投递、${store.state.events.length} 项日程、${store.state.experiences.length} 篇面经。`;pending=null;}catch(e){summary.textContent=e.message+'；请重新选择文件核对。'}};
 }
 const footer=document.createElement('div');footer.className='account-footer';footer.append(form.querySelector('[data-close]'));form.append(footer);
 let outsideStart=false;
 const outside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom};
 dialog.addEventListener('pointerdown',e=>outsideStart=outside(e));
 dialog.addEventListener('click',e=>{if(outsideStart&&outside(e))dialog.close();outsideStart=false});
 let busy=false;
 async function run(signup){
  if(busy||!form.reportValidity())return;
  if(signup&&!form.elements.invite.value.trim()){message.textContent='注册需要邀请码，请向邀请你的人索取。';return;}
  busy=true;message.textContent='正在连接…';
  const email=form.elements.email.value.trim(),password=form.elements.password.value;
  try{
   const cloud=await getCloud();
   const {data,error}=signup?await cloud.auth.signUp({email,password,options:{data:{invite_code:form.elements.invite.value.trim()}}}):await cloud.auth.signInWithPassword({email,password});
   if(error)throw error;
   if(data.session){dialog.close();location.reload();}else message.textContent='请查收验证邮件，验证完成后回到这里登录。';
  }catch(e){message.textContent=/Database error saving new user|invite/i.test(e.message)?'邀请码无效、已使用或已过期，请核对后重试。':e.message}finally{busy=false;form.elements.password.value='';}
 }
 form.onsubmit=e=>{e.preventDefault();run(false)};form.querySelector('[data-signup]').onclick=()=>run(true);
 form.querySelector('[data-signout]').onclick=async()=>{const cloud=await getCloud();const {error}=await cloud.auth.signOut({scope:'local'});if(error){message.textContent=error.message;return;}location.reload()};
}
