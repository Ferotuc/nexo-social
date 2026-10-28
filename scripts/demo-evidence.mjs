import { randomBytes } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
const base='http://127.0.0.1:4100/api';
const stateFile='.local/demo-actor.json';
let dto;
try{dto=JSON.parse(await readFile(stateFile,'utf8'));}catch{
 dto={username:'comunidad_demo',email:'comunidad_demo@example.invalid',displayName:'Comunidad Nexo',password:randomBytes(24).toString('base64url')};
 await mkdir('.local',{recursive:true});await writeFile(stateFile,JSON.stringify(dto));
}
let response=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:dto.email,password:dto.password})});
if(!response.ok)response=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dto)});
if(!response.ok)throw new Error('No se pudo iniciar el actor de demostración.');
const cookie=response.headers.get('set-cookie').split(';')[0];
const profileResponse=await fetch(base+'/users/demo_nexo');
if(!profileResponse.ok)throw new Error('Primero registra demo_nexo en el navegador.');
const profile=await profileResponse.json();
const feed=await (await fetch(base+'/posts?username=demo_nexo')).json();
if(!feed.items.length)throw new Error('Primero crea una publicación de demostración.');
const post=feed.items[0];
const headers={'Content-Type':'application/json',Cookie:cookie};
for(const [path,method,body] of [[`/users/${profile.id}/follow`,'POST'],[`/posts/${post.id}/like`,'PUT'],[`/posts/${post.id}/comments`,'POST',{body:'¡Qué bueno ver una comunidad tomando forma! Esta notificación llegó desde otra sesión mediante SSE. ✨'}]]){
 const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`Falló demostración: ${r.status}`);
}
console.log('Demostración local: seguimiento, like y comentario enviados desde otra sesión.');
