import { serverApi } from '../../lib/server';
import type { User } from '../../lib/types';
import { SocialApp } from '../../components/social-app';
export const dynamic='force-dynamic';
export const metadata={title:'Explorar'};
export default async function Explore(){const [me,people]=await Promise.all([serverApi<User>('/auth/me'),serverApi<User[]>('/users')]);return <SocialApp initialMe={me} initialPeople={people||[]} view="explore"/>;}
