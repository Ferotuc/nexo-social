import { cookies } from 'next/headers';
export async function serverApi<T>(path:string):Promise<T|null>{
  const jar=await cookies();const token=jar.get('nexo_session');
  try{const res=await fetch(`${process.env.API_INTERNAL_URL||'http://127.0.0.1:4100'}/api${path}`,{headers:token?{Cookie:`nexo_session=${token.value}`}:{},cache:'no-store',signal:AbortSignal.timeout(8000)});if(!res.ok)return null;return res.json();}catch{return null;}
}
