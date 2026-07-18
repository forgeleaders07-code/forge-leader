'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { AdminCourseSummary, AdminEnrollment, AdminUser } from '@/lib/admin-types';

/** Gestion des accès : attribution/révocation manuelle + annuaire des membres. */
export default function AdminAccessPage() {
  return (
    <div className="space-y-10">
      <GrantAccessSection />
      <MembersSection />
    </div>
  );
}

function GrantAccessSection() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const { data: courses } = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => api<AdminCourseSummary[]>('/admin/courses'),
  });

  const { data: enrollments } = useQuery({
    queryKey: ['admin-enrollments', courseId],
    queryFn: () => api<AdminEnrollment[]>(`/admin/courses/${courseId}/enrollments`),
    enabled: !!courseId,
  });

  const grant = useMutation({
    mutationFn: () =>
      api<{ wasNew: boolean }>('/admin/enrollments/grant', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), courseId }),
      }),
    onSuccess: (r) => {
      setMessage({
        kind: 'ok',
        text: r.wasNew ? 'Accès attribué.' : 'Cet utilisateur avait déjà un accès actif.',
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-enrollments', courseId] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e) =>
      setMessage({ kind: 'error', text: e instanceof ApiError ? e.message : 'Erreur inattendue' }),
  });

  const revoke = useMutation({
    mutationFn: (targetEmail: string) =>
      api('/admin/enrollments/revoke', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail, courseId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-enrollments', courseId] });
    },
  });

  function onGrant(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (email.trim() && courseId) grant.mutate();
  }

  return (
    <section className="rounded-2xl border border-forge-700 bg-forge-900 p-6">
      <h1 className="mb-1 text-xl font-bold">Attribuer un accès</h1>
      <p className="mb-5 text-sm text-forge-300">
        Pour les ventes hors Systeme.io (WhatsApp, Mobile Money…). Le compte est créé
        automatiquement si l&apos;email est inconnu.
      </p>

      <form onSubmit={onGrant} className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-forge-300">Email de l&apos;apprenant</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="apprenant@exemple.com"
            className="w-72 rounded-lg border border-forge-700 bg-forge-800 px-3 py-2 outline-none focus:border-ember-500"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-forge-300">Formation</span>
          <select
            required
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-72 rounded-lg border border-forge-700 bg-forge-800 px-3 py-2 outline-none focus:border-ember-500"
          >
            <option value="">— Choisir —</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={grant.isPending}
          className="rounded-lg bg-ember-500 px-4 py-2 text-sm font-semibold text-forge-950 transition hover:bg-ember-400 disabled:opacity-50"
        >
          {grant.isPending ? 'Attribution…' : 'Attribuer'}
        </button>
        {message && (
          <span
            role="status"
            className={`text-sm ${message.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {message.text}
          </span>
        )}
      </form>

      {courseId && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-forge-300">
            Inscrits ({enrollments?.filter((e) => !e.revokedAt).length ?? 0} actifs)
          </h2>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-forge-800">
            {enrollments?.map((enr) => (
              <div
                key={enr.id}
                className="flex items-center justify-between gap-3 border-b border-forge-800 px-4 py-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <span className="truncate">{enr.user.email}</span>
                  {enr.revokedAt && (
                    <span className="ml-2 rounded bg-red-950 px-1.5 py-0.5 text-[10px] text-red-300">
                      révoqué
                    </span>
                  )}
                  <span className="ml-2 text-xs text-forge-500">{enr.source}</span>
                </div>
                {!enr.revokedAt && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Révoquer l'accès de ${enr.user.email} ?`)) {
                        revoke.mutate(enr.user.email);
                      }
                    }}
                    className="shrink-0 rounded-lg border border-forge-700 px-3 py-1 text-xs text-forge-300 transition hover:border-red-800 hover:text-red-300"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            ))}
            {enrollments?.length === 0 && (
              <p className="px-4 py-3 text-sm text-forge-500">Aucun inscrit pour le moment.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function MembersSection() {
  const [query, setQuery] = useState('');
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', query],
    queryFn: () => api<AdminUser[]>(`/admin/users?query=${encodeURIComponent(query)}`),
  });

  return (
    <section className="rounded-2xl border border-forge-700 bg-forge-900 p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Membres</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (email, nom)…"
          className="w-72 rounded-lg border border-forge-700 bg-forge-800 px-3 py-2 text-sm outline-none focus:border-ember-500"
        />
      </div>

      {isLoading && <p className="text-sm text-forge-300">Chargement…</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-forge-700 text-xs uppercase tracking-wide text-forge-500">
              <th className="px-3 py-2">Membre</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Formations</th>
              <th className="px-3 py-2">Dernière connexion</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-forge-800 last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-forge-500">{u.email}</p>
                </td>
                <td className="px-3 py-2 text-forge-300">{u.role}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      u.status === 'ACTIVE'
                        ? 'border-emerald-700 text-emerald-400'
                        : u.status === 'PENDING_ACTIVATION'
                          ? 'border-forge-500 text-forge-300'
                          : 'border-red-800 text-red-400'
                    }`}
                  >
                    {u.status === 'ACTIVE'
                      ? 'Actif'
                      : u.status === 'PENDING_ACTIVATION'
                        ? 'En attente'
                        : 'Suspendu'}
                  </span>
                </td>
                <td className="px-3 py-2 text-forge-300">{u.activeEnrollments}</td>
                <td className="px-3 py-2 text-xs text-forge-500">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users?.length === 0 && (
          <p className="px-3 py-4 text-sm text-forge-500">Aucun membre trouvé.</p>
        )}
      </div>
    </section>
  );
}
