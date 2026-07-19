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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
      api<{ wasNew: boolean; emailSent: 'activation' | 'course-added' | 'none' }>(
        '/admin/enrollments/grant',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            firstName: firstName.trim() || undefined,
            lastName: lastName.trim() || undefined,
            courseId,
          }),
        },
      ),
    onSuccess: (r) => {
      const text = !r.wasNew
        ? 'Cet utilisateur avait déjà un accès actif.'
        : r.emailSent === 'activation'
          ? "Accès attribué — email d'activation envoyé pour définir le mot de passe."
          : r.emailSent === 'course-added'
            ? 'Accès attribué — email de notification envoyé au membre.'
            : 'Accès attribué.';
      setMessage({ kind: 'ok', text });
      setEmail('');
      setFirstName('');
      setLastName('');
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
    <section className="rounded-card border border-line bg-surface p-6">
      <h1 className="mb-1 text-xl font-bold">Attribuer un accès</h1>
      <p className="mb-5 text-sm text-muted">
        Pour les ventes hors Systeme.io (WhatsApp, Mobile Money…). Le compte est créé
        automatiquement si l&apos;email est inconnu.
      </p>

      <form onSubmit={onGrant} className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email de l&apos;apprenant</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="apprenant@exemple.com"
            className="w-64 rounded-lg border border-line bg-soft px-3 py-2 outline-none focus:border-gold"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Prénom</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Facultatif"
            className="w-36 rounded-lg border border-line bg-soft px-3 py-2 outline-none focus:border-gold"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Nom</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Facultatif"
            className="w-36 rounded-lg border border-line bg-soft px-3 py-2 outline-none focus:border-gold"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Formation</span>
          <select
            required
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-72 rounded-lg border border-line bg-soft px-3 py-2 outline-none focus:border-gold"
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
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold-600 disabled:opacity-50"
        >
          {grant.isPending ? 'Attribution…' : 'Attribuer'}
        </button>
        {message && (
          <span
            role="status"
            className={`text-sm ${message.kind === 'ok' ? 'text-success' : 'text-danger'}`}
          >
            {message.text}
          </span>
        )}
      </form>

      {courseId && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">
            Inscrits ({enrollments?.filter((e) => !e.revokedAt).length ?? 0} actifs)
          </h2>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
            {enrollments?.map((enr) => (
              <div
                key={enr.id}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <span className="truncate">{enr.user.email}</span>
                  {enr.revokedAt && (
                    <span className="ml-2 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">
                      révoqué
                    </span>
                  )}
                  <span className="ml-2 text-xs text-muted">{enr.source}</span>
                </div>
                {!enr.revokedAt && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Révoquer l'accès de ${enr.user.email} ?`)) {
                        revoke.mutate(enr.user.email);
                      }
                    }}
                    className="shrink-0 rounded-lg border border-line px-3 py-1 text-xs text-muted transition hover:border-danger/40 hover:text-danger"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            ))}
            {enrollments?.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted">Aucun inscrit pour le moment.</p>
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
    <section className="rounded-card border border-line bg-surface p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Membres</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (email, nom)…"
          className="w-72 rounded-lg border border-line bg-soft px-3 py-2 text-sm outline-none focus:border-gold"
        />
      </div>

      {isLoading && <p className="text-sm text-muted">Chargement…</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Membre</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Formations</th>
              <th className="px-3 py-2">Dernière connexion</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-3 py-2 text-muted">{u.role}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      u.status === 'ACTIVE'
                        ? 'border-success/40 text-success'
                        : u.status === 'PENDING_ACTIVATION'
                          ? 'border-gold text-muted'
                          : 'border-danger/40 text-danger'
                    }`}
                  >
                    {u.status === 'ACTIVE'
                      ? 'Actif'
                      : u.status === 'PENDING_ACTIVATION'
                        ? 'En attente'
                        : 'Suspendu'}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted">{u.activeEnrollments}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users?.length === 0 && (
          <p className="px-3 py-4 text-sm text-muted">Aucun membre trouvé.</p>
        )}
      </div>
    </section>
  );
}
