'use client';

import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { ApiError, activateAccount } from '@/lib/api';

function ActivationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get('userId') ?? '';
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const linkInvalid = !userId || !token;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await activateAccount(userId, token, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Activation impossible. Réessayez.');
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
            La Forge <span className="text-gold">des Leaders</span>
          </p>
          <p className="mt-2 text-sm text-muted">Activation de votre compte</p>
        </div>

        <div className="rounded-card border border-line bg-surface p-8 shadow-card">
          {linkInvalid ? (
            <p className="text-center text-muted">
              Ce lien d&apos;activation est incomplet. Utilisez le bouton de l&apos;email que vous
              avez reçu après votre achat.
            </p>
          ) : (
            <form onSubmit={onSubmit}>
              <h1 className="mb-2 text-xl font-semibold">Choisissez votre mot de passe</h1>
              <p className="mb-6 text-sm text-muted">
                Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.
              </p>

              <label className="mb-1 block text-sm text-muted" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mb-4 w-full rounded-lg border border-line bg-soft px-4 py-3 outline-none transition focus:border-gold"
              />

              <label className="mb-1 block text-sm text-muted" htmlFor="confirm">
                Confirmez le mot de passe
              </label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mb-6 w-full rounded-lg border border-line bg-soft px-4 py-3 outline-none transition focus:border-gold"
              />

              {error && (
                <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gold py-3 font-semibold text-white transition hover:bg-gold-600 disabled:opacity-60"
              >
                {loading ? 'Activation…' : 'Activer mon compte'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </main>
  );
}

export default function ActivationPage() {
  return (
    <Suspense>
      <ActivationForm />
    </Suspense>
  );
}
