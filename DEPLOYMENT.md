# Mettre La Forge des Leaders en ligne — guide pas-à-pas

Objectif : donner à la plateforme une **vraie adresse Internet** (`https://…`)
accessible depuis n'importe quel téléphone, partout, en permanence. Après ça,
les liens d'activation fonctionneront pour tous vos apprenants.

## Vue d'ensemble

| Élément | Hébergeur | Coût |
|---|---|---|
| Site (frontend Next.js) | **Vercel** | Gratuit |
| API (backend NestJS) | **Railway** | Gratuit pour démarrer |
| Base de données | **Neon** (déjà en ligne ✅) | Gratuit |
| Code source | **GitHub** | Gratuit |

Ordre : **GitHub → Railway (API) → Vercel (site) → on relie les deux**.

---

## Étape 0 — Créer les comptes (gratuits)

1. **GitHub** : https://github.com/signup
2. **Railway** : https://railway.app → « Login with GitHub »
3. **Vercel** : https://vercel.com/signup → « Continue with GitHub »

Utiliser « se connecter avec GitHub » partout simplifie tout.

---

## Étape 1 — Envoyer le code sur GitHub

Le code est déjà prêt et versionné localement (git). Il faut le « pousser »
sur GitHub.

1. Sur GitHub, cliquez **New repository** :
   - Nom : `forge-des-leaders-lms`
   - **Private** (recommandé — votre code reste privé)
   - Ne cochez rien d'autre (pas de README), puis **Create repository**.
2. GitHub affiche une adresse type `https://github.com/VOTRE-COMPTE/forge-des-leaders-lms.git`.
3. Donnez-moi cette adresse : je pousse le code pour vous (une seule commande).
   *(Ou faites-le vous-même : les commandes sont affichées par GitHub sous
   « …or push an existing repository ».)*

---

## Étape 2 — Déployer l'API sur Railway

1. Sur Railway : **New Project → Deploy from GitHub repo →** choisissez
   `forge-des-leaders-lms`.
2. Railway lit automatiquement `railway.json` (déjà dans le projet) : il sait
   comment construire et démarrer l'API.
3. Onglet **Variables** → ajoutez les variables listées dans
   [`apps/api/.env.production.example`](apps/api/.env.production.example).
   **Recopiez les valeurs des secrets depuis votre fichier local
   `apps/api/.env`** (DATABASE_URL, DIRECT_URL, les deux JWT_*,
   SYSTEME_IO_WEBHOOK_SECRET, RESEND_API_KEY, MAIL_FROM).
   - `FRONTEND_URL` : laissez `https://forge-des-leaders.vercel.app`
     provisoirement — on l'ajustera à l'étape 4.
   - **Ne définissez PAS `PORT`** — Railway s'en charge.
4. Railway construit et démarre. Quand c'est vert, onglet **Settings → Networking
   → Generate Domain** : vous obtenez une adresse type
   `https://forge-des-leaders-lms-production.up.railway.app`.
   **Notez-la** : c'est l'URL de votre API.
5. Vérifiez : ouvrez `https://VOTRE-API.up.railway.app/api/v1/users/me` dans le
   navigateur → vous devez voir une erreur JSON `401` (normal, sans connexion).
   Si vous voyez ça, l'API tourne. 🎉

---

## Étape 3 — Déployer le site sur Vercel

1. Sur Vercel : **Add New → Project →** importez `forge-des-leaders-lms`.
2. **Réglage important** — *Root Directory* : cliquez **Edit** et choisissez
   **`apps/web`**. (Vercel détecte alors Next.js automatiquement.)
3. Section **Environment Variables** : ajoutez
   - `NEXT_PUBLIC_API_URL` = `https://VOTRE-API.up.railway.app/api/v1`
     (l'URL Railway de l'étape 2, **suivie de `/api/v1`**).
4. **Deploy**. Au bout de 1–2 min, Vercel donne une adresse type
   `https://forge-des-leaders-lms.vercel.app`. **C'est l'adresse de votre
   plateforme** — celle à partager avec vos apprenants.

---

## Étape 4 — Relier les deux (CORS) et vérifier

1. Retournez sur **Railway → Variables → `FRONTEND_URL`** et mettez l'adresse
   **exacte** donnée par Vercel (ex. `https://forge-des-leaders-lms.vercel.app`).
   Railway redéploie automatiquement.
   *(Astuce : vous pouvez mettre plusieurs adresses séparées par des virgules,
   utile si vous ajoutez un domaine personnalisé plus tard.)*
2. Ouvrez votre adresse Vercel, connectez-vous en admin, et refaites le test :
   **Accès & membres → attribuer un accès →** le lien d'activation commence
   désormais par `https://…vercel.app` : il fonctionnera sur le téléphone de
   n'importe quel apprenant. ✅
3. Mettez à jour le **webhook Systeme.io** pour pointer vers
   `https://VOTRE-API.up.railway.app/api/v1/webhooks/systeme-io`
   (secret = `SYSTEME_IO_WEBHOOK_SECRET`).

---

## Après la mise en ligne

- **Chaque `git push`** redéploie automatiquement le site et l'API. Je m'occupe
  des push quand on fait des évolutions.
- **Domaine personnalisé** (`app.laforgedesleaders.com`) : possible plus tard,
  côté Vercel, quand vous aurez un nom de domaine — il servira aussi à activer
  les vrais emails Resend.
- **Vidéo réelle** : renseignez les clés `CLOUDFLARE_*` dans Railway le jour où
  vous voulez héberger vos vraies vidéos.

## Variables d'environnement — récapitulatif

- **API (Railway)** : voir [`apps/api/.env.production.example`](apps/api/.env.production.example)
- **Site (Vercel)** : voir [`apps/web/.env.production.example`](apps/web/.env.production.example)
