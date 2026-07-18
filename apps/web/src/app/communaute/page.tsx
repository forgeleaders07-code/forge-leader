'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Heart, Lightbulb, MessageCircle, Send, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api, AuthUser } from '@/lib/api';

type ReactionType = 'LIKE' | 'LOVE' | 'CLAP' | 'INSIGHT';

interface FeedAuthor {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
}

interface FeedPost {
  id: string;
  content: string;
  createdAt: string;
  author: FeedAuthor;
  commentCount: number;
  reactionCounts: Partial<Record<ReactionType, number>>;
  myReaction: ReactionType | null;
}

interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

interface FeedComment {
  id: string;
  content: string;
  createdAt: string;
  author: FeedAuthor;
}

const REACTIONS: { type: ReactionType; icon: typeof ThumbsUp; label: string }[] = [
  { type: 'LIKE', icon: ThumbsUp, label: "J'aime" },
  { type: 'LOVE', icon: Heart, label: "J'adore" },
  { type: 'CLAP', icon: Send, label: 'Bravo' },
  { type: 'INSIGHT', icon: Lightbulb, label: 'Éclairant' },
];

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function roleBadge(role: string) {
  if (role === 'ADMIN') return <Badge tone="gold">Équipe</Badge>;
  if (role === 'INSTRUCTOR') return <Badge tone="gold">Formateur</Badge>;
  return null;
}

/** Communauté du campus (Vol 2 §23) — fil, réactions, commentaires. */
export default function CommunautePage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<AuthUser>('/users/me'),
  });

  const feed = useInfiniteQuery({
    queryKey: ['community-feed'],
    queryFn: ({ pageParam }) =>
      api<FeedPage>(`/community/feed${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const publish = useMutation({
    mutationFn: () =>
      api<FeedPost>('/community/posts', {
        method: 'POST',
        body: JSON.stringify({ content: draft }),
      }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['community-feed'] });
    },
  });

  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-display text-2xl font-bold">Communauté</h1>

        {/* ── Composeur ── */}
        <Card className="mb-8 p-5">
          <div className="flex gap-3">
            <Avatar name={me ? `${me.firstName} ${me.lastName}` : '?'} size={40} />
            <div className="flex-1">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="Partagez une victoire, une question, une réflexion…"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  onClick={() => publish.mutate()}
                  disabled={!draft.trim() || publish.isPending}
                  size="sm"
                >
                  {publish.isPending ? 'Publication…' : 'Publier'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Fil ── */}
        {feed.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-card" />
            <Skeleton className="h-40 rounded-card" />
          </div>
        )}

        {posts.length === 0 && !feed.isLoading && (
          <Card className="p-10 text-center text-sm text-muted">
            Soyez le premier à publier dans la communauté ! 🔥
          </Card>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} me={me} />
          ))}
        </div>

        {feed.hasNextPage && (
          <div className="mt-6 text-center">
            <Button
              variant="secondary"
              onClick={() => feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
            >
              {feed.isFetchingNextPage ? 'Chargement…' : 'Voir plus de publications'}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PostCard({ post, me }: { post: FeedPost; me?: AuthUser }) {
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const canDelete = me && (me.role === 'ADMIN' || me.id === post.author.id);

  const react = useMutation({
    mutationFn: (type: ReactionType) =>
      api(`/community/posts/${post.id}/reaction`, {
        method: 'PUT',
        body: JSON.stringify({ type }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community-feed'] }),
  });

  const remove = useMutation({
    mutationFn: () => api(`/community/posts/${post.id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community-feed'] }),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="p-5">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={`${post.author.firstName} ${post.author.lastName}`}
              src={post.author.avatarUrl}
              size={40}
            />
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {post.author.firstName} {post.author.lastName}
                {roleBadge(post.author.role)}
              </p>
              <p className="text-xs text-muted">{relativeDate(post.createdAt)}</p>
            </div>
          </div>
          {canDelete && (
            <button
              onClick={() => {
                if (window.confirm('Supprimer cette publication ?')) remove.mutate();
              }}
              title="Supprimer"
              className="rounded p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Contenu */}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>

        {/* Réactions */}
        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
          {REACTIONS.map(({ type, icon: Icon, label }) => {
            const count = post.reactionCounts[type] ?? 0;
            const mine = post.myReaction === type;
            return (
              <button
                key={type}
                onClick={() => react.mutate(type)}
                title={label}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  mine ? 'bg-gold-soft text-gold' : 'text-muted hover:bg-soft'
                }`}
              >
                <Icon size={14} />
                {count > 0 && count}
              </button>
            );
          })}
          <button
            onClick={() => setShowComments((v) => !v)}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-soft"
          >
            <MessageCircle size={14} />
            {post.commentCount > 0 ? `${post.commentCount} commentaire${post.commentCount > 1 ? 's' : ''}` : 'Commenter'}
          </button>
        </div>

        {showComments && <CommentsSection postId={post.id} me={me} />}
      </Card>
    </motion.div>
  );
}

function CommentsSection({ postId, me }: { postId: string; me?: AuthUser }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data: comments, isLoading } = useQuery({
    queryKey: ['community-comments', postId],
    queryFn: () => api<FeedComment[]>(`/community/posts/${postId}/comments`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['community-comments', postId] });
    void queryClient.invalidateQueries({ queryKey: ['community-feed'] });
  };

  const send = useMutation({
    mutationFn: () =>
      api(`/community/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: draft }),
      }),
    onSuccess: () => {
      setDraft('');
      invalidate();
    },
  });

  const removeComment = useMutation({
    mutationFn: (commentId: string) => api(`/community/comments/${commentId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      {isLoading && <p className="text-xs text-muted">Chargement des commentaires…</p>}

      {comments?.map((c) => {
        const canDelete = me && (me.role === 'ADMIN' || me.id === c.author.id);
        return (
          <div key={c.id} className="flex items-start gap-2.5">
            <Avatar name={`${c.author.firstName} ${c.author.lastName}`} src={c.author.avatarUrl} size={30} />
            <div className="min-w-0 flex-1 rounded-btn bg-soft px-3 py-2">
              <p className="flex items-center gap-2 text-xs font-semibold">
                {c.author.firstName} {c.author.lastName}
                {roleBadge(c.author.role)}
                <span className="font-normal text-muted">{relativeDate(c.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.content}</p>
            </div>
            {canDelete && (
              <button
                onClick={() => removeComment.mutate(c.id)}
                title="Supprimer"
                className="rounded p-1 text-muted transition hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      })}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) send.mutate();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écrire un commentaire…"
          className="flex-1 rounded-btn border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-gold"
        />
        <Button type="submit" size="sm" disabled={!draft.trim() || send.isPending}>
          <Send size={14} />
        </Button>
      </form>
    </div>
  );
}
