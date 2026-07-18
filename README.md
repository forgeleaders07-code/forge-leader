# La Forge des Leaders LMS

Campus numérique privé d'hébergement et de diffusion de formations en ligne.
**Ce n'est pas un site de vente** : les ventes ont lieu sur des plateformes externes
(Systeme.io, WhatsApp, Mobile Money…) ; la plateforme provisionne automatiquement
les comptes et les accès après achat via webhook.

## Architecture

Monorepo (npm workspaces) — monolithe modulaire, Clean Architecture / DDD.

```
apps/
  api/          Backend NestJS + Prisma (PostgreSQL) + Redis
  web/          Frontend Next.js (App Router) + Tailwind + TanStack Query
packages/
  shared/       Types et contrats partagés (DTO, enums, schémas zod)
docs/           Documentation d'architecture et décisions (ADR)
```

| Couche | Choix |
|---|---|
| Frontend | Next.js, React, TypeScript, TailwindCSS, Framer Motion, TanStack Query |
| Backend | NestJS, Prisma ORM |
| Base de données | PostgreSQL (Neon en production) |
| Cache | Redis |
| Vidéo | **Cloudflare Stream** (URLs signées, anti-téléchargement) via abstraction `VideoProvider` |
| Stockage | Cloudflare R2 |
| Auth | JWT access + refresh rotation, Argon2, guards par rôle |
| Emails | Abstraction `MailProvider` (Resend par défaut) |

## Démarrage

```bash
npm install
cp apps/api/.env.example apps/api/.env   # puis renseigner les valeurs
npm run prisma:generate
npm run prisma:migrate
npm run dev:api     # API sur http://localhost:3001
npm run dev:web     # Web sur http://localhost:3000
```

## Principes non négociables

1. **Sécurité vidéo d'abord** — aucun lien de lecture n'est délivré sans vérification
   d'enrollment ; tokens de lecture signés à durée courte.
2. **Modularité** — chaque fonctionnalité est un module NestJS indépendant.
3. **Pas de quick and dirty** — code documenté, testable, évolutif (cible : 100 000+ utilisateurs).
