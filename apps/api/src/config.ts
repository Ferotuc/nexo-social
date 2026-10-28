import { config } from 'dotenv';
import { resolve } from 'node:path';
config({path:resolve(process.cwd(), '../../.env'),quiet:true});
config({quiet:true});
export const settings = {
  databaseUrl: process.env.DATABASE_URL,
  port:Number(process.env.PORT || process.env.API_PORT || 4100),
  origins:[...(process.env.WEB_ORIGIN || 'http://localhost:3100').split(',').map(s=>s.trim()),process.env.API_PUBLIC_URL||'http://localhost:4100'],
  secure:process.env.COOKIE_SECURE === 'true',
  trustProxy:process.env.TRUST_PROXY === 'true',
  production:process.env.NODE_ENV === 'production'
};
if (!settings.databaseUrl) throw new Error('Falta DATABASE_URL. Copia .env.example a .env y configura PostgreSQL.');
if (settings.production && !settings.secure) throw new Error('COOKIE_SECURE=true es obligatorio en producción con HTTPS.');
