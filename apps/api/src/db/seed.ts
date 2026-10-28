import '../config';
import { Pool } from 'pg';
import { hashPassword } from '../security';
import { randomBytes } from 'node:crypto';
async function main(){
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 try{
  const count=Number((await pool.query('SELECT count(*) FROM users')).rows[0].count);
  if(count>0){console.log('Seed omitido: ya existen usuarios.');return;}
  const password=await hashPassword(randomBytes(32).toString('hex'));
  const people=[
   {username:'lucia.creativa'.replace('.','_'),name:'Lucía Morales',bio:'Diseño, café y buenas preguntas. Encontrando inspiración en lo cotidiano.',posts:['A veces la mejor idea aparece cuando cierras todas las pestañas y sales a caminar. 🌿\n\nHoy encontré la paleta de colores de mi próximo proyecto en un jardín. ¿Dónde encuentras tu inspiración?','Pequeño recordatorio: no necesitas tener todo resuelto para empezar algo que te importa.']},
   {username:'mateo_dev',name:'Mateo Rivera',bio:'Construyendo cosas para la web. Aprender en comunidad siempre es mejor.',posts:['Hoy mi primera API conectó con PostgreSQL y guardó datos de verdad. Parece un paso pequeño, pero ver todo funcionando después de tantos intentos se siente increíble. ✨\n\n¿Qué fue lo último que aprendiste a hacer?']},
   {username:'sofia_luz',name:'Sofía García',bio:'Fotografía, libros y conversaciones que se quedan contigo.',posts:['Una buena comunidad no se mide por cuántas personas la forman, sino por cuántas se sienten escuchadas.\n\nQué bonito encontrar espacios para compartir sin prisa. ☀️']},
   {username:'diego_crea',name:'Diego Méndez',bio:'Ideas en construcción. Tecnología con propósito.',posts:['Pregunta para la comunidad: si pudieran crear una herramienta que mejorara algo en su barrio, ¿qué construirían?\n\nYo empezaría con una biblioteca de objetos para prestar herramientas entre vecinos. 🔧']}
  ];
  for(let i=0;i<people.length;i++){
   const p=people[i];const {rows:[u]}=await pool.query('INSERT INTO users(username,email,password_hash,display_name,bio) VALUES($1,$2,$3,$4,$5) RETURNING id',[p.username,`${p.username}@example.invalid`,password,p.name,p.bio]);
   for(let j=0;j<p.posts.length;j++)await pool.query(`INSERT INTO posts(author_id,body,created_at) VALUES($1,$2,now()-($3*interval '1 minute'))`,[u.id,p.posts[j],(i+1)*37+j*20]);
  }
  console.log('Datos de muestra creados: 4 perfiles y 5 publicaciones. No tienen contraseñas públicas; registra tu propia cuenta.');
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
