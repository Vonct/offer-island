import {getCloud} from '../core/cloud.mjs';
import {cloudConfig} from '../core/cloud-config.mjs';
let worker,idleTimer,busy=false;
const stop=()=>{clearTimeout(idleTimer);worker?.terminate();worker=null;};
export function validateImage(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 PNG、JPEG 或 WebP 图片。');
 if(file.size>8000000)throw Error('图片最大 8MB，请裁剪后重试。');
}
export async function recognizeImage(file,{mode='local',signal,onProgress=()=>{}}={}){
 validateImage(file);signal?.throwIfAborted();
 if(busy)throw Error('正在识别上一张图片，请等待或取消。');
 busy=true;
 try{
  const bitmap=await createImageBitmap(file);
  const pixels=bitmap.width*bitmap.height;bitmap.close();
  if(pixels>12000000)throw Error('截图过大，请裁剪到通知内容后重试（最多 1200 万像素）。');
  signal?.throwIfAborted();
  if(mode==='cloud'){
   const cloud=await getCloud(),{data:{session}}=await cloud.auth.getSession();
   if(!session)throw Error('请先登录，或切换为本机识别。');
   onProgress('正在通过 DeepSeek 识别…');
   const response=await fetch(cloudConfig.url+'/functions/v1/offer-ocr',{
    method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:cloudConfig.publishableKey,'Content-Type':file.type},body:file,signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(65000)])
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'云端识别暂不可用，请切换为本机识别。');
   return result.text;
  }
  // Native capability is independent of the current storage/login mode.
  if(['127.0.0.1','localhost'].includes(location.hostname)){
   try{
    const capability=await fetch('/api/ocr-capabilities',{headers:{'X-Offer-Client':'web'},signal});
    if(capability.ok&&(await capability.json()).native){
     onProgress('正在本机识别…');
     const response=await fetch('/api/ocr',{method:'POST',headers:{'Content-Type':file.type,'X-Offer-Client':'web'},body:file,signal});
     const result=await response.json();
     if(response.ok)return result.text;
    }
   }catch(error){if(signal?.aborted)throw error;}
  }
  signal?.throwIfAborted();clearTimeout(idleTimer);
  onProgress('准备本机识别；首次需加载中英文模型…');
  return await new Promise((resolve,reject)=>{
   worker??=new Worker(new URL('./ocr-worker.js',import.meta.url));
   const finish=(error,text)=>{clearTimeout(timeout);signal?.removeEventListener('abort',abort);if(error){stop();reject(error);}else{idleTimer=setTimeout(stop,60000);resolve(text);}};
   const abort=()=>finish(new DOMException('已取消识别','AbortError'));
   const timeout=setTimeout(()=>finish(Error('识别超时，请裁剪图片后重试。')),90000);
   signal?.addEventListener('abort',abort,{once:true});
   worker.onerror=()=>finish(Error('无法加载本机识别引擎，请刷新页面后重试。'));
   worker.onmessage=({data})=>{
    if(data.error)return finish(Error(data.error));
    if('text' in data)return finish(null,data.text);
    if(data.progress)onProgress(data.progress.status==='recognizing text'?`正在本机识别 ${Math.round(data.progress.progress*100)}%`:'正在加载本机识别模型…');
   };
   worker.postMessage({image:file});
  });
 }finally{busy=false;}
}
