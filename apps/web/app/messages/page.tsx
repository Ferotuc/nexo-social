import { redirect } from 'next/navigation';
import { serverApi } from '../../lib/server';
import type { User } from '../../lib/types';
import { SocialApp } from '../../components/social-app';
export const dynamic='force-dynamic';
export const metadata={title:'Mensajes privados',robots:{index:false,follow:false}};
export default async function Messages(){const me=await serverApi<User>('/auth/me');if(!me)redirect('/login');return <SocialApp initialMe={me} initialPeople={[]} view="messages"/>;}
