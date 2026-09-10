// Treat model output as untrusted input. No IDs or commands can cross this boundary.
export function parseRecognition(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!value.application||typeof value.application!=='object'||Array.isArray(value.application))throw Error('AI 返回的数据格式不正确');
 const application={},warnings=[];
 for(const key of ['company','role','jd','status','date','link','notes','next','rawStatus','source']){
  const text=value.application[key];
  if(text!=null&&(typeof text!=='string'||text.length>20000))throw Error('AI 返回字段格式不正确');
  application[key]=(text||'').trim();
 }
 if(!['已投递','筛选中','测评中','面试','Offer','拒绝/已结束','待确认'].includes(application.status)){application.status='待确认';warnings.push('状态待确认');}
 if(application.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(application.date)||Number.isNaN(Date.parse(application.date))||new Date(application.date).toISOString().slice(0,10)!==application.date)){application.date='';warnings.push('日期待确认');}
 if(application.link){try{const url=new URL(application.link);if(!['https:','http:'].includes(url.protocol))throw Error();}catch{application.link='';warnings.push('链接待确认');}}
 if(!application.company)warnings.push('请补充公司');
 if(!application.role)warnings.push('请补充职位');
 if(value.warnings!=null&&(!Array.isArray(value.warnings)||value.warnings.length>20||value.warnings.some(x=>typeof x!=='string'||x.length>500)))throw Error('AI 返回提示格式不正确');
 return {application,warnings:[...new Set([...warnings,...(value.warnings||[])])]};
}
