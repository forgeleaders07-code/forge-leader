'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { AdminChapter, AdminCourseDetail, AdminLesson, AdminModule } from '@/lib/admin-types';
import type { PlaybackGrant } from '@/lib/types';
import { VideoUploader } from '@/components/video-uploader';
import { QuizEditor } from '@/components/quiz-editor';

/** Éditeur complet d'une formation : métadonnées + arborescence du contenu. */
export default function CourseEditorPage() {
  const { id } = useParams<{ id: string }>();

  const { data: course, isLoading } = useQuery({
    queryKey: ['admin-course', id],
    queryFn: () => api<AdminCourseDetail>(`/admin/courses/${id}`),
  });

  if (isLoading) return <p className="text-muted">Chargement…</p>;
  if (!course) return <p className="text-muted">Formation introuvable.</p>;

  return (
    <div className="space-y-10">
      <MetadataForm course={course} />
      <ContentTree course={course} />
    </div>
  );
}

// ─────────────────────────── Métadonnées ───────────────────────────

function MetadataForm({ course }: { course: AdminCourseDetail }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: course.title,
    slug: course.slug,
    description: course.description,
    externalProductIds: course.externalProductIds.join(', '),
  });
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setForm({
      title: course.title,
      slug: course.slug,
      description: course.description,
      externalProductIds: course.externalProductIds.join(', '),
    });
  }, [course]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/admin/courses/${course.id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setMessage({ kind: 'ok', text: 'Enregistré.' });
      void queryClient.invalidateQueries({ queryKey: ['admin-course', course.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
    onError: (e) =>
      setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Erreur inattendue' }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    save.mutate({
      title: form.title,
      slug: form.slug,
      description: form.description,
      externalProductIds: form.externalProductIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  function setStatus(status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
    setMessage(null);
    save.mutate({ status });
  }

  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold">{course.title}</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Statut : {course.status}</span>
          {course.status !== 'PUBLISHED' && (
            <button
              onClick={() => setStatus('PUBLISHED')}
              className="rounded-lg bg-success px-3 py-1.5 text-sm font-semibold transition hover:opacity-90"
            >
              Publier
            </button>
          )}
          {course.status === 'PUBLISHED' && (
            <button
              onClick={() => setStatus('DRAFT')}
              className="rounded-lg border border-line px-3 py-1.5 text-sm transition hover:border-gold"
            >
              Repasser en brouillon
            </button>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Titre</span>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-line bg-soft px-3 py-2 outline-none focus:border-gold"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Slug (URL)</span>
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="w-full rounded-lg border border-line bg-soft px-3 py-2 font-mono text-xs outline-none focus:border-gold"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded-lg border border-line bg-soft px-3 py-2 outline-none focus:border-gold"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">
            Identifiants produits Systeme.io (séparés par des virgules) — lient les achats à cette
            formation
          </span>
          <input
            value={form.externalProductIds}
            onChange={(e) => setForm({ ...form, externalProductIds: e.target.value })}
            placeholder="ex : sio-prod-123, sio-prod-456"
            className="w-full rounded-lg border border-line bg-soft px-3 py-2 font-mono text-xs outline-none focus:border-gold"
          />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50"
          >
            {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {message && (
            <span
              role="status"
              className={`text-sm ${message.kind === 'ok' ? 'text-success' : 'text-danger'}`}
            >
              {message.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

// ─────────────────────────── Arborescence ───────────────────────────

function useTreeMutation(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
    },
  });
}

function ContentTree({ course }: { course: AdminCourseDetail }) {
  const mutate = useTreeMutation(course.id);
  const [newModuleTitle, setNewModuleTitle] = useState('');

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold">Contenu de la formation</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newModuleTitle.trim()) return;
            mutate.mutate({
              path: `/admin/courses/${course.id}/modules`,
              method: 'POST',
              body: { title: newModuleTitle.trim() },
            });
            setNewModuleTitle('');
          }}
          className="flex gap-2"
        >
          <input
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="Titre du nouveau module"
            className="w-64 rounded-lg border border-line bg-soft px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="rounded-lg border border-line px-3 py-2 text-sm transition hover:border-gold"
          >
            + Module
          </button>
        </form>
      </div>

      {course.modules.length === 0 && (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-sm text-muted">
          Aucun module. Ajoutez-en un pour structurer la formation.
        </p>
      )}

      <div className="space-y-4">
        {course.modules.map((module) => (
          <ModuleCard key={module.id} module={module} courseId={course.id} />
        ))}
      </div>
    </section>
  );
}

function RowActions(props: {
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button onClick={props.onUp} title="Monter" className="rounded px-2 py-1 text-muted hover:bg-line hover:text-ink">↑</button>
      <button onClick={props.onDown} title="Descendre" className="rounded px-2 py-1 text-muted hover:bg-line hover:text-ink">↓</button>
      <button
        onClick={() => {
          if (window.confirm(props.deleteLabel)) props.onDelete();
        }}
        title="Supprimer"
        className="rounded px-2 py-1 text-muted hover:bg-danger/10 hover:text-danger"
      >
        ✕
      </button>
    </div>
  );
}

function EditableTitle({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (title: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Renommer"
        className={`truncate text-left hover:underline ${className ?? ''}`}
      >
        {value}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
        setEditing(false);
      }}
      className="flex flex-1 gap-2"
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setEditing(false)}
        className="flex-1 rounded border border-gold bg-soft px-2 py-1 text-sm outline-none"
      />
    </form>
  );
}

function ModuleCard({ module, courseId }: { module: AdminModule; courseId: string }) {
  const mutate = useTreeMutation(courseId);
  const [newChapterTitle, setNewChapterTitle] = useState('');

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <EditableTitle
          value={module.title}
          onSave={(title) =>
            mutate.mutate({ path: `/admin/modules/${module.id}`, method: 'PATCH', body: { title } })
          }
          className="font-semibold"
        />
        <RowActions
          onUp={() =>
            mutate.mutate({ path: `/admin/modules/${module.id}/move`, method: 'PUT', body: { direction: 'up' } })
          }
          onDown={() =>
            mutate.mutate({ path: `/admin/modules/${module.id}/move`, method: 'PUT', body: { direction: 'down' } })
          }
          onDelete={() => mutate.mutate({ path: `/admin/modules/${module.id}`, method: 'DELETE' })}
          deleteLabel={`Supprimer le module « ${module.title} » et tout son contenu ?`}
        />
      </div>

      <div className="space-y-3 pl-2">
        {module.chapters.map((chapter) => (
          <ChapterBlock key={chapter.id} chapter={chapter} courseId={courseId} />
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newChapterTitle.trim()) return;
          mutate.mutate({
            path: `/admin/modules/${module.id}/chapters`,
            method: 'POST',
            body: { title: newChapterTitle.trim() },
          });
          setNewChapterTitle('');
        }}
        className="mt-3 flex gap-2 pl-2"
      >
        <input
          value={newChapterTitle}
          onChange={(e) => setNewChapterTitle(e.target.value)}
          placeholder="Nouveau chapitre"
          className="w-56 rounded-lg border border-line bg-soft px-3 py-1.5 text-sm outline-none focus:border-gold"
        />
        <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-xs transition hover:border-gold">
          + Chapitre
        </button>
      </form>
    </div>
  );
}

function ChapterBlock({ chapter, courseId }: { chapter: AdminChapter; courseId: string }) {
  const mutate = useTreeMutation(courseId);
  const [addingLesson, setAddingLesson] = useState(false);

  return (
    <div className="rounded-xl border border-line bg-soft p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <EditableTitle
          value={chapter.title}
          onSave={(title) =>
            mutate.mutate({ path: `/admin/chapters/${chapter.id}`, method: 'PATCH', body: { title } })
          }
          className="text-sm font-medium text-muted"
        />
        <RowActions
          onUp={() =>
            mutate.mutate({ path: `/admin/chapters/${chapter.id}/move`, method: 'PUT', body: { direction: 'up' } })
          }
          onDown={() =>
            mutate.mutate({ path: `/admin/chapters/${chapter.id}/move`, method: 'PUT', body: { direction: 'down' } })
          }
          onDelete={() => mutate.mutate({ path: `/admin/chapters/${chapter.id}`, method: 'DELETE' })}
          deleteLabel={`Supprimer le chapitre « ${chapter.title} » et ses leçons ?`}
        />
      </div>

      <div className="space-y-1">
        {chapter.lessons.map((lesson) => (
          <LessonRow key={lesson.id} lesson={lesson} courseId={courseId} />
        ))}
      </div>

      {addingLesson ? (
        <LessonForm
          courseId={courseId}
          onSubmit={(body) => {
            mutate.mutate({ path: `/admin/chapters/${chapter.id}/lessons`, method: 'POST', body });
            setAddingLesson(false);
          }}
          onCancel={() => setAddingLesson(false)}
        />
      ) : (
        <button
          onClick={() => setAddingLesson(true)}
          className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-gold"
        >
          + Leçon
        </button>
      )}
    </div>
  );
}

const LESSON_TYPE_ICONS: Record<string, string> = {
  VIDEO: '▶',
  TEXT: '¶',
  QUIZ: '?',
  RESOURCE: '⇩',
};

function LessonRow({ lesson, courseId }: { lesson: AdminLesson; courseId: string }) {
  const mutate = useTreeMutation(courseId);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <LessonForm
        courseId={courseId}
        initial={lesson}
        onSubmit={(body) => {
          mutate.mutate({ path: `/admin/lessons/${lesson.id}`, method: 'PATCH', body });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-soft">
      <button onClick={() => setEditing(true)} className="flex min-w-0 items-center gap-2 text-left" title="Modifier">
        <span className="text-muted">{LESSON_TYPE_ICONS[lesson.type] ?? '·'}</span>
        <span className="truncate">{lesson.title}</span>
        {lesson.type === 'VIDEO' && !lesson.streamVideoId && (
          <span className="shrink-0 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">
            vidéo manquante
          </span>
        )}
        {lesson.isFreePreview && (
          <span className="shrink-0 rounded bg-line px-1.5 py-0.5 text-[10px] text-muted">
            aperçu gratuit
          </span>
        )}
      </button>
      <RowActions
        onUp={() =>
          mutate.mutate({ path: `/admin/lessons/${lesson.id}/move`, method: 'PUT', body: { direction: 'up' } })
        }
        onDown={() =>
          mutate.mutate({ path: `/admin/lessons/${lesson.id}/move`, method: 'PUT', body: { direction: 'down' } })
        }
        onDelete={() => mutate.mutate({ path: `/admin/lessons/${lesson.id}`, method: 'DELETE' })}
        deleteLabel={`Supprimer la leçon « ${lesson.title} » ?`}
      />
    </div>
  );
}

/**
 * Aperçu de la vidéo dans l'éditeur admin : lecture réservée au propriétaire
 * (endpoint admin, sans contrôle d'achat). URL présignée renouvelée avant
 * expiration. mp4 natif (R2) ou iframe (Cloudflare Stream) selon le provider.
 */
function AdminVideoPreview({ lessonId }: { lessonId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-playback', lessonId],
    queryFn: () => api<PlaybackGrant>(`/admin/lessons/${lessonId}/playback`, { method: 'POST' }),
    refetchInterval: (q) => {
      const grant = q.state.data;
      if (!grant) return false;
      return Math.max(30_000, (grant.expiresAt - 120) * 1000 - Date.now());
    },
  });

  if (isLoading) {
    return <p className="text-xs text-muted">Chargement de l&apos;aperçu vidéo…</p>;
  }
  if (error || !data) {
    return (
      <p className="text-xs text-danger">
        Aperçu indisponible pour l&apos;instant (la vidéo vient peut-être d&apos;être téléversée).
      </p>
    );
  }
  if (data.url) {
    return (
      <video
        key={data.url}
        src={data.url}
        controls
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        playsInline
        className="aspect-video w-full rounded-lg border border-line bg-black"
      >
        <track kind="captions" />
      </video>
    );
  }
  if (data.iframeUrl) {
    return (
      <iframe
        key={data.token}
        src={data.iframeUrl}
        className="aspect-video w-full rounded-lg border border-line"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
        title="Aperçu vidéo"
      />
    );
  }
  return null;
}

function LessonForm({
  courseId,
  initial,
  onSubmit,
  onCancel,
}: {
  courseId: string;
  initial?: AdminLesson;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    type: initial?.type ?? 'VIDEO',
    streamVideoId: initial?.streamVideoId ?? '',
    durationSeconds: initial?.durationSeconds?.toString() ?? '',
    isFreePreview: initial?.isFreePreview ?? false,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        onSubmit({
          title: form.title.trim(),
          type: form.type,
          streamVideoId: form.streamVideoId.trim() || undefined,
          durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : undefined,
          isFreePreview: form.isFreePreview,
        });
      }}
      className="mt-2 grid gap-2 rounded-lg border border-gold/40 bg-surface p-3 sm:grid-cols-2"
    >
      <input
        autoFocus
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Titre de la leçon"
        className="rounded-lg border border-line bg-soft px-3 py-1.5 text-sm outline-none focus:border-gold"
      />
      <select
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
        className="rounded-lg border border-line bg-soft px-3 py-1.5 text-sm outline-none focus:border-gold"
      >
        <option value="VIDEO">Vidéo</option>
        <option value="TEXT">Texte</option>
        <option value="QUIZ">Quiz</option>
        <option value="RESOURCE">Ressource</option>
      </select>
      {form.type === 'VIDEO' && (
        <>
          <input
            value={form.streamVideoId}
            onChange={(e) => setForm({ ...form, streamVideoId: e.target.value })}
            placeholder="ID vidéo Cloudflare Stream (ou téléversez ci-dessous)"
            className="rounded-lg border border-line bg-soft px-3 py-1.5 font-mono text-xs outline-none focus:border-gold"
          />
          <input
            value={form.durationSeconds}
            onChange={(e) => setForm({ ...form, durationSeconds: e.target.value.replace(/\D/g, '') })}
            placeholder="Durée (secondes)"
            className="rounded-lg border border-line bg-soft px-3 py-1.5 text-sm outline-none focus:border-gold"
          />
          {initial ? (
            <div className="space-y-3 sm:col-span-2">
              {initial.streamVideoId && <AdminVideoPreview lessonId={initial.id} />}
              <VideoUploader lessonId={initial.id} courseId={courseId} />
            </div>
          ) : (
            <p className="text-[11px] text-muted sm:col-span-2">
              Créez d&apos;abord la leçon, puis rouvrez-la pour téléverser la vidéo.
            </p>
          )}
        </>
      )}
      {form.type === 'QUIZ' &&
        (initial ? (
          <QuizEditor lessonId={initial.id} />
        ) : (
          <p className="text-[11px] text-muted sm:col-span-2">
            Créez d&apos;abord la leçon, puis rouvrez-la pour rédiger les questions du quiz.
          </p>
        ))}
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={form.isFreePreview}
          onChange={(e) => setForm({ ...form, isFreePreview: e.target.checked })}
        />
        Aperçu gratuit (lisible sans achat)
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-3 py-1.5 text-xs transition hover:border-gold">
          Annuler
        </button>
        <button type="submit" className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-600">
          {initial ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </form>
  );
}
