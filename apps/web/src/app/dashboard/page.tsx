'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { api, AuthUser } from '@/lib/api';
import type { MyCourse } from '@/lib/types';

export default function DashboardPage() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<AuthUser>('/users/me'),
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api<MyCourse[]>('/courses/mine'),
  });

  const { data: certificates } = useQuery({
    queryKey: ['my-certificates'],
    queryFn: () =>
      api<{ code: string; courseTitle: string; issuedAt: string }[]>('/certificates/mine'),
  });

  return (
    <AppShell>
      <div className="mb-10">
        <h1 className="text-2xl font-bold">
          {me ? `Bonjour ${me.firstName} 👋` : 'Bonjour 👋'}
        </h1>
        <p className="mt-1 text-muted">Reprenez votre progression là où vous l&apos;avez laissée.</p>
      </div>

      {isLoading && <p className="text-muted">Chargement de vos formations…</p>}

      {courses && courses.length === 0 && (
        <div className="rounded-card border border-line bg-surface p-10 text-center">
          <p className="text-lg font-medium">Aucune formation pour le moment</p>
          <p className="mt-2 text-sm text-muted">
            Vos formations apparaîtront ici automatiquement après votre achat.
          </p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses?.map((course, i) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Link
              href={`/formation/${course.slug}`}
              className="group block overflow-hidden rounded-card border border-line bg-surface transition hover:border-gold"
            >
              <div className="aspect-video bg-soft">
                {course.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.coverUrl}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">🔥</div>
                )}
              </div>
              <div className="p-5">
                <h2 className="font-semibold leading-snug">{course.title}</h2>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>
                      {course.completedLessons}/{course.totalLessons} leçons
                    </span>
                    <span>{course.progressPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-gold transition-all"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {certificates && certificates.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold">🎓 Mes certificats</h2>
          <div className="space-y-2">
            {certificates.map((cert) => (
              <Link
                key={cert.code}
                href={`/certificat/${cert.code}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-3 text-sm transition hover:border-gold"
              >
                <span className="font-medium">{cert.courseTitle}</span>
                <span className="shrink-0 text-xs text-muted">
                  {new Date(cert.issuedAt).toLocaleDateString('fr-FR')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
