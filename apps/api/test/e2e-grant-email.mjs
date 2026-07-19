/**
 * Vérifie que l'attribution manuelle d'accès envoie l'email d'activation
 * pour un nouveau compte (correctif du 2026-07-19).
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

const course = (await req('/admin/courses', { token: admin })).json.find((c) => c.status === 'PUBLISHED')
  ?? (await req('/admin/courses', { token: admin })).json[0];

const email = `nouveau-${Date.now()}@laforgedesleaders.test`;

console.log('— Nouveau membre : email d\'activation attendu');
const grant = await req('/admin/enrollments/grant', {
  method: 'POST',
  token: admin,
  body: { email, firstName: 'Nouveau', lastName: 'Membre', courseId: course.id },
});
check('attribution réussie', grant.status === 201);
check('email d\'activation envoyé', grant.json?.emailSent === 'activation', `(${grant.json?.emailSent})`);

// Le compte doit être PENDING_ACTIVATION avec un token d'activation valide
const users = await req(`/admin/users?query=${encodeURIComponent('Nouveau')}`, { token: admin });
const created = users.json?.find((u) => u.email === email);
check('compte créé en attente d\'activation', created?.status === 'PENDING_ACTIVATION');

console.log('— Nouvel accès sur compte existant : email de notification');
const second = await req('/admin/courses', { token: admin });
const otherCourse = second.json.find((c) => c.id !== course.id && (c.status === 'PUBLISHED' || c.status === 'DRAFT'));
if (otherCourse) {
  const grant2 = await req('/admin/enrollments/grant', {
    method: 'POST',
    token: admin,
    body: { email, courseId: otherCourse.id },
  });
  check('2e accès → email course-added', grant2.json?.emailSent === 'course-added', `(${grant2.json?.emailSent})`);
} else {
  check('2e accès (ignoré : pas d\'autre formation)', true);
}

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
