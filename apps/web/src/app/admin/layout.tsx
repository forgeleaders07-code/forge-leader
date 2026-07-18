'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api, AuthUser, clearSession, hasSession, logout } from '@/lib/api';

/**
 * Coquille de l'espace d'administration : accessible aux rôles
 * ADMIN et INSTRUCTOR uniquement (la vraie barrière reste l'API).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<AuthUser>('/users/me'),
    enabled: typeof window !== 'undefined' && hasSession(),
  });

  useEffect(() => {
    if (!hasSession() || isError) {
      // Session absente ou irrécupérable (refresh token expiré/révoqué) :
      // on nettoie et on renvoie à la connexion plutôt que de rester bloqué.
      clearSession();
      router.replace('/connexion');
    } else if (me && me.role === 'LEARNER') {
      router.replace('/dashboard');
    }
  }, [me, isError, router]);

  if (isLoading || !me || me.role === 'LEARNER') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Chargement…</p>
      </main>
    );
  }

  const links = [
    { href: '/admin/formations', label: 'Formations' },
    ...(me.role === 'ADMIN' ? [{ href: '/admin/acces', label: 'Accès & membres' }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-bold tracking-tight">
              La Forge <span className="text-gold">des Leaders</span>
            </Link>
            <nav className="flex gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    pathname.startsWith(l.href)
                      ? 'bg-line text-ink'
                      : 'text-muted hover:bg-soft'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-gold px-3 py-1 text-xs text-gold">
              {me.role === 'ADMIN' ? 'Administrateur' : 'Formateur'}
            </span>
            <button
              onClick={async () => {
                await logout();
                router.replace('/connexion');
              }}
              className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-gold hover:text-ink"
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
