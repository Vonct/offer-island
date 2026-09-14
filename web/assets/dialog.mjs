// Dismiss only when a primary pointer gesture starts and ends on the backdrop.
// Keeping the dialog mounted preserves form fields and running work.
export function dismissOnBackdrop(dialog){
 let outsideStart=false;
 const outside=event=>{
  if(event.target!==dialog)return false;
  const r=dialog.getBoundingClientRect();
  return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;
 };
 dialog.addEventListener('pointerdown',event=>{outsideStart=event.button===0&&event.isPrimary!==false&&outside(event);});
 dialog.addEventListener('pointercancel',()=>{outsideStart=false;});
 dialog.addEventListener('close',()=>{outsideStart=false;});
 dialog.addEventListener('click',event=>{
  const dismiss=outsideStart&&outside(event);
  outsideStart=false;
  if(dismiss&&dialog.open)dialog.close();
 });
}
