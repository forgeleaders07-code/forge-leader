'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { AdminCourseSummary } from '@/lib/admin-types';

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  DRAFT: { label: 'Brouillon', class: 'border-gold text-muted' },
  PUBLISHED: { label: 'Publiée', class: 'border-success text-success' },
  ARCHIVED: { label: 'Archivée', class: 'border-danger/40 text-danger' },
};

export default function AdminFormationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => api<AdminCourseSummary[]>('/admin/courses'),
  });

  const createMutation = useMutation({
    mutationFn: (title: string) =>
      api<{ id: string }>('/admin/courses', { method: 'POST', body: JSON.stringify({ title }) }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      router.push(`/admin/formations/${created.id}`);
    },
  });

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/courses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
    onError: (e) => setDeleteError(e instanceof ApiError ? e.message : 'Suppression impossible'),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (newTitle.trim().length >= 3) createMutation.mutate(newTitle.trim());
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Formations</h1>
        <form onSubmit={onCreate} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titre de la nouvelle formation"
            className="w-72 rounded-lg border border-line bg-soft px-4 py-2 text-sm outline-none transition focus:border-gold"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || newTitle.trim().length < 3}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Création…' : '+ Créer'}
          </button>
        </form>
      </div>

      {isLoading && <p className="text-muted">Chargement…</p>}

      {deleteError && (
        <p className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
          {deleteError}
        </p>
      )}

      {courses && courses.length === 0 && (
        <div className="rounded-card border border-line bg-surface p-10 text-center text-muted">
          Aucune formation. Créez la première ci-dessus.
        </div>
      )}

      <div className="space-y-3">
        {courses?.map((course) => {
          const status = STATUS_LABELS[course.status] ?? STATUS_LABELS.DRAFT;
          return (
            <div
              key={course.id}
              className="flex items-center gap-3 rounded-card border border-line bg-surface px-6 py-4 transition hover:border-gold"
            >
              <Link
                href={`/admin/formations/${course.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{course.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    /{course.slug} · {course.lessonCount} leçon{course.lessonCount > 1 ? 's' : ''} ·{' '}
                    {course.activeEnrollments} inscrit{course.activeEnrollments > 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${status.class}`}>
                  {status.label}
                </span>
              </Link>
              {confirmId === course.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => deleteMutation.mutate(course.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg bg-danger px-2 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Suppression…' : 'Confirmer'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg border border-line px-2 py-1 text-xs text-muted transition hover:border-gold disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmId(course.id);
                  }}
                  title="Supprimer la formation"
                  className="shrink-0 rounded-lg px-2 py-1 text-muted transition hover:bg-danger/10 hover:text-danger"
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
