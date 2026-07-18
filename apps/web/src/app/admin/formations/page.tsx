'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import type { AdminCourseSummary } from '@/lib/admin-types';

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  DRAFT: { label: 'Brouillon', class: 'border-forge-500 text-forge-300' },
  PUBLISHED: { label: 'Publiée', class: 'border-emerald-600 text-emerald-400' },
  ARCHIVED: { label: 'Archivée', class: 'border-red-800 text-red-400' },
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
            className="w-72 rounded-lg border border-forge-700 bg-forge-800 px-4 py-2 text-sm outline-none transition focus:border-ember-500"
          />
          <button
            type="submit"
            disabled={createMutation.isPending || newTitle.trim().length < 3}
            className="rounded-lg bg-ember-500 px-4 py-2 text-sm font-semibold text-forge-950 transition hover:bg-ember-400 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Création…' : '+ Créer'}
          </button>
        </form>
      </div>

      {isLoading && <p className="text-forge-300">Chargement…</p>}

      {courses && courses.length === 0 && (
        <div className="rounded-2xl border border-forge-700 bg-forge-900 p-10 text-center text-forge-300">
          Aucune formation. Créez la première ci-dessus.
        </div>
      )}

      <div className="space-y-3">
        {courses?.map((course) => {
          const status = STATUS_LABELS[course.status] ?? STATUS_LABELS.DRAFT;
          return (
            <Link
              key={course.id}
              href={`/admin/formations/${course.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-forge-700 bg-forge-900 px-6 py-4 transition hover:border-ember-600"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{course.title}</p>
                <p className="mt-1 text-xs text-forge-500">
                  /{course.slug} · {course.lessonCount} leçon{course.lessonCount > 1 ? 's' : ''} ·{' '}
                  {course.activeEnrollments} inscrit{course.activeEnrollments > 1 ? 's' : ''}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs ${status.class}`}>
                {status.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
