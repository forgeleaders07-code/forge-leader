'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type Verification =
  | { valid: false }
  | { valid: true; code: string; learnerName: string; courseTitle: string; issuedAt: string };

/**
 * Vérification PUBLIQUE d'un certificat par son code — accessible sans compte
 * (un employeur peut contrôler l'authenticité d'un certificat présenté).
 */
export default function VerificationPage() {
  const { code } = useParams<{ code: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['verify', code],
    queryFn: async (): Promise<Verification> => {
      const res = await fetch(`${API_URL}/certificates/verify/${encodeURIComponent(code)}`);
      if (!res.ok) return { valid: false };
      return res.json();
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <p className="mb-8 text-2xl font-bold tracking-tight">
          La Forge <span className="text-gold">des Leaders</span>
        </p>

        <div className="rounded-card border border-line bg-surface p-8">
          <h1 className="mb-6 text-lg font-semibold">Vérification de certificat</h1>

          {isLoading && <p className="text-muted">Vérification en cours…</p>}

          {data && !data.valid && (
            <div>
              <p className="text-4xl">❌</p>
              <p className="mt-4 font-semibold text-danger">Certificat non reconnu</p>
              <p className="mt-2 text-sm text-muted">
                Le code <span className="font-mono">{code}</span> ne correspond à aucun certificat
                délivré par La Forge des Leaders.
              </p>
            </div>
          )}

          {data?.valid && (
            <div>
              <p className="text-4xl">✅</p>
              <p className="mt-4 font-semibold text-success">Certificat authentique</p>
              <dl className="mt-6 space-y-3 text-left text-sm">
                <div className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-muted">Titulaire</dt>
                  <dd className="font-medium">{data.learnerName}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-muted">Formation</dt>
                  <dd className="font-medium">{data.courseTitle}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-muted">Délivré le</dt>
                  <dd className="font-medium">
                    {new Date(data.issuedAt).toLocaleDateString('fr-FR')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Code</dt>
                  <dd className="font-mono text-xs">{data.code}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
