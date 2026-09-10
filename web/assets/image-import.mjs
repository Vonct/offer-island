import {recognizeImage,validateImage} from './ocr.mjs';
export function mountImageImport(dialog,{signedIn,onText}){
 const area=dialog.querySelector('#image-import');
 area.innerHTML=`<h3>截图识别</h3><p class="import-help">在此粘贴截图（⌘V / Ctrl+V），或选择图片。每次一张，最大 8MB。</p><label>识别方式 <select id="ocr-mode"><option value="local">本机识别 · 图片不上传</option>${signedIn?'<option value="cloud">DeepSeek · 云端识别</option>':''}</select></label><p id="ocr-privacy" class="import-help"></p><input id="ocr-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择截图"><img id="ocr-preview" alt="待识别截图" hidden><div class="dialog-actions"><button id="ocr-start" disabled>开始识别</button><button id="ocr-cancel" hidden>取消识别</button></div><p id="ocr-status" role="status"></p>`;
 const mode=area.querySelector('#ocr-mode'),preview=area.querySelector('#ocr-preview'),start=area.querySelector('#ocr-start'),cancel=area.querySelector('#ocr-cancel'),fileInput=area.querySelector('#ocr-file'),status=area.querySelector('#ocr-status');
 let file,previewURL,controller,disposed=false;
 mode.value=signedIn?'cloud':'local';
 const privacy=()=>{area.querySelector('#ocr-privacy').textContent=mode.value==='cloud'?'点击“开始识别”会将此截图发送给 DeepSeek。仅提取文字，核对后才保存；每账号每日最多 30 次。':'图片留在设备上。首次需加载中英文模型，识别期间可取消；不会改变数据保存位置。';};
 mode.onchange=privacy;privacy();
 function selectImage(next){
  if(controller){status.textContent='请先等待或取消当前识别。';return;}
  try{validateImage(next);file=next;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);preview.src=previewURL;preview.hidden=false;start.disabled=false;status.textContent='图片已就绪，请选择识别方式并开始。';}
  catch(error){status.textContent=error.message;}
 }
 fileInput.onchange=()=>{if(fileInput.files[0])selectImage(fileInput.files[0]);fileInput.value='';};
 const paste=e=>{const images=[...(e.clipboardData?.items||[])].filter(item=>item.type.startsWith('image/'));if(images.length){e.preventDefault();if(images.length>1){status.textContent='请一次只粘贴一张截图。';return;}selectImage(images[0].getAsFile());}};
 dialog.addEventListener('paste',paste);
 const busy=value=>{start.disabled=value||!file;cancel.hidden=!value;mode.disabled=value;fileInput.disabled=value;};
 start.onclick=async()=>{
  controller=new AbortController();const current=controller,started=performance.now();busy(true);
  try{
   const text=await recognizeImage(file,{mode:mode.value,signal:current.signal,onProgress:value=>{if(!disposed)status.textContent=value;}});
   if(disposed||current.signal.aborted)return;
   if(!text?.trim())throw Error('没有识别到文字，请裁剪清晰的通知区域后重试。');
   onText(text);status.textContent=`识别完成，用时 ${((performance.now()-started)/1000).toFixed(1)} 秒。文字已追加到下方，请整理为投递并核对。`; 
  }catch(error){if(!disposed)status.textContent=current.signal.aborted?'已取消识别。':error.message;}
  finally{if(controller===current)controller=null;if(!disposed)busy(false);}
 };
 cancel.onclick=()=>controller?.abort();
 const dispose=()=>{disposed=true;controller?.abort();dialog.removeEventListener('paste',paste);dialog.removeEventListener('close',dispose);if(previewURL)URL.revokeObjectURL(previewURL);};
 dialog.addEventListener('close',dispose,{once:true});
 return {selectImage,dispose};
}
