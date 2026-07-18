'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { hasSession } from '@/lib/api';

/** Racine : aiguillage session → dashboard, sinon → connexion. */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasSession() ? '/dashboard' : '/connexion');
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted">Chargement…</p>
    </main>
  );
}
