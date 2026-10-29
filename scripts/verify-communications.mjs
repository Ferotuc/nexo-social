// Public demonstration accounts only. Never prints passwords or cookies.
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const web='https://nexo-web-ferotuc.onrender.com',api='https://nexo-api-ferotuc.onrender.com';
const accounts=JSON.parse(await readFile('.local/public-demo.json','utf8'));
const report={checkedAt:new Date().toISOString(),frontend:web,checks:[]};
async function request(path,{method='GET',body,cookie}={}){const form=body instanceof FormData;const res=await fetch(web+'/api'+path,{method,headers:{Origin:web,...(cookie?{Cookie:cookie}:{}),...(body&&!form?{'Content-Type':'application/json'}:{})},body:body?(form?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(45000)});let data=null;const raw=await res.text();try{data=raw?JSON.parse(raw):null;}catch{data=raw;}return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0]};}
async function check(name,work){await work();report.checks.push({name,passed:true});console.log('OK:',name);}
async function login(dto){const r=await request('/auth/login',{method:'POST',body:{email:dto.email,password:dto.password}});assert.equal(r.status,200);return {...r.data,cookie:r.cookie};}
async function upload(user,name,content){const form=new FormData();form.append('file',new Blob([content]),name);const r=await request('/attachments',{method:'POST',cookie:user.cookie,body:form});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
const a=await login(accounts.a),b=await login(accounts.b),abort=new AbortController();let reader;
try{
 await check('Navegación de mensajes y OpenAPI actualizados',async()=>{const page=await fetch(web+'/messages',{headers:{Cookie:a.cookie},signal:AbortSignal.timeout(45000)});assert.equal(page.status,200);assert.ok((await page.text()).includes('Tus mensajes'));const schema=await fetch(api+'/api/openapi.json').then(r=>r.json());assert.ok(schema.paths['/api/chat/{id}/messages']);assert.ok(schema.paths['/api/attachments']);});
 const stream=await fetch(web+'/api/events',{headers:{Cookie:b.cookie},signal:abort.signal});assert.equal(stream.status,200);reader=stream.body.getReader();await reader.read();
 await check('Estado En línea de otra sesión conectada',async()=>{assert.equal((await request('/chat/contacts',{cookie:a.cookie})).data.find(c=>c.id===b.id).online,true);});
 let previous;try{previous=JSON.parse(await readFile('docs/evidence/communications-public.json','utf8'));}catch{}
 const png=await readFile('docs/evidence/demo-image.png');let post,chatFile,message;
 const text='Ahora también compartimos imágenes en Nexo 📷💙';
 const feed=await request('/posts?username=demo_nexo',{cookie:a.cookie});post=feed.data.items.find(p=>p.body===text);
 if(process.argv.includes('--after-restart')){
  await check('Mensaje y archivos conservados después del reinicio',async()=>{assert.ok(previous?.resources);assert.equal(post?.id,previous.resources.postId);const history=await request(`/chat/${b.id}/messages`,{cookie:a.cookie});const saved=history.data.items.find(m=>m.id===previous.resources.messageId);assert.ok(saved);assert.equal(saved.attachments[0].id,previous.resources.privateFileId);});
 }
 await check('Publicación con imagen pública y emojis',async()=>{if(!post){const image=await upload(a,'nexo-demo.png',png);const r=await request('/posts',{method:'POST',cookie:a.cookie,body:{body:text,attachmentIds:[image.id]}});assert.equal(r.status,201);post=r.data;}assert.ok(post.attachments[0]);const res=await fetch(web+`/api/attachments/${post.attachments[0].id}`);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/png');assert.equal(createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex'),createHash('sha256').update(png).digest('hex'));});
 const history=(await request(`/chat/${b.id}/messages`,{cookie:a.cookie})).data;
 message=history.items.find(m=>m.body==='¡Hola! Ya podemos conversar en privado y compartir archivos 👋💙');
 const eventTask=(async()=>{for(;;){const c=await reader.read();if(c.done)throw new Error('SSE terminó.');const data=new TextDecoder().decode(c.value);if(data.includes('messages.changed'))return data;}})();
 await check('Chat privado con archivo TXT y notificación SSE',async()=>{
  if(!message){chatFile=await upload(a,'saludo-nexo.txt',Buffer.from('Archivo de demostración de Nexo. Solo visible para los participantes del chat. 💙'));
   const sent=await request(`/chat/${b.id}/messages`,{method:'POST',cookie:a.cookie,body:{body:'¡Hola! Ya podemos conversar en privado y compartir archivos 👋💙',attachmentIds:[chatFile.id]}});assert.equal(sent.status,201);
   message=(await request(`/chat/${b.id}/messages`,{cookie:a.cookie})).data.items.find(m=>m.id===sent.data.id);
  }else{chatFile=message.attachments[0];await request(`/chat/${a.id}/messages`,{method:'POST',cookie:b.cookie,body:{body:'Conexión del chat confirmada ✅'}});}
  let timeout;try{const event=await Promise.race([eventTask,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('No llegó SSE del chat.')),20000);})]);assert.ok(!event.includes(message.body));}finally{clearTimeout(timeout);}
 });
 await check('Descarga privada solo para participantes autenticados',async()=>{const publicRead=await fetch(web+`/api/attachments/${chatFile.id}`);assert.equal(publicRead.status,404);const own=await fetch(web+`/api/attachments/${chatFile.id}`,{headers:{Cookie:b.cookie}});assert.equal(own.status,200);assert.match(own.headers.get('content-disposition'),/^attachment/);assert.ok((await own.text()).includes('Solo visible'));});
 await check('Lectura de mensajes y contador de pendientes',async()=>{const read=await request(`/chat/${a.id}/read`,{method:'PATCH',cookie:b.cookie});assert.equal(read.status,200);const history=await request(`/chat/${b.id}/messages`,{cookie:a.cookie});assert.ok(history.data.items.find(m=>m.id===message.id).readAt);});
 await check('Rechazo de archivos ejecutables o con extensión falsa',async()=>{for(const name of ['pagina.html','falsa.png']){const form=new FormData();form.append('file',new Blob(['<script>alert(1)</script>']),name);assert.equal((await request('/attachments',{method:'POST',cookie:a.cookie,body:form})).status,400);}});
 report.resources={postId:post.id,imageId:post.attachments[0].id,messageId:message.id,privateFileId:chatFile.id};report.passed=true;
 await writeFile('docs/evidence/communications-public.json',JSON.stringify(report,null,2));console.log('Chat y multimedia públicos verificados.');
}finally{abort.abort();if(reader)await reader.cancel().catch(()=>{});}
