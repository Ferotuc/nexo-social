import { serverApi } from '../lib/server';
import type { User, Feed } from '../lib/types';
import { SocialApp } from '../components/social-app';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const [me, feed, people] = await Promise.all([
    serverApi<User>('/auth/me'),
    serverApi<Feed>('/posts'),
    serverApi<User[]>('/users'),
  ]);
  return <SocialApp initialMe={me} initialFeed={feed} initialPeople={people || []} view="feed" />;
}
