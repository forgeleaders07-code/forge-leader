# ADR 0001 — Socle technique initial

Date : 2026-07-17 · Statut : accepté

## Contexte

Le PRD v1.0 impose la stack (Next.js / NestJS / Prisma / PostgreSQL / Redis /
Cloudflare) et laisse deux choix ouverts : le fournisseur de streaming et le
fournisseur d'emails.

## Décisions

1. **Streaming : Cloudflare Stream** (validé par le product owner le 2026-07-17).
   Moins coûteux que Mux à l'échelle visée (100 000+ utilisateurs), intégration
   native avec R2 et le CDN Cloudflare déjà présents dans l'architecture.
   Une abstraction `VideoProvider` isole ce choix : basculer vers Mux ne
   toucherait qu'un adaptateur.

2. **Monorepo npm workspaces** plutôt que dépôts séparés : contrats partagés
   (`packages/shared`) typés de bout en bout, une seule CI, refactorings
   atomiques. Compatible avec des déploiements séparés (Vercel pour `apps/web`,
   Railway/Render pour `apps/api`).

3. **Monolithe modulaire NestJS** : un module par domaine (auth, users, courses,
   enrollments, video, webhooks, mail). Chaque module expose ses services via
   des interfaces ; les dépendances inter-modules passent par l'injection de
   dépendances, jamais par des imports directs de classes internes.

4. **Emails : abstraction `MailProvider`**, implémentation Resend par défaut
   (SES possible plus tard sans refonte).

5. **Idempotence des webhooks** : chaque événement Systeme.io est journalisé
   avec son identifiant externe unique ; un événement déjà traité est ignoré.
   Indispensable car Systeme.io rejoue les webhooks en cas de non-réponse.
