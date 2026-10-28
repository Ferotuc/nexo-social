import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){const [type,salt,hex]=stored.split(':');if(type!=='scrypt'||!salt||!hex)return false;const key=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(hex,'hex');return key.length===expected.length&&timingSafeEqual(key,expected);}
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
