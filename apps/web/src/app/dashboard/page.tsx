'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Award, BookOpenCheck, Clock, Flame, Medal, Play, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { api, AuthUser } from '@/lib/api';
import type { MyCourse } from '@/lib/types';

interface DashboardStats {
  globalProgressPercent: number;
  completedLessons: number;
  totalLessons: number;
  studySeconds: number;
  streakDays: number;
  certificatesCount: number;
  quizPassedCount: number;
  badges: { id: string; label: string; earned: boolean }[];
  continueCourse: {
    slug: string;
    title: string;
    coverUrl: string | null;
    progressPercent: number;
    nextLessonTitle: string | null;
    isCompleted: boolean;
  } | null;
}

function formatStudyTime(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} h ${minutes.toString().padStart(2, '0')}` : `${hours} h`;
}

/** Dashboard apprenant enrichi (Vol 2 §13). */
export default function DashboardPage() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<AuthUser>('/users/me'),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api<DashboardStats>('/dashboard/stats'),
  });

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api<MyCourse[]>('/courses/mine'),
  });

  const tiles = [
    {
      icon: TrendingUp,
      label: 'Progression globale',
      value: stats ? `${stats.globalProgressPercent} %` : '—',
    },
    {
      icon: BookOpenCheck,
      label: 'Leçons terminées',
      value: stats ? `${stats.completedLessons}/${stats.totalLessons}` : '—',
    },
    {
      icon: Clock,
      label: "Temps d'étude",
      value: stats ? formatStudyTime(stats.studySeconds) : '—',
    },
    {
      icon: Flame,
      label: 'Jours d\'affilée',
      value: stats ? `${stats.streakDays}` : '—',
    },
  ];

  const earnedBadges = stats?.badges.filter((b) => b.earned) ?? [];

  return (
    <AppShell>
      {/* ── Bienvenue ── */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">
          {me ? `Bonjour ${me.firstName} 👋` : 'Bonjour 👋'}
        </h1>
        <p className="mt-1 text-muted">Reprenez votre progression là où vous l&apos;avez laissée.</p>
      </div>

      {/* ── Reprendre en 1 clic ── */}
      {statsLoading && <Skeleton className="mb-8 h-40 w-full rounded-card" />}
      {stats?.continueCourse && !stats.continueCourse.isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="mb-8 overflow-hidden">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center md:p-8">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gold">
                  Continuer la formation
                </p>
                <h2 className="mt-2 truncate font-display text-xl font-bold">
                  {stats.continueCourse.title}
                </h2>
                {stats.continueCourse.nextLessonTitle && (
                  <p className="mt-1 truncate text-sm text-muted">
                    Prochaine leçon : {stats.continueCourse.nextLessonTitle}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={stats.continueCourse.progressPercent} className="max-w-56" />
                  <span className="shrink-0 text-sm font-semibold text-gold">
                    {stats.continueCourse.progressPercent} %
                  </span>
                </div>
              </div>
              <Link href={`/formation/${stats.continueCourse.slug}`} className="shrink-0">
                <Button size="lg">
                  <Play size={18} />
                  Reprendre
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Tuiles de statistiques ── */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {/* ── Badges ── */}
      {earnedBadges.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Medal className="text-gold" size={18} />
          {earnedBadges.map((b) => (
            <Badge key={b.id} tone="gold">
              {b.label}
            </Badge>
          ))}
        </div>
      )}

      {/* ── Mes formations ── */}
      <h2 className="mb-4 font-display text-lg font-bold">Mes formations</h2>

      {coursesLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      )}

      {courses && courses.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">Aucune formation pour le moment</p>
          <p className="mt-2 text-sm text-muted">
            Vos formations apparaîtront ici automatiquement après votre achat.
          </p>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses?.map((course, i) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Link href={`/formation/${course.slug}`}>
              <Card hoverable className="group overflow-hidden">
                <div className="aspect-video bg-soft">
                  {course.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={course.coverUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Flame className="text-gold" size={40} />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{course.title}</h3>
                    {course.progressPercent === 100 ? (
                      <Badge tone="success">Terminée</Badge>
                    ) : course.progressPercent > 0 ? (
                      <Badge tone="gold">En cours</Badge>
                    ) : (
                      <Badge tone="info">Nouvelle</Badge>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-muted">
                      <span>
                        {course.completedLessons}/{course.totalLessons} leçons
                      </span>
                      <span>{course.progressPercent} %</span>
                    </div>
                    <ProgressBar value={course.progressPercent} />
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Certificats ── */}
      {stats && stats.certificatesCount > 0 && (
        <div className="mt-10">
          <Link
            href="/certificats"
            className="inline-flex items-center gap-2 text-sm font-medium text-gold hover:underline"
          >
            <Award size={16} />
            Voir mes {stats.certificatesCount} certificat{stats.certificatesCount > 1 ? 's' : ''}
          </Link>
        </div>
      )}
    </AppShell>
  );
}
