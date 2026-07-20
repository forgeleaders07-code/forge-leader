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

## Étape 5 — Héberger les vidéos sur Cloudflare R2 (gratuit jusqu'à 10 Go)

Vos vidéos de formation seront stockées chez **Cloudflare R2** (un « disque dur
en ligne »), puis lues **directement dans la plateforme**, dans un lecteur
sécurisé. C'est gratuit jusqu'à 10 Go de vidéos. On le fait **une seule fois**.

> À la fin de cette étape vous aurez **4 valeurs** à me donner (ou à coller dans
> Railway) : `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
> `R2_BUCKET`. Gardez-les au chaud dans un bloc-notes au fur et à mesure.

### 5.1 — Créer un compte Cloudflare (gratuit)

1. Allez sur https://dash.cloudflare.com/sign-up et créez un compte (email +
   mot de passe). Confirmez votre email.
2. Une fois connecté, vous arrivez sur le **tableau de bord** Cloudflare.

### 5.2 — Activer R2

1. Dans le menu de gauche, cliquez sur **R2** (ou **R2 Object Storage**).
2. Cliquez **Purchase R2** / **Enable R2** / **Get started**. Rassurez-vous :
   le **palier gratuit (10 Go) ne coûte rien** et Cloudflare peut demander une
   carte uniquement par sécurité — vous ne serez pas débité tant que vous restez
   sous 10 Go.

### 5.3 — Créer le « bucket » (le dossier qui contiendra les vidéos)

1. Dans R2, cliquez **Create bucket** (Créer un bucket).
2. **Nom du bucket** : tapez `forge-videos` (tout en minuscules, sans espaces).
   → C'est votre **`R2_BUCKET`**. Notez-le.
3. Laissez la région sur **Automatic**. Cliquez **Create bucket**.
4. **Laissez ce bucket privé** (ne l'ouvrez PAS au public) : la plateforme
   fabrique elle-même des liens de lecture temporaires et sécurisés.

### 5.4 — Récupérer l'identifiant de compte (`R2_ACCOUNT_ID`)

1. Toujours dans la page **R2**, regardez à droite (ou en haut) : Cloudflare
   affiche **Account ID** — une suite de lettres et chiffres.
2. Cliquez dessus pour le copier. → C'est votre **`R2_ACCOUNT_ID`**. Notez-le.
   *(C'est aussi le début de l'adresse technique
   `https://VOTRE_ACCOUNT_ID.r2.cloudflarestorage.com` — vous n'avez rien à
   faire de cette adresse, la plateforme la reconstruit toute seule.)*

### 5.5 — Créer les identifiants d'accès (`R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`)

Ce sont les « clés » qui autorisent la plateforme à déposer et lire vos vidéos.

1. Dans la page **R2**, cliquez sur **Manage R2 API Tokens** (Gérer les jetons
   API R2) — en haut à droite, ou dans **… / Settings**.
2. Cliquez **Create API token** (Créer un jeton API).
3. Réglages :
   - **Nom** : `forge-lms` (ce que vous voulez).
   - **Permissions** : choisissez **Object Read & Write** (Lecture et écriture
     des objets).
   - **Bucket** : vous pouvez restreindre à **`forge-videos`** (recommandé), ou
     laisser « tous les buckets ».
   - Laissez le reste par défaut, puis **Create API Token**.
4. Cloudflare affiche alors **deux valeurs** — **copiez-les tout de suite**,
   elles ne seront **plus jamais réaffichées** :
   - **Access Key ID** → c'est votre **`R2_ACCESS_KEY_ID`**.
   - **Secret Access Key** → c'est votre **`R2_SECRET_ACCESS_KEY`**.

   ⚠️ Si vous fermez la page sans copier la clé secrète, pas de panique :
   supprimez le jeton et refaites l'étape 5.5.

### 5.6 — Autoriser votre site à envoyer les vidéos (CORS)

Cette étape autorise **votre site** à déposer des vidéos dans le bucket depuis
le navigateur. Sans elle, le téléversement admin serait bloqué.

1. Ouvrez votre bucket **`forge-videos`** → onglet **Settings** (Réglages).
2. Trouvez la section **CORS Policy** (Politique CORS) → **Edit** / **Add**.
3. Collez ceci (remplacez l'adresse par **votre** adresse Vercel exacte de
   l'étape 3 ; vous pouvez en mettre plusieurs) :

   ```json
   [
     {
       "AllowedOrigins": ["https://forge-des-leaders-lms.vercel.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. **Enregistrez**. (Si vous ajoutez un domaine personnalisé plus tard, revenez
   ici ajouter son adresse dans `AllowedOrigins`.)

### 5.7 — Me donner les 4 valeurs (ou les coller dans Railway)

Vous avez maintenant vos 4 valeurs. Deux options :
- **Le plus simple** : envoyez-les-moi, je les mets en place pour vous.
- **Vous-même dans Railway** : onglet **Variables** → ajoutez ces 4 lignes :

  | Variable | Valeur |
  |---|---|
  | `R2_ACCOUNT_ID` | (étape 5.4) |
  | `R2_ACCESS_KEY_ID` | (étape 5.5) |
  | `R2_SECRET_ACCESS_KEY` | (étape 5.5) |
  | `R2_BUCKET` | `forge-videos` |

  Railway redéploie tout seul. Dès que ces 4 variables sont présentes, la
  plateforme **bascule automatiquement sur R2** (priorité sur Cloudflare Stream
  et sur le mode démo). Vous pouvez alors **téléverser une vidéo** depuis
  l'espace admin d'une leçon, et elle se lira dans le lecteur sécurisé.

> Astuce : la durée de validité d'un lien de lecture est réglable via
> `VIDEO_PLAYBACK_TOKEN_TTL` (en secondes, défaut `3600` = 1 h). Inutile d'y
> toucher pour démarrer.

---

## Après la mise en ligne

- **Chaque `git push`** redéploie automatiquement le site et l'API. Je m'occupe
  des push quand on fait des évolutions.
- **Domaine personnalisé** (`app.laforgedesleaders.com`) : possible plus tard,
  côté Vercel, quand vous aurez un nom de domaine — il servira aussi à activer
  les vrais emails Resend.
- **Vidéo réelle** : suivez l'**Étape 5** ci-dessus (Cloudflare R2). Le jour où
  vos vidéos dépassent 10 Go, R2 reste très bon marché (quelques centimes par Go)
  et rien d'autre ne change côté plateforme.

## Variables d'environnement — récapitulatif

- **API (Railway)** : voir [`apps/api/.env.production.example`](apps/api/.env.production.example)
- **Site (Vercel)** : voir [`apps/web/.env.production.example`](apps/web/.env.production.example)
