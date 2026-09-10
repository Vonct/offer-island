// A dedicated owner worker lets cancellation terminate initialization and its child worker.
importScripts('../vendor/ocr/tesseract.min.js');
let engine;
self.onmessage=async({data})=>{
 try{
  engine??=await Tesseract.createWorker(['chi_sim','eng'],1,{
   workerPath:new URL('../vendor/ocr/worker.min.js',self.location.href).href,
   corePath:new URL('../vendor/ocr/core/',self.location.href).href,
   langPath:new URL('../vendor/ocr/lang',self.location.href).href,
   workerBlobURL:false,
   logger:progress=>self.postMessage({progress}),
  });
  const result=await engine.recognize(data.image);
  self.postMessage({text:result.data.text});
 }catch{self.postMessage({error:'本机识别失败，请换一张清晰截图，或粘贴通知文字。'});}
};
