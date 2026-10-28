import { notFound } from 'next/navigation';
import { serverApi } from '../../../lib/server';
import type { User,Feed } from '../../../lib/types';
import { SocialApp } from '../../../components/social-app';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{username:string}>}){const {username}=await params;return {title:`@${username}`};}
export default async function Profile({params}:{params:Promise<{username:string}>}){const {username}=await params;const [me,profile,feed,people]=await Promise.all([serverApi<User>('/auth/me'),serverApi<User>(`/users/${encodeURIComponent(username)}`),serverApi<Feed>(`/posts?username=${encodeURIComponent(username)}`),serverApi<User[]>('/users')]);if(!profile)notFound();return <SocialApp initialMe={me} initialProfile={profile} initialFeed={feed} initialPeople={people||[]} view="profile"/>;}
