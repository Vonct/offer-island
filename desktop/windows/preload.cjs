const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('webkit',{messageHandlers:{native:{postMessage:message=>ipcRenderer.send('island-action',message)}}});
window.addEventListener('DOMContentLoaded',()=>{
 const style=document.createElement('style');
 style.textContent='html,body{background:transparent!important} .compact{position:relative;padding-top:18px!important} .windows-drag{-webkit-app-region:drag;position:absolute;top:3px;left:25%;width:50%;height:12px;cursor:move}.windows-drag::after{content:"";display:block;width:36px;height:3px;border-radius:3px;background:#947958;margin:4px auto}';
 document.head.append(style);
 const handle=document.createElement('div');handle.className='windows-drag';handle.title='拖动到任意显示器';document.querySelector('.compact')?.append(handle);
 for(const id of ['hide','minimize']){const el=document.getElementById(id);if(el){el.title='收起到系统托盘';el.setAttribute('aria-label',el.title);if(id==='hide')el.textContent=el.title;}}
 document.documentElement.addEventListener('mouseenter',()=>ipcRenderer.send('island-action',{action:'hover',inside:true}));
 document.documentElement.addEventListener('mouseleave',()=>ipcRenderer.send('island-action',{action:'hover',inside:false}));
});
