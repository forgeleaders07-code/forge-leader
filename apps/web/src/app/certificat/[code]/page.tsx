'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { api } from '@/lib/api';

interface MyCertificate {
  code: string;
  courseTitle: string;
  learnerName: string;
  issuedAt: string;
}

/** Certificat imprimable (impression navigateur → PDF). */
export default function CertificatePage() {
  const { code } = useParams<{ code: string }>();

  const { data: cert, isLoading, error } = useQuery({
    queryKey: ['certificate', code],
    queryFn: () => api<MyCertificate>(`/certificates/mine/${code}`),
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-muted">Chargement du certificat…</p>
      </AppShell>
    );
  }
  if (error || !cert) {
    return (
      <AppShell>
        <p className="text-muted">Certificat introuvable.</p>
      </AppShell>
    );
  }

  const issuedDate = new Date(cert.issuedAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Votre certificat</h1>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:bg-gold-600"
        >
          🖨 Imprimer / PDF
        </button>
      </div>

      {/* Zone imprimable : fond clair volontaire pour l'impression */}
      <div className="mx-auto max-w-3xl rounded-card border-8 border-double border-gold bg-[#faf7f0] p-12 text-center text-[#1a1a1a] shadow-card print:border-4 print:shadow-none">
        <p className="text-sm uppercase tracking-[0.3em] text-[#b45309]">La Forge des Leaders</p>
        <h2 className="mt-6 text-3xl font-bold">Certificat de Réussite</h2>
        <p className="mt-8 text-sm text-[#555]">décerné à</p>
        <p className="mt-2 text-4xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
          {cert.learnerName || 'Apprenant'}
        </p>
        <p className="mt-8 text-sm text-[#555]">pour avoir complété avec succès la formation</p>
        <p className="mt-2 text-2xl font-semibold text-[#b45309]">{cert.courseTitle}</p>
        <div className="mx-auto mt-10 h-px w-48 bg-[#b45309]" />
        <p className="mt-6 text-sm text-[#555]">Délivré le {issuedDate}</p>
        <p className="mt-8 text-xs text-[#888]">
          Code de vérification : <span className="font-mono font-semibold">{cert.code}</span>
          <br />
          Authenticité vérifiable sur {typeof window !== 'undefined' ? window.location.origin : ''}
          /verification/{cert.code}
        </p>
        <p className="mt-6 text-2xl">🔥</p>
      </div>
    </AppShell>
  );
}
