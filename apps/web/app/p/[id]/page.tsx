import { notFound } from 'next/navigation';
import { serverApi } from '../../../lib/server';
import type { User, Post } from '../../../lib/types';
import { SocialApp } from '../../../components/social-app';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Publicación' };
export default async function Publication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, post, people] = await Promise.all([
    serverApi<User>('/auth/me'),
    serverApi<Post>(`/posts/${encodeURIComponent(id)}`),
    serverApi<User[]>('/users'),
  ]);
  if (!post) notFound();
  return (
    <SocialApp
      initialMe={me}
      initialFeed={{ items: [post], page: 1, hasMore: false }}
      initialPeople={people || []}
      view="post"
      postId={id}
    />
  );
}
