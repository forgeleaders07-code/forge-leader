'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';
import type { CourseDetail, LessonSummary, PlaybackGrant } from '@/lib/types';

export default function FormationPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['course', slug],
    queryFn: () => api<CourseDetail>(`/courses/${slug}`),
  });

  const allLessons = useMemo(
    () => course?.modules.flatMap((m) => m.chapters.flatMap((c) => c.lessons)) ?? [],
    [course],
  );

  // Leçon sélectionnée, ou première leçon non terminée (reprise), ou la première.
  const currentLesson: LessonSummary | undefined = useMemo(() => {
    if (selectedLessonId) return allLessons.find((l) => l.id === selectedLessonId);
    return allLessons.find((l) => !l.completed) ?? allLessons[0];
  }, [selectedLessonId, allLessons]);

  const { data: playback, isLoading: playbackLoading } = useQuery({
    queryKey: ['playback', currentLesson?.id],
    queryFn: () => api<PlaybackGrant>(`/video/lessons/${currentLesson!.id}/playback`, { method: 'POST' }),
    enabled: !!currentLesson && currentLesson.type === 'VIDEO',
    // Renouvellement avant expiration du token de lecture
    refetchInterval: (q) => {
      const grant = q.state.data;
      if (!grant) return false;
      return Math.max(30_000, (grant.expiresAt - 120) * 1000 - Date.now());
    },
  });

  const completeMutation = useMutation({
    mutationFn: (lessonId: string) =>
      api(`/courses/lessons/${lessonId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ positionSeconds: 0, completed: true }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['course', slug] });
      void queryClient.invalidateQueries({ queryKey: ['my-courses'] });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-forge-300">Chargement de la formation…</p>
      </AppShell>
    );
  }

  if (error || !course) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-forge-700 bg-forge-900 p-10 text-center">
          <p className="text-lg font-medium">Formation inaccessible</p>
          <p className="mt-2 text-sm text-forge-300">
            Vérifiez que votre accès est bien actif, ou contactez le support.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-8 text-2xl font-bold">{course.title}</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* ─── Lecteur ─── */}
        <div>
          <div className="protected-content overflow-hidden rounded-2xl border border-forge-700 bg-black">
            {currentLesson?.type === 'VIDEO' ? (
              playbackLoading ? (
                <div className="flex aspect-video items-center justify-center text-forge-300">
                  Préparation de la lecture sécurisée…
                </div>
              ) : playback ? (
                <iframe
                  key={playback.token}
                  src={playback.iframeUrl}
                  className="aspect-video w-full"
                  allow="accelerometer; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title={currentLesson.title}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-forge-300">
                  Lecture indisponible
                </div>
              )
            ) : (
              <div className="flex aspect-video items-center justify-center p-8 text-center text-forge-300">
                {currentLesson ? `Contenu « ${currentLesson.title} »` : 'Sélectionnez une leçon'}
              </div>
            )}
          </div>

          {currentLesson && (
            <div className="mt-4 flex items-center justify-between gap-4">
              <h2 className="font-semibold">{currentLesson.title}</h2>
              <button
                onClick={() => completeMutation.mutate(currentLesson.id)}
                disabled={currentLesson.completed || completeMutation.isPending}
                className="shrink-0 rounded-lg bg-ember-500 px-4 py-2 text-sm font-semibold text-forge-950 transition hover:bg-ember-400 disabled:opacity-50"
              >
                {currentLesson.completed ? '✓ Terminée' : 'Marquer comme terminée'}
              </button>
            </div>
          )}
        </div>

        {/* ─── Plan de la formation ─── */}
        <aside className="max-h-[75vh] overflow-y-auto rounded-2xl border border-forge-700 bg-forge-900 p-4">
          {course.modules.map((module) => (
            <div key={module.id} className="mb-4">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-forge-500">
                {module.title}
              </p>
              {module.chapters.map((chapter) => (
                <div key={chapter.id} className="mb-2">
                  <p className="px-2 py-1 text-sm font-medium text-forge-300">{chapter.title}</p>
                  {chapter.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        currentLesson?.id === lesson.id
                          ? 'bg-forge-700 text-forge-100'
                          : 'text-forge-300 hover:bg-forge-800'
                      }`}
                    >
                      <span className={lesson.completed ? 'text-ember-500' : 'text-forge-500'}>
                        {lesson.completed ? '✓' : '▸'}
                      </span>
                      <span className="flex-1">{lesson.title}</span>
                      {lesson.durationSeconds != null && (
                        <span className="text-xs text-forge-500">
                          {Math.round(lesson.durationSeconds / 60)} min
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </aside>
      </div>
    </AppShell>
  );
}
