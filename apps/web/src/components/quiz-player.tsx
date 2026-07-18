'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

interface LearnerQuiz {
  lessonId: string;
  passThresholdPercent: number;
  questions: {
    id: string;
    text: string;
    choices: { id: string; text: string }[];
  }[];
  lastAttempt: { scorePercent: number; passed: boolean; createdAt: string } | null;
}

interface QuizResult {
  scorePercent: number;
  passed: boolean;
  passThresholdPercent: number;
  correctCount: number;
  totalQuestions: number;
  corrections?: { questionId: string; correctChoiceId: string; wasCorrect: boolean }[];
}

/** Passage du quiz côté apprenant — la correction reste côté serveur. */
export function QuizPlayer({ lessonId, courseSlug }: { lessonId: string; courseSlug: string }) {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ['quiz', lessonId],
    queryFn: () => api<LearnerQuiz>(`/quiz/lessons/${lessonId}`),
  });

  const submit = useMutation({
    mutationFn: () =>
      api<QuizResult>(`/quiz/lessons/${lessonId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, choiceId]) => ({
            questionId,
            choiceId,
          })),
        }),
      }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      if (r.passed) {
        void queryClient.invalidateQueries({ queryKey: ['course', courseSlug] });
        void queryClient.invalidateQueries({ queryKey: ['my-courses'] });
      }
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Soumission impossible'),
  });

  if (isLoading) {
    return <p className="p-8 text-center text-muted">Chargement du quiz…</p>;
  }
  if (!quiz) {
    return <p className="p-8 text-center text-muted">Quiz indisponible.</p>;
  }

  const allAnswered = quiz.questions.every((q) => answers[q.id]);
  const corrections = new Map(result?.corrections?.map((c) => [c.questionId, c]) ?? []);

  return (
    <div className="space-y-6 p-6 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {quiz.questions.length} question{quiz.questions.length > 1 ? 's' : ''} — réussite à{' '}
          {quiz.passThresholdPercent} %
        </p>
        {quiz.lastAttempt && !result && (
          <p className={`text-xs ${quiz.lastAttempt.passed ? 'text-success' : 'text-muted'}`}>
            Dernière tentative : {quiz.lastAttempt.scorePercent} %{' '}
            {quiz.lastAttempt.passed ? '(réussie ✓)' : ''}
          </p>
        )}
      </div>

      {quiz.questions.map((q, qi) => {
        const correction = corrections.get(q.id);
        return (
          <fieldset key={q.id}>
            <legend className="mb-2 font-medium">
              {qi + 1}. {q.text}
              {correction && (
                <span className={correction.wasCorrect ? 'text-success' : 'text-danger'}>
                  {' '}
                  {correction.wasCorrect ? '✓' : '✗'}
                </span>
              )}
            </legend>
            <div className="space-y-1.5 pl-1">
              {q.choices.map((c) => {
                const isChosen = answers[q.id] === c.id;
                const isCorrectAnswer = correction?.correctChoiceId === c.id;
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition ${
                      isCorrectAnswer
                        ? 'border-success bg-success/10'
                        : isChosen
                          ? 'border-gold bg-soft'
                          : 'border-line hover:border-gold'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={isChosen}
                      disabled={result?.passed === true}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                    />
                    {c.text}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {result ? (
        <div
          className={`rounded-xl border p-5 text-center ${
            result.passed ? 'border-success bg-success/10' : 'border-danger/40 bg-danger/10'
          }`}
        >
          <p className="text-2xl font-bold">{result.scorePercent} %</p>
          <p className="mt-1 text-sm text-muted">
            {result.correctCount}/{result.totalQuestions} bonnes réponses —{' '}
            {result.passed
              ? 'quiz réussi, leçon validée ! 🎉'
              : `il faut au moins ${result.passThresholdPercent} % pour valider.`}
          </p>
          {!result.passed && (
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
              className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold-600"
            >
              Réessayer
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => submit.mutate()}
          disabled={!allAnswered || submit.isPending}
          className="w-full rounded-lg bg-gold py-3 font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50"
        >
          {submit.isPending
            ? 'Correction…'
            : allAnswered
              ? 'Valider mes réponses'
              : 'Répondez à toutes les questions'}
        </button>
      )}
    </div>
  );
}
