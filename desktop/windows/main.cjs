const {app,BrowserWindow,Tray,Menu,ipcMain,shell,screen,dialog,utilityProcess}=require('electron');
const path=require('node:path');const fs=require('node:fs');const {clampBounds}=require('./geometry.cjs');
const origin='http://127.0.0.1:18783';
let win,tray,backend,timer,modal=false,quitting=false;
const root=app.isPackaged?path.join(process.resourcesPath,'app'):path.resolve(__dirname,'../..');
const icon=app.isPackaged?path.join(process.resourcesPath,'icon.png'):path.join(root,'desktop/assets/OfferIslandIcon.png');
const settings=()=>path.join(app.getPath('userData'),'window.json');
const trusted=url=>url===origin+'/island.html';
function external(url){try{if(['https:','http:'].includes(new URL(url).protocol))shell.openExternal(url)}catch{}}
function expand(value){if(win&&!win.isDestroyed())win.webContents.executeJavaScript(`window.offerIslandSetExpanded?.(${Boolean(value)})`).catch(()=>{})}
function show(){win.show();win.focus()}
function save(){if(!win||win.isDestroyed())return;fs.writeFileSync(settings(),JSON.stringify(win.getBounds()))}
function menu(){tray.setContextMenu(Menu.buildFromTemplate([
 {label:'显示小岛',click:show},{label:'打开本地工作台',click:()=>external(origin)},
 {label:'打开在线工作台',click:()=>external('https://offer-island-milan.netlify.app/')},
 {label:'小岛显示器',submenu:screen.getAllDisplays().map((display,i)=>({label:display.label||`显示器 ${i+1}`,click:()=>{win.setBounds(clampBounds({...win.getBounds(),x:display.workArea.x+20,y:display.workArea.y+20},display.workArea));show();save()}}))},
 {label:'始终置顶',type:'checkbox',checked:win.isAlwaysOnTop(),click:item=>win.setAlwaysOnTop(item.checked)},
 {type:'separator'},{label:'退出 Offer Island',click:()=>app.quit()}
]))}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>win&&show());
 app.whenReady().then(async()=>{
  app.setAppUserModelId('io.offer-island.windows');
  const data=path.join(app.getPath('appData'),'Offer Island');fs.mkdirSync(data,{recursive:true});
  backend=utilityProcess.fork(path.join(root,'server/http.mjs'),[],{env:{...process.env,OFFER_PORT:'18783',OFFER_DB:path.join(data,'offer.sqlite')},stdio:'pipe'});
  let started=false;backend.on('exit',()=>{if(!quitting){dialog.showErrorBox('Offer Island','本地服务已停止，或端口 18783 已被占用。请关闭旧实例后重试。');app.quit()}});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('本地服务启动超时')),15000);backend.stdout.on('data',chunk=>{if(chunk.toString().includes('Offer Island:')){started=true;clearTimeout(timeout);resolve()}});backend.on('exit',()=>{clearTimeout(timeout);if(!started)reject(Error('本地服务启动失败'))})});
  let bounds={width:480,height:112,x:screen.getPrimaryDisplay().workArea.x+20,y:screen.getPrimaryDisplay().workArea.y+20};
  try{const saved=JSON.parse(fs.readFileSync(settings()));if(['x','y'].every(k=>Number.isFinite(saved[k])))bounds={...bounds,x:saved.x,y:saved.y}}catch{}
  bounds=clampBounds(bounds,screen.getDisplayMatching(bounds).workArea);
  win=new BrowserWindow({...bounds,frame:false,transparent:true,resizable:false,alwaysOnTop:true,show:false,skipTaskbar:true,icon,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'}});
  win.webContents.on('will-navigate',(event,url)=>{if(!trusted(url)){event.preventDefault();external(url)}});
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.webContents.on('did-start-loading',()=>{modal=false;clearTimeout(timer);win.setSize(win.getBounds().width,112)});
  win.on('close',event=>{if(!quitting){event.preventDefault();win.hide()}});win.on('moved',save);
  tray=new Tray(icon);tray.setToolTip('Offer Island · 求职小岛');tray.on('click',show);menu();
  screen.on('display-removed',()=>{win.setBounds(clampBounds(win.getBounds(),screen.getDisplayMatching(win.getBounds()).workArea));menu();save()});screen.on('display-added',menu);
  ipcMain.on('island-action',(event,message)=>{
   if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!trusted(event.senderFrame.url)||!message)return;
   switch(message.action){
    case 'main':external(origin);break;case 'online':external('https://offer-island-milan.netlify.app/');break;case 'hide':win.hide();break;
    case 'accountModal':modal=message.open===true;clearTimeout(timer);if(modal)win.setBounds(clampBounds({...win.getBounds(),height:560},screen.getDisplayMatching(win.getBounds()).workArea));else expand(false);break;
    case 'resize':if(!modal&&Number.isFinite(message.height))win.setBounds(clampBounds({...win.getBounds(),height:Math.max(112,Math.min(720,Math.round(message.height)))},screen.getDisplayMatching(win.getBounds()).workArea));break;
    case 'hover':clearTimeout(timer);if(!modal)timer=setTimeout(()=>expand(message.inside===true),message.inside?80:300);break;
   }
  });
  await win.loadURL(origin+'/island.html');show();
 }).catch(error=>{if(!quitting)dialog.showErrorBox('Offer Island',error.message);app.quit()});
 app.on('before-quit',()=>{quitting=true;clearTimeout(timer);save();backend?.kill()});
 app.on('window-all-closed',()=>{});
}
