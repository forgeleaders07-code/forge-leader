/**
 * Vérification de bout en bout du socle (exécution : node test/e2e-socle.mjs).
 * Rejoue le parcours du PRD §13 contre l'API locale + base Neon :
 * webhook d'achat → provisioning → auth → dashboard → vidéo → progression.
 */
import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const API = 'http://localhost:3001/api/v1';
const env = Object.fromEntries(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    }),
);

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✘ ${name} ${detail}`);
  }
}

async function req(path, { method = 'GET', body, token, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

console.log('— 1. Authentification (apprenant seedé)');
const login = await req('/auth/login', {
  method: 'POST',
  body: { email: 'apprenant@laforgedesleaders.test', password: 'Apprenant123' },
});
check('login réussit', login.status === 200, `(statut ${login.status})`);
check('access + refresh tokens présents', !!login.json?.accessToken && !!login.json?.refreshToken);
const { accessToken, refreshToken } = login.json ?? {};

const badLogin = await req('/auth/login', {
  method: 'POST',
  body: { email: 'apprenant@laforgedesleaders.test', password: 'mauvais-mdp' },
});
check('mauvais mot de passe → 401', badLogin.status === 401, `(statut ${badLogin.status})`);

console.log('— 2. Profil et dashboard');
const me = await req('/users/me', { token: accessToken });
check('GET /users/me', me.status === 200 && me.json?.email === 'apprenant@laforgedesleaders.test');

const mine = await req('/courses/mine', { token: accessToken });
check('GET /courses/mine contient la formation', mine.json?.[0]?.slug === 'leadership-fondations');

const noAuth = await req('/courses/mine');
check('sans token → 401', noAuth.status === 401, `(statut ${noAuth.status})`);

console.log('— 3. Formation et leçons');
const course = await req('/courses/leadership-fondations', { token: accessToken });
check('détail de la formation', course.status === 200 && course.json?.modules?.length > 0);
const lessons = course.json?.modules?.flatMap((m) => m.chapters.flatMap((c) => c.lessons)) ?? [];
const videoLesson = lessons.find((l) => l.type === 'VIDEO');
check('streamVideoId jamais exposé', lessons.every((l) => !('streamVideoId' in l)));

console.log('— 4. Lecture vidéo sécurisée');
const playback = await req(`/video/lessons/${videoLesson?.id}/playback`, {
  method: 'POST',
  token: accessToken,
});
check('grant de lecture délivré', playback.status === 201 && !!playback.json?.hlsUrl);

console.log('— 5. Progression');
const prog = await req(`/courses/lessons/${videoLesson?.id}/progress`, {
  method: 'PUT',
  token: accessToken,
  body: { positionSeconds: 120, completed: true },
});
check('sauvegarde de progression', prog.status === 200);
const mine2 = await req('/courses/mine', { token: accessToken });
check('progression reflétée au dashboard', (mine2.json?.[0]?.completedLessons ?? 0) >= 1);

console.log("— 6. Webhook Systeme.io (simulation d'achat)");
const email = `e2e-${Date.now()}@laforgedesleaders.test`;
const event = {
  id: `evt-e2e-${Date.now()}`,
  type: 'sale.completed',
  data: {
    customer: { email, first_name: 'Test', last_name: 'E2E' },
    product: { id: 'sio-prod-demo-001' },
  },
};
const sig = createHmac('sha256', env.SYSTEME_IO_WEBHOOK_SECRET)
  .update(JSON.stringify(event))
  .digest('hex');

const hook = await req('/webhooks/systeme-io', {
  method: 'POST',
  body: event,
  headers: { 'x-webhook-signature': sig },
});
check('achat traité (compte provisionné)', hook.json?.status === 'processed', JSON.stringify(hook.json));

const replay = await req('/webhooks/systeme-io', {
  method: 'POST',
  body: event,
  headers: { 'x-webhook-signature': sig },
});
check('rejeu du même événement → duplicate (idempotence)', replay.json?.status === 'duplicate');

const badSig = await req('/webhooks/systeme-io', {
  method: 'POST',
  body: event,
  headers: { 'x-webhook-signature': 'deadbeef'.repeat(8) },
});
check('signature invalide → 401', badSig.status === 401, `(statut ${badSig.status})`);

console.log('— 7. Rotation des refresh tokens');
const refresh1 = await req('/auth/refresh', { method: 'POST', body: { refreshToken } });
check('refresh délivre de nouveaux tokens', refresh1.status === 200 && !!refresh1.json?.refreshToken);
const reuse = await req('/auth/refresh', { method: 'POST', body: { refreshToken } });
check('réutilisation du token consommé → 401 (vol détecté)', reuse.status === 401, `(statut ${reuse.status})`);
const afterTheft = await req('/auth/refresh', {
  method: 'POST',
  body: { refreshToken: refresh1.json?.refreshToken },
});
check('famille entière révoquée après détection', afterTheft.status === 401, `(statut ${afterTheft.status})`);

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
