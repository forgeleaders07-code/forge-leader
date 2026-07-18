'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

interface AdminStats {
  totals: {
    courses: number;
    publishedCourses: number;
    students: number;
    averageProgressPercent: number;
    certificates: number;
  };
  courses: {
    id: string;
    slug: string;
    title: string;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    totalLessons: number;
    activeEnrollments: number;
    avgProgressPercent: number;
    completionRatePercent: number;
    certificatesCount: number;
  }[];
  platform: {
    totalUsers: number;
    pendingUsers: number;
    videoLessons: number;
    webhooks: { processed: number; failed: number };
    recentEnrollments: {
      email: string;
      name: string;
      courseTitle: string;
      source: string;
      createdAt: string;
      revoked: boolean;
    }[];
  } | null;
}

const STATUS_BADGE: Record<string, { label: string; tone: 'neutral' | 'success' | 'danger' }> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  PUBLISHED: { label: 'Publiée', tone: 'success' },
  ARCHIVED: { label: 'Archivée', tone: 'danger' },
};

/** Tableau de bord formateur/admin (Vol 2 §14-15). */
export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api<AdminStats>('/admin/stats'),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
    );
  }
  if (!stats) return <p className="text-muted">Statistiques indisponibles.</p>;

  const tiles = [
    { icon: Users, label: 'Étudiants actifs', value: stats.totals.students },
    {
      icon: BookOpen,
      label: 'Formations (publiées)',
      value: `${stats.totals.courses} (${stats.totals.publishedCourses})`,
    },
    {
      icon: TrendingUp,
      label: 'Progression moyenne',
      value: `${stats.totals.averageProgressPercent} %`,
    },
    { icon: Award, label: 'Certificats délivrés', value: stats.totals.certificates },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold">Tableau de bord</h1>

      {/* ── Alerte webhooks (admin) ── */}
      {stats.platform && stats.platform.webhooks.failed > 0 && (
        <Card className="flex items-center gap-3 border-danger/40 p-4">
          <AlertTriangle className="shrink-0 text-danger" size={20} />
          <p className="text-sm">
            <span className="font-semibold text-danger">
              {stats.platform.webhooks.failed} webhook{stats.platform.webhooks.failed > 1 ? 's' : ''} en échec
            </span>{' '}
            — des achats n&apos;ont peut-être pas été provisionnés. À vérifier dans la table
            webhook_events.
          </p>
        </Card>
      )}

      {/* ── Tuiles ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, value }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-soft">
                <Icon className="text-gold" size={18} />
              </span>
              <p className="mt-3 font-display text-2xl font-bold">{value}</p>
              <p className="mt-0.5 text-xs text-muted">{label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Performance par formation ── */}
      <section>
        <h2 className="mb-4 font-display text-lg font-bold">Performance des formations</h2>
        {stats.courses.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted">
            Aucune formation.{' '}
            <Link href="/admin/formations" className="text-gold hover:underline">
              Créez la première
            </Link>
            .
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Formation</th>
                  <th className="px-5 py-3">Inscrits</th>
                  <th className="px-5 py-3">Progression moyenne</th>
                  <th className="px-5 py-3">Complétion</th>
                  <th className="px-5 py-3">Certificats</th>
                </tr>
              </thead>
              <tbody>
                {stats.courses.map((c) => {
                  const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.DRAFT;
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/formations/${c.id}`}
                          className="font-medium hover:text-gold"
                        >
                          {c.title}
                        </Link>
                        <div className="mt-1">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          <span className="ml-2 text-xs text-muted">{c.totalLessons} leçons</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">{c.activeEnrollments}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={c.avgProgressPercent} className="w-24" />
                          <span className="text-xs text-muted">{c.avgProgressPercent} %</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">{c.completionRatePercent} %</td>
                      <td className="px-5 py-3">{c.certificatesCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* ── Plateforme (admin uniquement) ── */}
      {stats.platform && (
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Plateforme</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="flex items-center gap-2 text-muted">
                  <Users size={16} /> Membres
                </dt>
                <dd className="font-medium">
                  {stats.platform.totalUsers}
                  {stats.platform.pendingUsers > 0 && (
                    <span className="ml-2 text-xs text-muted">
                      dont {stats.platform.pendingUsers} en attente d&apos;activation
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="flex items-center gap-2 text-muted">
                  <Video size={16} /> Leçons vidéo
                </dt>
                <dd className="font-medium">{stats.platform.videoLessons}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="flex items-center gap-2 text-muted">
                  <GraduationCap size={16} /> Webhooks traités / en échec
                </dt>
                <dd className="font-medium">
                  {stats.platform.webhooks.processed} /{' '}
                  <span className={stats.platform.webhooks.failed > 0 ? 'text-danger' : ''}>
                    {stats.platform.webhooks.failed}
                  </span>
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-lg font-bold">Dernières inscriptions</h2>
            {stats.platform.recentEnrollments.length === 0 ? (
              <p className="text-sm text-muted">Aucune inscription pour le moment.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {stats.platform.recentEnrollments.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.name || e.email}</p>
                      <p className="truncate text-xs text-muted">
                        {e.courseTitle} · {e.source === 'SYSTEME_IO_WEBHOOK' ? 'Achat' : 'Manuel'}
                        {e.revoked && <span className="text-danger"> · révoqué</span>}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(e.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
