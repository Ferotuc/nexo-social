import '../config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
async function main(){
  const pool=new Pool({connectionString:process.env.DATABASE_URL});
  try { await migrate(drizzle(pool),{migrationsFolder:resolve(__dirname,'../../drizzle')}); console.log('Migraciones aplicadas correctamente.'); }
  finally {await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
