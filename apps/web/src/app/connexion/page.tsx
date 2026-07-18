'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, login } from '@/lib/api';

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      // Les formateurs/admins arrivent directement sur leur espace de travail
      router.replace(user.role === 'LEARNER' ? '/dashboard' : '/admin/formations');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Email ou mot de passe incorrect.'
          : 'Connexion impossible. Réessayez dans un instant.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-10 text-center">
          <p className="text-3xl font-bold tracking-tight">
            La Forge <span className="text-ember-500">des Leaders</span>
          </p>
          <p className="mt-2 text-sm text-forge-300">Votre campus privé de formation</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-forge-700 bg-forge-900 p-8 shadow-2xl"
        >
          <h1 className="mb-6 text-xl font-semibold">Connexion</h1>

          <label className="mb-1 block text-sm text-forge-300" htmlFor="email">
            Adresse email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-forge-700 bg-forge-800 px-4 py-3 outline-none transition focus:border-ember-500"
          />

          <label className="mb-1 block text-sm text-forge-300" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-6 w-full rounded-lg border border-forge-700 bg-forge-800 px-4 py-3 outline-none transition focus:border-ember-500"
          />

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-950/60 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ember-500 py-3 font-semibold text-forge-950 transition hover:bg-ember-400 disabled:opacity-60"
          >
            {loading ? 'Connexion…' : 'Accéder à mon campus'}
          </button>

          <p className="mt-6 text-center text-xs text-forge-500">
            Votre compte est créé automatiquement après votre achat.
            <br />
            Vérifiez l&apos;email reçu pour activer votre accès.
          </p>
        </form>
      </motion.div>
    </main>
  );
}
