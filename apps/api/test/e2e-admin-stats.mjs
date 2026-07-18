/**
 * Vérification des statistiques formateur/admin
 * (exécution : node test/e2e-admin-stats.mjs).
 */

const API = 'http://localhost:3001/api/v1';

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

async function req(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await req('/auth/login', { method: 'POST', body: { email, password } });
  return r.json?.accessToken;
}

console.log('— 1. Accès');
const admin = await login('admin@laforgedesleaders.test', 'Admin12345!');
const learner = await login('apprenant@laforgedesleaders.test', 'Apprenant123');
check('connexions', !!admin && !!learner);

const forbidden = await req('/admin/stats', { token: learner });
check('apprenant → 403', forbidden.status === 403, `(statut ${forbidden.status})`);

console.log('— 2. Statistiques admin');
const stats = await req('/admin/stats', { token: admin });
check('stats récupérées', stats.status === 200);
const s = stats.json;

check('totaux présents', s.totals && typeof s.totals.students === 'number');
check('au moins 1 formation', s.totals.courses >= 1);
check('au moins 1 étudiant actif', s.totals.students >= 1);
check('table des formations remplie', Array.isArray(s.courses) && s.courses.length >= 1);

const demo = s.courses.find((c) => c.slug === 'leadership-fondations');
check('formation démo présente', !!demo);
check(
  'progression moyenne bornée 0-100',
  demo && demo.avgProgressPercent >= 0 && demo.avgProgressPercent <= 100,
  `(${demo?.avgProgressPercent})`,
);
check(
  'inscrits cohérents (≥ 1 sur la démo)',
  demo && demo.activeEnrollments >= 1,
  `(${demo?.activeEnrollments})`,
);
check(
  'certificats totaux ≥ certificats de la démo',
  s.totals.certificates >= (demo?.certificatesCount ?? 0),
);

console.log('— 3. Section plateforme (ADMIN uniquement)');
check('section plateforme présente pour admin', !!s.platform);
check('membres comptés', s.platform.totalUsers >= 3);
check('leçons vidéo comptées', typeof s.platform.videoLessons === 'number');
check('webhooks agrégés', typeof s.platform.webhooks?.processed === 'number');
check(
  'dernières inscriptions listées',
  Array.isArray(s.platform.recentEnrollments) && s.platform.recentEnrollments.length >= 1,
);

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
