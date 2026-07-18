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
            La Forge <span className="text-ember-500">des Leaders</span>
          </p>
          <p className="mt-2 text-sm text-forge-300">Activation de votre compte</p>
        </div>

        <div className="rounded-2xl border border-forge-700 bg-forge-900 p-8 shadow-2xl">
          {linkInvalid ? (
            <p className="text-center text-forge-300">
              Ce lien d&apos;activation est incomplet. Utilisez le bouton de l&apos;email que vous
              avez reçu après votre achat.
            </p>
          ) : (
            <form onSubmit={onSubmit}>
              <h1 className="mb-2 text-xl font-semibold">Choisissez votre mot de passe</h1>
              <p className="mb-6 text-sm text-forge-300">
                Au moins 10 caractères, avec une majuscule, une minuscule et un chiffre.
              </p>

              <label className="mb-1 block text-sm text-forge-300" htmlFor="password">
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
                className="mb-4 w-full rounded-lg border border-forge-700 bg-forge-800 px-4 py-3 outline-none transition focus:border-ember-500"
              />

              <label className="mb-1 block text-sm text-forge-300" htmlFor="confirm">
                Confirmez le mot de passe
              </label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
