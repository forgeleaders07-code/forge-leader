/**
 * Vérification de bout en bout de l'upload vidéo
 * (exécution : node test/e2e-video-upload.mjs).
 * Parcours : admin crée une leçon vidéo → demande une URL d'upload direct →
 * téléverse → l'encodage se termine → la durée est persistée.
 * (Adaptateur dev : simule Cloudflare sans compte ; le flux et les droits
 * exercés sont identiques.)
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

console.log('— 1. Préparation (admin + leçon vidéo vierge)');
const admin = await login('admin@laforgedesleaders.test', 'Admin12345!');
const learner = await login('apprenant@laforgedesleaders.test', 'Apprenant123');
check('connexions', !!admin && !!learner);

const course = await req('/admin/courses', {
  method: 'POST',
  token: admin,
  body: { title: `Upload Test ${Date.now()}` },
});
const mod = await req(`/admin/courses/${course.json?.id}/modules`, {
  method: 'POST',
  token: admin,
  body: { title: 'M1' },
});
const chap = await req(`/admin/modules/${mod.json?.id}/chapters`, {
  method: 'POST',
  token: admin,
  body: { title: 'C1' },
});
const lesson = await req(`/admin/chapters/${chap.json?.id}/lessons`, {
  method: 'POST',
  token: admin,
  body: { title: 'Leçon vidéo', type: 'VIDEO' },
});
check('leçon vidéo créée sans identifiant', lesson.status === 201 && !lesson.json?.streamVideoId);

const textLesson = await req(`/admin/chapters/${chap.json?.id}/lessons`, {
  method: 'POST',
  token: admin,
  body: { title: 'Leçon texte', type: 'TEXT' },
});

console.log("— 2. Demande d'URL d'upload direct");
const upload = await req(`/admin/lessons/${lesson.json?.id}/video-upload`, {
  method: 'POST',
  token: admin,
});
check('URL d\'upload délivrée', upload.status === 201 && !!upload.json?.uploadUrl);
check('identifiant vidéo attribué', !!upload.json?.videoId);

const uploadLearner = await req(`/admin/lessons/${lesson.json?.id}/video-upload`, {
  method: 'POST',
  token: learner,
});
check('apprenant refusé → 403', uploadLearner.status === 403, `(statut ${uploadLearner.status})`);

const uploadText = await req(`/admin/lessons/${textLesson.json?.id}/video-upload`, {
  method: 'POST',
  token: admin,
});
check('leçon non-vidéo refusée → 400', uploadText.status === 400, `(statut ${uploadText.status})`);

console.log('— 3. Téléversement du fichier (navigateur → fournisseur)');
const form = new FormData();
form.append('file', new Blob([new Uint8Array(1024 * 64)]), 'video-test.mp4');
const sent = await fetch(upload.json.uploadUrl, { method: 'POST', body: form });
check('fichier accepté par l\'URL d\'upload', sent.ok, `(statut ${sent.status})`);

console.log("— 4. Statut d'encodage et persistance de la durée");
const status = await req(`/admin/lessons/${lesson.json?.id}/video-status`, { token: admin });
check('vidéo prête', status.status === 200 && status.json?.ready === true);
check('durée renvoyée', typeof status.json?.durationSeconds === 'number');

const detail = await req(`/admin/courses/${course.json?.id}`, { token: admin });
const savedLesson = detail.json?.modules?.[0]?.chapters?.[0]?.lessons?.find(
  (l) => l.id === lesson.json?.id,
);
check('streamVideoId persisté sur la leçon', savedLesson?.streamVideoId === upload.json?.videoId);
check('durée persistée sur la leçon', savedLesson?.durationSeconds === status.json?.durationSeconds);

console.log('— 5. Nettoyage');
const archive = await req(`/admin/courses/${course.json?.id}`, { method: 'DELETE', token: admin });
check('archivage', archive.status === 200);

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
