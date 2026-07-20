'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { QuizPlayer } from '@/components/quiz-player';
import { api, ApiError } from '@/lib/api';
import type { CourseDetail, LessonSummary, PlaybackGrant } from '@/lib/types';

export default function FormationPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);

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

  const courseCompleted = allLessons.length > 0 && allLessons.every((l) => l.completed);

  const claimCertificate = useMutation({
    mutationFn: () =>
      api<{ code: string }>('/certificates/claim', {
        method: 'POST',
        body: JSON.stringify({ courseId: course!.id }),
      }),
    onSuccess: (cert) => router.push(`/certificat/${cert.code}`),
    onError: (e) =>
      setCertificateError(e instanceof ApiError ? e.message : 'Délivrance impossible'),
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
        <p className="text-muted">Chargement de la formation…</p>
      </AppShell>
    );
  }

  if (error || !course) {
    return (
      <AppShell>
        <div className="rounded-card border border-line bg-surface p-10 text-center">
          <p className="text-lg font-medium">Formation inaccessible</p>
          <p className="mt-2 text-sm text-muted">
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
          <div className="protected-content overflow-hidden rounded-card border border-line bg-black">
            {currentLesson?.type === 'VIDEO' ? (
              playbackLoading ? (
                <div className="flex aspect-video items-center justify-center text-muted">
                  Préparation de la lecture sécurisée…
                </div>
              ) : playback?.url ? (
                // Lecteur natif sécurisé : mp4 servi via URL présignée R2 à
                // durée courte (renouvelée avant expiration par le refetch).
                <video
                  key={playback.url}
                  src={playback.url}
                  className="aspect-video w-full bg-black"
                  controls
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  playsInline
                >
                  <track kind="captions" />
                </video>
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
                <div className="flex aspect-video items-center justify-center text-muted">
                  Lecture indisponible
                </div>
              )
            ) : currentLesson?.type === 'QUIZ' ? (
              <QuizPlayer lessonId={currentLesson.id} courseSlug={slug} />
            ) : (
              <div className="flex aspect-video items-center justify-center p-8 text-center text-muted">
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
                className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50"
              >
                {currentLesson.completed ? '✓ Terminée' : 'Marquer comme terminée'}
              </button>
            </div>
          )}
        </div>

        {/* ─── Plan de la formation ─── */}
        <aside className="max-h-[75vh] overflow-y-auto rounded-card border border-line bg-surface p-4">
          {courseCompleted && (
            <div className="mb-4 rounded-xl border border-gold bg-gold-soft p-4 text-center">
              <p className="mb-2 text-sm font-semibold">🎓 Formation terminée !</p>
              <button
                onClick={() => {
                  setCertificateError(null);
                  claimCertificate.mutate();
                }}
                disabled={claimCertificate.isPending}
                className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50"
              >
                {claimCertificate.isPending ? 'Délivrance…' : 'Obtenir mon certificat'}
              </button>
              {certificateError && (
                <p className="mt-2 text-xs text-danger">{certificateError}</p>
              )}
            </div>
          )}
          {course.modules.map((module) => (
            <div key={module.id} className="mb-4">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {module.title}
              </p>
              {module.chapters.map((chapter) => (
                <div key={chapter.id} className="mb-2">
                  <p className="px-2 py-1 text-sm font-medium text-muted">{chapter.title}</p>
                  {chapter.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                        currentLesson?.id === lesson.id
                          ? 'bg-line text-ink'
                          : 'text-muted hover:bg-soft'
                      }`}
                    >
                      <span className={lesson.completed ? 'text-gold' : 'text-muted'}>
                        {lesson.completed ? '✓' : '▸'}
                      </span>
                      <span className="flex-1">{lesson.title}</span>
                      {lesson.durationSeconds != null && (
                        <span className="text-xs text-muted">
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
