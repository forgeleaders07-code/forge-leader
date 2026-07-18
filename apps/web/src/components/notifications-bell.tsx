'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Cloche du centre de notifications (Vol 2 §26). */
export function NotificationsBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery({
    queryKey: ['notif-unread'],
    queryFn: () => api<{ unread: number }>('/notifications/unread-count'),
    refetchInterval: 60_000, // filet de sécurité — le temps réel prime
  });

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ notifications: NotificationItem[] }>('/notifications'),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notif-unread'] });
  };

  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: invalidate,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const count = unread?.unread ?? 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count > 0 ? ` (${count} non lues)` : ''}`}
        className="relative rounded-btn border border-line bg-surface p-2 text-muted transition hover:text-ink"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-card border border-line bg-surface shadow-card-hover sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-gold hover:underline"
              >
                <CheckCheck size={14} />
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {data?.notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Aucune notification pour le moment.
              </p>
            )}
            {data?.notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link || '#'}
                onClick={() => {
                  if (!n.readAt) markOne.mutate(n.id);
                  setOpen(false);
                }}
                className={`block border-b border-line px-4 py-3 text-sm transition last:border-0 hover:bg-soft ${
                  n.readAt ? 'opacity-70' : ''
                }`}
              >
                <span className="flex items-start gap-2">
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />}
                  <span className="min-w-0">
                    <span className="block font-medium leading-snug">{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted">{relativeDate(n.createdAt)}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
