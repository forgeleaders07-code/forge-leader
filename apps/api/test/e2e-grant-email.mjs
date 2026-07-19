/**
 * Vérifie l'attribution manuelle d'accès (correctifs 2026-07-19) :
 * - renvoie un lien d'activation copiable pour les comptes sans mot de passe ;
 * - l'envoi d'email est NON bloquant (l'attribution réussit même si Resend
 *   refuse d'envoyer à une adresse non vérifiée).
 */

const API = 'http://localhost:3001/api/v1';

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name} ${detail}`); }
}

async function req(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const admin = (await req('/auth/login', {
  method: 'POST',
  body: { email: 'admin@laforgedesleaders.test', password: 'Admin12345!' },
})).json?.accessToken;
check('admin connecté', !!admin);

const courses = (await req('/admin/courses', { token: admin })).json;
const course = courses.find((c) => c.status === 'PUBLISHED') ?? courses[0];

console.log('— Nouveau membre (email non vérifié chez Resend)');
const email = `membre-${Date.now()}@exemple-test.com`;
const grant = await req('/admin/enrollments/grant', {
  method: 'POST',
  token: admin,
  body: { email, firstName: 'Nouveau', lastName: 'Membre', courseId: course.id },
});
check("attribution réussie MALGRÉ l'échec d'envoi email", grant.status === 201, `(statut ${grant.status})`);
check('needsActivation = true', grant.json?.needsActivation === true);
check('lien d\'activation renvoyé', typeof grant.json?.activationLink === 'string' && grant.json.activationLink.includes('/activation?userId='));
check(
  'envoi email marqué failed (Resend mode test) ou sent',
  grant.json?.emailStatus === 'failed' || grant.json?.emailStatus === 'sent',
  `(${grant.json?.emailStatus})`,
);

console.log('— Le lien d\'activation permet réellement de se connecter');
const url = new URL(grant.json.activationLink);
const userId = url.searchParams.get('userId');
const token = url.searchParams.get('token');
const activate = await req('/auth/activate', {
  method: 'POST',
  body: { userId, token, password: 'MonMotDePasse123' },
});
check('activation via le lien réussit', activate.status === 200 && !!activate.json?.accessToken);

const login = await req('/auth/login', {
  method: 'POST',
  body: { email, password: 'MonMotDePasse123' },
});
check('le membre peut ensuite se connecter', login.status === 200 && !!login.json?.accessToken);

console.log('— 2e formation sur un compte désormais actif : pas de lien');
const otherCourse = courses.find((c) => c.id !== course.id);
if (otherCourse) {
  const grant2 = await req('/admin/enrollments/grant', {
    method: 'POST',
    token: admin,
    body: { email, courseId: otherCourse.id },
  });
  check('compte actif → pas de lien d\'activation', grant2.json?.activationLink === null);
  check('compte actif → needsActivation false', grant2.json?.needsActivation === false);
} else {
  check('2e formation (ignoré : une seule formation)', true);
  check('2e formation (ignoré)', true);
}

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
