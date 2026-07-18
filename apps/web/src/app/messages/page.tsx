'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, Search, Send } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, AuthUser } from '@/lib/api';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
}

interface ConversationRow {
  id: string;
  contact: Contact | null;
  lastMessage: { content: string; createdAt: string; isMine: boolean } | null;
  unreadCount: number;
  updatedAt: string;
}

interface ThreadMessage {
  id: string;
  content: string;
  createdAt: string;
  author: Contact;
}

interface Thread {
  id: string;
  contact: Contact | null;
  messages: ThreadMessage[];
}

function contactName(c: Contact | null): string {
  return c ? `${c.firstName} ${c.lastName}`.trim() : 'Membre';
}

/** Messagerie privée (Vol 2 §24) — liste + discussion, polling léger. */
export default function MessagesPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api<AuthUser>('/users/me') });

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<ConversationRow[]>('/messages/conversations'),
    refetchInterval: 15_000,
  });

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-2xl font-bold">Messages</h1>

      <Card className="grid min-h-[70vh] overflow-hidden md:grid-cols-[320px_1fr]">
        {/* ── Liste des conversations ── */}
        <div
          className={`flex flex-col border-line md:border-r ${activeId ? 'hidden md:flex' : 'flex'}`}
        >
          <div className="border-b border-line p-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setSearching((v) => !v)}
            >
              <MessageSquarePlus size={16} />
              Nouvelle conversation
            </Button>
            {searching && (
              <ContactSearch
                onOpen={(conversationId) => {
                  setActiveId(conversationId);
                  setSearching(false);
                }}
              />
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations?.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">
                Aucune conversation. Écrivez à un formateur ou à un membre !
              </p>
            )}
            {conversations?.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition ${
                  activeId === c.id ? 'bg-gold-soft' : 'hover:bg-soft'
                }`}
              >
                <Avatar name={contactName(c.contact)} src={c.contact?.avatarUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{contactName(c.contact)}</span>
                    {c.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </span>
                  {c.lastMessage && (
                    <span className="block truncate text-xs text-muted">
                      {c.lastMessage.isMine ? 'Vous : ' : ''}
                      {c.lastMessage.content}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Discussion ── */}
        <div className={`${activeId ? 'flex' : 'hidden md:flex'} min-w-0 flex-col`}>
          {activeId ? (
            <ThreadView
              conversationId={activeId}
              meId={me?.id}
              onBack={() => setActiveId(null)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted">
              Sélectionnez une conversation, ou démarrez-en une nouvelle.
            </div>
          )}
        </div>
      </Card>
    </AppShell>
  );
}

function ContactSearch({ onOpen }: { onOpen: (conversationId: string) => void }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const { data: contacts } = useQuery({
    queryKey: ['contacts', query],
    queryFn: () => api<Contact[]>(`/messages/contacts?query=${encodeURIComponent(query)}`),
  });

  const open = useMutation({
    mutationFn: (recipientId: string) =>
      api<{ id: string }>('/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ recipientId }),
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onOpen(r.id);
    },
  });

  return (
    <div className="mt-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un membre…"
          className="w-full rounded-btn border border-line bg-surface py-2 pl-8 pr-3 text-sm outline-none transition focus:border-gold"
        />
      </div>
      <div className="mt-1 max-h-52 overflow-y-auto">
        {contacts?.map((c) => (
          <button
            key={c.id}
            onClick={() => open.mutate(c.id)}
            className="flex w-full items-center gap-2 rounded-btn px-2 py-1.5 text-left text-sm transition hover:bg-soft"
          >
            <Avatar name={contactName(c)} src={c.avatarUrl} size={28} />
            <span className="truncate">{contactName(c)}</span>
            {c.role !== 'LEARNER' && (
              <Badge tone="gold">{c.role === 'ADMIN' ? 'Équipe' : 'Formateur'}</Badge>
            )}
          </button>
        ))}
        {contacts?.length === 0 && <p className="px-2 py-2 text-xs text-muted">Aucun membre trouvé.</p>}
      </div>
    </div>
  );
}

function ThreadView({
  conversationId,
  meId,
  onBack,
}: {
  conversationId: string;
  meId?: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread } = useQuery({
    queryKey: ['thread', conversationId],
    queryFn: () => api<Thread>(`/messages/conversations/${conversationId}`),
    refetchInterval: 5_000, // polling léger — Socket.IO plus tard
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length]);

  const send = useMutation({
    mutationFn: () =>
      api(`/messages/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: draft }),
      }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['thread', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (draft.trim()) send.mutate();
  }

  return (
    <>
      {/* En-tête */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button onClick={onBack} className="text-sm text-muted md:hidden" aria-label="Retour">
          ←
        </button>
        <Avatar name={contactName(thread?.contact ?? null)} src={thread?.contact?.avatarUrl} size={34} />
        <p className="text-sm font-semibold">{contactName(thread?.contact ?? null)}</p>
        {thread?.contact && thread.contact.role !== 'LEARNER' && (
          <Badge tone="gold">{thread.contact.role === 'ADMIN' ? 'Équipe' : 'Formateur'}</Badge>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {thread?.messages.map((m) => {
          const mine = m.author.id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? 'rounded-br-md bg-gold text-white' : 'rounded-bl-md bg-soft'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/70' : 'text-muted'}`}>
                  {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composeur */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Écrire un message…"
          className="flex-1 rounded-btn border border-line bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-gold"
        />
        <Button type="submit" disabled={!draft.trim() || send.isPending} aria-label="Envoyer">
          <Send size={16} />
        </Button>
      </form>
    </>
  );
}
