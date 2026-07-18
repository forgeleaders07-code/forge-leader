'use client';

import { motion } from 'framer-motion';
import { Flame, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, login } from '@/lib/api';

/**
 * Connexion premium split-screen (Vol 2 §12) :
 * à gauche l'inspiration, à droite l'action.
 * (OAuth Google/Microsoft prévus au PRD : activés quand le backend les portera.)
 */
export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      // Les formateurs/admins arrivent directement sur leur espace de travail
      router.replace(user.role === 'LEARNER' ? '/dashboard' : '/admin/formations');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Email ou mot de passe incorrect.'
          : 'Connexion impossible. Réessayez dans un instant.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* ── Panneau inspirant (desktop) ── */}
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#121212] p-12 text-white lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative flex items-center gap-2">
          <Flame className="text-gold" size={28} />
          <span className="font-display text-lg font-bold">
            La Forge <span className="text-gold">des Leaders</span>
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          <h1 className="font-display text-4xl font-bold leading-tight">
            Votre campus privé
            <br />
            <span className="text-gold">d&apos;excellence.</span>
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Des formations premium, une progression intelligente, et une communauté de leaders qui
            avancent ensemble.
          </p>

          <div className="mt-10 space-y-4 text-sm text-white/80">
            <p className="flex items-center gap-3">
              <ShieldCheck className="shrink-0 text-gold" size={18} />
              Contenus protégés et accès à vie à vos formations
            </p>
            <p className="flex items-center gap-3">
              <TrendingUp className="shrink-0 text-gold" size={18} />
              Progression suivie, quiz et certificats vérifiables
            </p>
            <p className="flex items-center gap-3">
              <Users className="shrink-0 text-gold" size={18} />
              Un accompagnement par des formateurs engagés
            </p>
          </div>
        </motion.div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} La Forge des Leaders — Campus privé
        </p>
      </section>

      {/* ── Formulaire ── */}
      <section className="flex flex-1 items-center justify-center bg-soft px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center lg:hidden">
            <p className="font-display text-2xl font-bold">
              La Forge <span className="text-gold">des Leaders</span>
            </p>
            <p className="mt-1 text-sm text-muted">Votre campus privé de formation</p>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-card border border-line bg-surface p-8 shadow-card"
          >
            <h2 className="mb-1 font-display text-xl font-semibold">Connexion</h2>
            <p className="mb-6 text-sm text-muted">Heureux de vous revoir.</p>

            <div className="space-y-4">
              <Input
                id="email"
                label="Adresse email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                id="password"
                label="Mot de passe"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-btn bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="mt-6 w-full" size="lg">
              {loading ? 'Connexion…' : 'Accéder à mon campus'}
            </Button>

            <p className="mt-6 text-center text-xs text-muted">
              Votre compte est créé automatiquement après votre achat.
              <br />
              Vérifiez l&apos;email reçu pour activer votre accès.
            </p>
          </form>
        </motion.div>
      </section>
    </main>
  );
}
