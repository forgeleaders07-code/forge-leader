/**
 * Vérification de bout en bout de l'espace formateur/admin
 * (exécution : node test/e2e-admin.mjs).
 * Parcours : admin crée une formation complète → la publie → attribue
 * l'accès à l'apprenant → l'apprenant la voit. + contrôles de sécurité.
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

console.log('— 1. Connexions');
const admin = await login('admin@laforgedesleaders.test', 'Admin12345!');
const learner = await login('apprenant@laforgedesleaders.test', 'Apprenant123');
check('admin connecté', !!admin);
check('apprenant connecté', !!learner);

console.log('— 2. Sécurité des routes admin');
const forbidden = await req('/admin/courses', { token: learner });
check('apprenant sur /admin → 403', forbidden.status === 403, `(statut ${forbidden.status})`);
const anon = await req('/admin/courses');
check('anonyme sur /admin → 401', anon.status === 401, `(statut ${anon.status})`);

console.log('— 3. Création de formation');
const created = await req('/admin/courses', {
  method: 'POST',
  token: admin,
  body: { title: `Prise de Parole en Public ${Date.now()}` },
});
check('formation créée en brouillon', created.status === 201 && created.json?.status === 'DRAFT');
const courseId = created.json?.id;
check('slug généré automatiquement', /^prise-de-parole-en-public/.test(created.json?.slug ?? ''));

console.log('— 4. Publication refusée sans contenu');
const badPublish = await req(`/admin/courses/${courseId}`, {
  method: 'PATCH',
  token: admin,
  body: { status: 'PUBLISHED' },
});
check('publier une formation vide → 409', badPublish.status === 409, `(statut ${badPublish.status})`);

console.log('— 5. Construction du contenu');
const mod1 = await req(`/admin/courses/${courseId}/modules`, {
  method: 'POST',
  token: admin,
  body: { title: 'Module A' },
});
const mod2 = await req(`/admin/courses/${courseId}/modules`, {
  method: 'POST',
  token: admin,
  body: { title: 'Module B' },
});
check('modules créés', mod1.status === 201 && mod2.status === 201);

const chap = await req(`/admin/modules/${mod1.json?.id}/chapters`, {
  method: 'POST',
  token: admin,
  body: { title: 'Chapitre 1' },
});
check('chapitre créé', chap.status === 201);

const lesson = await req(`/admin/chapters/${chap.json?.id}/lessons`, {
  method: 'POST',
  token: admin,
  body: { title: 'Introduction', type: 'VIDEO', streamVideoId: 'cf-video-test-001', durationSeconds: 600 },
});
check('leçon vidéo créée', lesson.status === 201);

const moved = await req(`/admin/modules/${mod2.json?.id}/move`, {
  method: 'PUT',
  token: admin,
  body: { direction: 'up' },
});
check('réordonnancement des modules', moved.json?.position === 1, `(position ${moved.json?.position})`);

console.log('— 6. Publication et visibilité apprenant');
const publish = await req(`/admin/courses/${courseId}`, {
  method: 'PATCH',
  token: admin,
  body: { status: 'PUBLISHED' },
});
check('publication réussie avec contenu', publish.status === 200 && publish.json?.status === 'PUBLISHED');

const grant = await req('/admin/enrollments/grant', {
  method: 'POST',
  token: admin,
  body: { email: 'apprenant@laforgedesleaders.test', courseId },
});
check('accès attribué manuellement', grant.status === 201 && grant.json?.wasNew === true);

const grantLearner = await req('/admin/enrollments/grant', {
  method: 'POST',
  token: learner,
  body: { email: 'x@y.test', courseId },
});
check('attribution par un apprenant → 403', grantLearner.status === 403);

const mine = await req('/courses/mine', { token: learner });
const found = mine.json?.find((c) => c.id === courseId);
check("l'apprenant voit la nouvelle formation", !!found);

console.log('— 7. Révocation');
const revoke = await req('/admin/enrollments/revoke', {
  method: 'POST',
  token: admin,
  body: { email: 'apprenant@laforgedesleaders.test', courseId },
});
check('révocation', revoke.status === 201);
const mine2 = await req('/courses/mine', { token: learner });
check("formation disparue après révocation", !mine2.json?.some((c) => c.id === courseId));

console.log('— 8. Nettoyage (archivage)');
const archive = await req(`/admin/courses/${courseId}`, { method: 'DELETE', token: admin });
check('archivage', archive.status === 200 && archive.json?.status === 'ARCHIVED');

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
