export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const res=await fetch(`/api${path}`,{...options,headers:{...(options.body&&!(options.body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers},credentials:'same-origin'});
  if(!res.ok){let message='No se pudo completar la solicitud.';try{const result=await res.json();message=Array.isArray(result.message)?result.message.join('. '):result.message||message;}catch{}throw new Error(message);}return res.status===204?undefined as T:res.json();
}
