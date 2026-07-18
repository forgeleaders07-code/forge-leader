/**
 * Vérification des statistiques du dashboard apprenant
 * (exécution : node test/e2e-dashboard.mjs).
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

console.log('— 1. Accès');
const login = await req('/auth/login', {
  method: 'POST',
  body: { email: 'apprenant@laforgedesleaders.test', password: 'Apprenant123' },
});
const learner = login.json?.accessToken;
check('apprenant connecté', !!learner);

const anon = await req('/dashboard/stats');
check('stats sans token → 401', anon.status === 401, `(statut ${anon.status})`);

console.log('— 2. Cohérence des statistiques');
const stats = await req('/dashboard/stats', { token: learner });
check('stats récupérées', stats.status === 200);
const s = stats.json;

check(
  'progression globale cohérente avec leçons',
  s.totalLessons > 0 &&
    s.globalProgressPercent === Math.round((s.completedLessons / s.totalLessons) * 100),
  `(${s.completedLessons}/${s.totalLessons} → ${s.globalProgressPercent}%)`,
);
check('leçons complétées ≥ 1 (données existantes)', s.completedLessons >= 1);
check('temps d\'étude ≥ 0', typeof s.studySeconds === 'number' && s.studySeconds >= 0);
check(
  'streak ≥ 1 (activité aujourd\'hui via tests précédents)',
  typeof s.streakDays === 'number' && s.streakDays >= 1,
  `(streak=${s.streakDays})`,
);
check('certificats comptés', s.certificatesCount >= 1);
check('badges présents et typés', Array.isArray(s.badges) && s.badges.length >= 4);

const firstLesson = s.badges.find((b) => b.id === 'first-lesson');
const firstCert = s.badges.find((b) => b.id === 'first-certificate');
check('badge « première leçon » gagné', firstLesson?.earned === true);
check('badge « première certification » gagné', firstCert?.earned === true);

console.log('— 3. Reprise en 1 clic');
check(
  'formation à reprendre renvoyée',
  s.continueCourse === null || (!!s.continueCourse.slug && !!s.continueCourse.title),
);
if (s.continueCourse && !s.continueCourse.isCompleted) {
  check('prochaine leçon indiquée', !!s.continueCourse.nextLessonTitle);
} else {
  check('formation à reprendre complétée ou absente (cohérent)', true);
}

console.log('— 4. Vue admin (aucune formation apprenant)');
const adminLogin = await req('/auth/login', {
  method: 'POST',
  body: { email: 'admin@laforgedesleaders.test', password: 'Admin12345!' },
});
const adminStats = await req('/dashboard/stats', { token: adminLogin.json?.accessToken });
check(
  'stats vides sans enrollment (pas d\'erreur)',
  adminStats.status === 200 && adminStats.json?.totalLessons === 0,
);

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
