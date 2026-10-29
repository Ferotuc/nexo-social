// Production smoke check. Uses two explicitly labelled demonstration accounts.
// Credentials stay in .local/ and never appear in the report or console.
import { randomBytes } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const web=process.env.PUBLIC_WEB_URL||'https://nexo-web-ferotuc.onrender.com';
const backend=process.env.PUBLIC_API_URL||'https://nexo-api-ferotuc.onrender.com';
const report={checkedAt:new Date().toISOString(),frontend:web,backend,checks:[]};
async function check(name,work){await work();report.checks.push({name,passed:true});console.log('OK:',name);}
async function request(path,{method='GET',body,cookie,origin=web,direct=false}={}){
 const r=await fetch((direct?backend:web)+'/api'+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null;}catch{throw new Error('El servicio aún no devuelve JSON: HTTP '+r.status);}
 return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
}
await mkdir('.local',{recursive:true});
let accounts;
try{accounts=JSON.parse(await readFile('.local/public-demo.json','utf8'));}
catch{accounts={a:{username:'demo_nexo',email:'demo_nexo@example.invalid',displayName:'Demo Nexo',password:randomBytes(24).toString('base64url')},b:{username:'comunidad_demo',email:'comunidad_demo@example.invalid',displayName:'Comunidad Nexo',password:randomBytes(24).toString('base64url')}};await writeFile('.local/public-demo.json',JSON.stringify(accounts));}
async function session(dto){let r=await request('/auth/login',{method:'POST',body:{email:dto.email,password:dto.password}});if(r.status===401)r=await request('/auth/register',{method:'POST',body:dto});assert.ok([200,201].includes(r.status),'No se pudo autenticar la cuenta de demostración.');assert.ok(r.cookie);return {user:r.data,cookie:r.cookie,headers:r.headers};}
let reader;const abort=new AbortController();
try{
 await check('API pública conectada a PostgreSQL',async()=>{const r=await request('/health',{direct:true});assert.equal(r.status,200);assert.equal(r.data.status,'ok');});
 await check('Frontend HTTPS y registro público',async()=>{const r=await fetch(web+'/register',{signal:AbortSignal.timeout(45000)});assert.equal(r.status,200);assert.ok((await r.text()).includes('Empieza algo bueno'));});
 await check('Swagger y OpenAPI públicos',async()=>{const r=await fetch(backend+'/api/docs',{signal:AbortSignal.timeout(45000)});assert.equal(r.status,200);assert.ok((await r.text()).includes('swagger-ui'));const schema=await request('/openapi.json',{direct:true});assert.ok(schema.data.paths['/api/events']);});
 const a=await session(accounts.a),b=await session(accounts.b);
 await check('Sesión HTTPS con cookie HttpOnly y Secure',async()=>{const cookie=a.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.equal((await request('/auth/me',{cookie:a.cookie})).data.id,a.user.id);assert.equal((await request('/auth/me')).status,401);});
 const body='¡Nexo ya está en Internet! Esta publicación demuestra el frontend, la API y PostgreSQL desplegados, con interacciones y notificaciones en tiempo real. 🌐';
 let posts=(await request('/posts?username=demo_nexo',{cookie:a.cookie})).data;
 let post=posts.items.find(p=>p.body===body);
 if(process.argv.includes('--after-restart')){
  await check('Persistencia de la publicación después de reiniciar la API pública',async()=>{
   const previous=JSON.parse(await readFile('docs/evidence/public-verification.json','utf8'));
   assert.ok(post,'La publicación anterior no se conservó.');
   assert.equal(post.id,previous.demonstration.postId);
   report.persistence={verified:true,postId:post.id,previousCheck:previous.checkedAt};
  });
 }
 if(!post){const created=await request('/posts',{method:'POST',cookie:a.cookie,body:{body}});assert.equal(created.status,201);post=created.data;}
 await check('Publicación persistida y renderizada mediante SSR',async()=>{const r=await fetch(web+'/p/'+post.id,{signal:AbortSignal.timeout(45000)});assert.equal(r.status,200);assert.ok((await r.text()).includes('¡Nexo ya está en Internet!'));});
 const stream=await fetch(web+'/api/events',{headers:{Cookie:a.cookie},signal:abort.signal});assert.equal(stream.status,200);reader=stream.body.getReader();
 const initial=await reader.read();assert.match(new TextDecoder().decode(initial.value),/connected/);
 const nextEvent=reader.read();
 await request('/posts/'+post.id+'/like',{method:'DELETE',cookie:b.cookie});
 await check('Like y notificación SSE a través del frontend público',async()=>{const r=await request('/posts/'+post.id+'/like',{method:'PUT',cookie:b.cookie});assert.equal(r.status,200);assert.ok(r.data.likesCount>=1);let timeout;try{const chunk=await Promise.race([nextEvent,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('SSE no respondió en 20 segundos.')),20000);})]);assert.match(new TextDecoder().decode(chunk.value),/notifications.changed|post.changed/);}finally{clearTimeout(timeout);}});
 await check('Comentarios, seguimiento y feed personalizado',async()=>{const comments=await request('/posts/'+post.id+'/comments',{cookie:b.cookie});if(!comments.data.some(c=>c.author.id===b.user.id))assert.equal((await request('/posts/'+post.id+'/comments',{method:'POST',cookie:b.cookie,body:{body:'¡Conexión confirmada desde otra sesión! El comentario y su notificación se guardaron en PostgreSQL. ✨'}})).status,201);assert.equal((await request('/users/'+a.user.id+'/follow',{method:'POST',cookie:b.cookie})).status,200);const feed=await request('/posts?feed=following',{cookie:b.cookie});assert.ok(feed.data.items.some(p=>p.id===post.id));const notices=await request('/notifications',{cookie:a.cookie});assert.ok(notices.data.some(n=>n.postId===post.id));});
 await check('Permisos, validación y origen de escrituras',async()=>{assert.equal((await request('/posts/'+post.id,{method:'DELETE',cookie:b.cookie})).status,403);assert.equal((await request('/posts',{method:'POST',cookie:a.cookie,body:{body:'  '}})).status,400);assert.equal((await request('/posts',{method:'POST',cookie:a.cookie,origin:'https://invalid.example',body:{body:'Debe rechazarse'}})).status,403);});
 report.demonstration={postId:post.id,author:accounts.a.username,actor:accounts.b.username};report.passed=true;
 await mkdir('docs/evidence',{recursive:true});await writeFile('docs/evidence/public-verification.json',JSON.stringify(report,null,2));
 console.log('Verificación pública completada.');
}catch(e){report.passed=false;report.error=e.message;await writeFile('.local/public-verification-error.json',JSON.stringify(report,null,2));console.error(e.message);process.exitCode=1;}
finally{abort.abort();if(reader)await reader.cancel().catch(()=>{});}
