'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, AuthUser, clearSession, hasSession, logout } from '@/lib/api';

/**
 * Coquille des pages membres : garde de session côté client + en-tête.
 * (La vraie sécurité est côté API ; ceci n'est que de l'UX.)
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const { data: me, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<AuthUser>('/users/me'),
    enabled: ready,
  });

  useEffect(() => {
    if (!hasSession() || isError) {
      // Session absente ou refresh token mort : retour propre à la connexion.
      clearSession();
      router.replace('/connexion');
    } else {
      setReady(true);
    }
  }, [isError, router]);

  async function onLogout() {
    await logout();
    router.replace('/connexion');
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-forge-300">Chargement…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-forge-800 bg-forge-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-lg font-bold tracking-tight"
          >
            La Forge <span className="text-ember-500">des Leaders</span>
          </button>
          <div className="flex items-center gap-3">
            {me && me.role !== 'LEARNER' && (
              <Link
                href="/admin/formations"
                className="rounded-lg border border-ember-600 px-4 py-2 text-sm text-ember-400 transition hover:bg-ember-600/10"
              >
                Administration
              </Link>
            )}
            <button
              onClick={onLogout}
              className="rounded-lg border border-forge-700 px-4 py-2 text-sm text-forge-300 transition hover:border-forge-500 hover:text-forge-100"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}
