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

  return (
    <AppShell>
      <div className="mb-10">
        <h1 className="text-2xl font-bold">
          {me ? `Bonjour ${me.firstName} 👋` : 'Bonjour 👋'}
        </h1>
        <p className="mt-1 text-forge-300">Reprenez votre progression là où vous l&apos;avez laissée.</p>
      </div>

      {isLoading && <p className="text-forge-300">Chargement de vos formations…</p>}

      {courses && courses.length === 0 && (
        <div className="rounded-2xl border border-forge-700 bg-forge-900 p-10 text-center">
          <p className="text-lg font-medium">Aucune formation pour le moment</p>
          <p className="mt-2 text-sm text-forge-300">
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
              className="group block overflow-hidden rounded-2xl border border-forge-700 bg-forge-900 transition hover:border-ember-600"
            >
              <div className="aspect-video bg-forge-800">
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
                  <div className="mb-1 flex justify-between text-xs text-forge-300">
                    <span>
                      {course.completedLessons}/{course.totalLessons} leçons
                    </span>
                    <span>{course.progressPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-forge-700">
                    <div
                      className="h-full rounded-full bg-ember-500 transition-all"
                      style={{ width: `${course.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}
