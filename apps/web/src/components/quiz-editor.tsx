'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface EditorChoice {
  text: string;
  isCorrect: boolean;
}
interface EditorQuestion {
  text: string;
  choices: EditorChoice[];
}

interface StoredQuiz {
  lessonId: string;
  questions: {
    id: string;
    text: string;
    choices: { id: string; text: string; isCorrect: boolean }[];
  }[];
}

const EMPTY_QUESTION: EditorQuestion = {
  text: '',
  choices: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
};

/** Éditeur du quiz d'une leçon (remplacement complet à l'enregistrement). */
export function QuizEditor({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const { data: stored, isLoading } = useQuery({
    queryKey: ['admin-quiz', lessonId],
    queryFn: () => api<StoredQuiz>(`/admin/lessons/${lessonId}/quiz`),
  });

  useEffect(() => {
    if (stored) {
      setQuestions(
        stored.questions.length > 0
          ? stored.questions.map((q) => ({
              text: q.text,
              choices: q.choices.map((c) => ({ text: c.text, isCorrect: c.isCorrect })),
            }))
          : [structuredClone(EMPTY_QUESTION)],
      );
    }
  }, [stored]);

  const save = useMutation({
    mutationFn: () =>
      api(`/admin/lessons/${lessonId}/quiz`, {
        method: 'PUT',
        body: JSON.stringify({ questions }),
      }),
    onSuccess: () => {
      setMessage({ kind: 'ok', text: 'Quiz enregistré.' });
      void queryClient.invalidateQueries({ queryKey: ['admin-quiz', lessonId] });
    },
    onError: (e) =>
      setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Erreur inattendue' }),
  });

  function patchQuestion(qi: number, patch: Partial<EditorQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }

  function patchChoice(qi: number, ci: number, patch: Partial<EditorChoice>) {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        return {
          ...q,
          choices: q.choices.map((c, j) => {
            // Une seule bonne réponse : cocher un choix décoche les autres
            if (patch.isCorrect === true) return { ...c, isCorrect: j === ci };
            return j === ci ? { ...c, ...patch } : c;
          }),
        };
      }),
    );
  }

  if (isLoading) return <p className="text-xs text-muted">Chargement du quiz…</p>;

  return (
    <div className="space-y-4 rounded-lg border border-line bg-soft p-4 sm:col-span-2">
      <p className="text-sm font-semibold">Questions du quiz (seuil de réussite : 70 %)</p>

      {questions.map((q, qi) => (
        <div key={qi} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-muted">Q{qi + 1}</span>
            <input
              value={q.text}
              onChange={(e) => patchQuestion(qi, { text: e.target.value })}
              placeholder="Énoncé de la question"
              className="flex-1 rounded-lg border border-line bg-soft px-3 py-1.5 text-sm outline-none focus:border-gold"
            />
            <button
              type="button"
              onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}
              disabled={questions.length <= 1}
              title="Supprimer la question"
              className="rounded px-2 py-1 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 pl-6">
            {q.choices.map((c, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${lessonId}-${qi}`}
                  checked={c.isCorrect}
                  onChange={() => patchChoice(qi, ci, { isCorrect: true })}
                  title="Bonne réponse"
                />
                <input
                  value={c.text}
                  onChange={(e) => patchChoice(qi, ci, { text: e.target.value })}
                  placeholder={`Choix ${ci + 1}`}
                  className="flex-1 rounded-lg border border-line bg-soft px-3 py-1 text-sm outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={() =>
                    patchQuestion(qi, { choices: q.choices.filter((_, j) => j !== ci) })
                  }
                  disabled={q.choices.length <= 2}
                  title="Supprimer le choix"
                  className="rounded px-2 py-0.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patchQuestion(qi, { choices: [...q.choices, { text: '', isCorrect: false }] })
              }
              disabled={q.choices.length >= 8}
              className="rounded-lg border border-line px-2 py-1 text-xs text-muted transition hover:border-gold disabled:opacity-30"
            >
              + Choix
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setQuestions((qs) => [...qs, structuredClone(EMPTY_QUESTION)])}
          className="rounded-lg border border-line px-3 py-1.5 text-xs transition hover:border-gold"
        >
          + Question
        </button>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            save.mutate();
          }}
          disabled={save.isPending}
          className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50"
        >
          {save.isPending ? 'Enregistrement…' : 'Enregistrer le quiz'}
        </button>
        {message && (
          <span
            role="status"
            className={`text-xs ${message.kind === 'ok' ? 'text-success' : 'text-danger'}`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
