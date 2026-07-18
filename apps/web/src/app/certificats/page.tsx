'use client';

import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

interface MyCertificate {
  code: string;
  courseTitle: string;
  issuedAt: string;
}

export default function CertificatesPage() {
  const { data: certificates, isLoading } = useQuery({
    queryKey: ['my-certificates'],
    queryFn: () => api<MyCertificate[]>('/certificates/mine'),
  });

  return (
    <AppShell>
      <h1 className="mb-8 font-display text-2xl font-bold">Mes certificats</h1>

      {isLoading && <p className="text-muted">Chargement…</p>}

      {certificates && certificates.length === 0 && (
        <Card className="p-10 text-center">
          <Award className="mx-auto text-gold" size={40} />
          <p className="mt-4 text-lg font-medium">Aucun certificat pour le moment</p>
          <p className="mt-2 text-sm text-muted">
            Terminez une formation à 100 % pour obtenir votre certificat de réussite.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {certificates?.map((cert) => (
          <Link key={cert.code} href={`/certificat/${cert.code}`}>
            <Card hoverable className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold-soft">
                <Award className="text-gold" size={24} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{cert.courseTitle}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Délivré le {new Date(cert.issuedAt).toLocaleDateString('fr-FR')} ·{' '}
                  <span className="font-mono">{cert.code}</span>
                </span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
