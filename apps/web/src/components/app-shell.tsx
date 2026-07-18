'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, GraduationCap, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, AuthUser, clearSession, hasSession, logout } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}

/**
 * Coquille des pages membres (Vol 2 §16-17, §30) :
 * sidebar permanente en desktop, navigation inférieure en mobile,
 * barre supérieure avec profil, thème et déconnexion.
 * (La garde de session côté client est de l'UX ; la sécurité est côté API.)
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
        <p className="text-muted">Chargement…</p>
      </main>
    );
  }

  const links: NavLink[] = [
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/communaute', label: 'Communauté', icon: Users },
    { href: '/certificats', label: 'Mes certificats', icon: Award },
    ...(me && me.role !== 'LEARNER'
      ? [{ href: '/admin/formations', label: 'Administration', icon: ShieldCheck }]
      : []),
  ];

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname.startsWith('/dashboard') || pathname.startsWith('/formation') : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar desktop/tablette ── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <GraduationCap className="text-gold" size={24} />
          <span className="font-display text-sm font-bold leading-tight">
            La Forge
            <br />
            <span className="text-gold">des Leaders</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition ${
                isActive(href)
                  ? 'bg-gold-soft text-gold'
                  : 'text-muted hover:bg-soft hover:text-ink'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <button
          onClick={onLogout}
          className="flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-soft hover:text-ink"
        >
          <LogOut size={18} />
          Se déconnecter
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── Barre supérieure ── */}
        <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
            <Link href="/dashboard" className="font-display text-base font-bold md:hidden">
              La Forge <span className="text-gold">des Leaders</span>
            </Link>
            <div className="hidden md:block" />
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {me && (
                <div className="flex items-center gap-2">
                  <Avatar name={`${me.firstName} ${me.lastName}`} size={32} />
                  <span className="hidden text-sm font-medium sm:block">{me.firstName}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-24 md:px-8 md:pb-8">
          {children}
        </main>
      </div>

      {/* ── Navigation inférieure mobile (Vol 2 §30) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface md:hidden">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
              isActive(href) ? 'text-gold' : 'text-muted'
            }`}
          >
            <Icon size={20} />
            {label.split(' ')[0] === 'Tableau' ? 'Accueil' : label.split(' ').pop()}
          </Link>
        ))}
        <button
          onClick={onLogout}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted"
        >
          <LogOut size={20} />
          Quitter
        </button>
      </nav>
    </div>
  );
}
