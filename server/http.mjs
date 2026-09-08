import {createServer} from 'node:http';import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';import {existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {dirname,join,resolve,extname} from 'node:path';import {tmpdir} from 'node:os';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {openStore} from './db.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),web=join(root,'web'),db=openStore(),port=Number(process.env.OFFER_PORT||8780),run=promisify(execFile);
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
async function body(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>8000000)throw Error('文件最大 8MB');chunks.push(c)}return Buffer.concat(chunks)}
const server=createServer(async(req,res)=>{const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};try{
 const host=req.headers.host;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))return send(403,{error:'Host not allowed'});
 const url=new URL(req.url,`http://${host}`);if(url.pathname.startsWith('/api/')){
  if(req.headers['x-offer-client']!=='web'||(req.headers.origin&&req.headers.origin!==`http://${host}`))return send(403,{error:'Origin not allowed'});
  if(req.method==='GET'&&url.pathname==='/api/state')return send(200,{app:'offer-island',state:db.read()});
  if(req.method==='POST'&&url.pathname==='/api/command'){const d=JSON.parse((await body(req)).toString());if(!Number.isInteger(d.expectedRevision))throw Error('缺少数据版本');return send(200,{state:db.dispatch(d.command,d.expectedRevision)})}
  if(req.method==='POST'&&url.pathname==='/api/ocr'){
   const exe=process.env.OFFER_OCR||join(root,'dist','offer-ocr');if(!existsSync(exe))return send(400,{error:'请先运行 npm run build:mac，或使用已构建的桌面版。'});
   const dir=await mkdtemp(join(tmpdir(),'offer-ocr-'));try{const file=join(dir,'image');await writeFile(file,await body(req));const {stdout}=await run(exe,[file],{timeout:45000,maxBuffer:2000000});return send(200,{text:stdout})}finally{await rm(dir,{recursive:true,force:true})}
  }return send(404,{error:'Not found'});
 }
 if(req.method!=='GET')return send(405,{error:'Method not allowed'});const path=resolve(web,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(web+'/'))return send(403,{error:'Forbidden'});
 const content=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(content);
 }catch(e){send(e.status||400,{error:e.message,state:e.state})}});
server.listen(port,'127.0.0.1',()=>console.log(`Offer Island: http://127.0.0.1:${port}`));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0)}));
