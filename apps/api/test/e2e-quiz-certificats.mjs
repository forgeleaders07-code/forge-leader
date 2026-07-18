/**
 * Vérification de bout en bout quiz + certificats
 * (exécution : node test/e2e-quiz-certificats.mjs).
 * Parcours PRD §13 complet : contenu → quiz → complétion → certificat →
 * vérification publique.
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

console.log('— 1. Préparation : formation avec 1 leçon texte + 1 quiz');
const admin = await login('admin@laforgedesleaders.test', 'Admin12345!');
const learner = await login('apprenant@laforgedesleaders.test', 'Apprenant123');
check('connexions', !!admin && !!learner);

const course = await req('/admin/courses', {
  method: 'POST',
  token: admin,
  body: { title: `Certif Test ${Date.now()}` },
});
const courseId = course.json?.id;
const mod = await req(`/admin/courses/${courseId}/modules`, {
  method: 'POST',
  token: admin,
  body: { title: 'M1' },
});
const chap = await req(`/admin/modules/${mod.json?.id}/chapters`, {
  method: 'POST',
  token: admin,
  body: { title: 'C1' },
});
const textLesson = await req(`/admin/chapters/${chap.json?.id}/lessons`, {
  method: 'POST',
  token: admin,
  body: { title: 'Leçon 1', type: 'TEXT', content: 'Contenu.' },
});
const quizLesson = await req(`/admin/chapters/${chap.json?.id}/lessons`, {
  method: 'POST',
  token: admin,
  body: { title: 'Quiz final', type: 'QUIZ' },
});
check('leçons créées', textLesson.status === 201 && quizLesson.status === 201);

console.log('— 2. Définition du quiz par l\'admin');
const badQuiz = await req(`/admin/lessons/${quizLesson.json?.id}/quiz`, {
  method: 'PUT',
  token: admin,
  body: {
    questions: [
      {
        text: 'Question sans bonne réponse ?',
        choices: [
          { text: 'A', isCorrect: false },
          { text: 'B', isCorrect: false },
        ],
      },
    ],
  },
});
check('quiz sans bonne réponse refusé → 400', badQuiz.status === 400, `(statut ${badQuiz.status})`);

const quizDef = await req(`/admin/lessons/${quizLesson.json?.id}/quiz`, {
  method: 'PUT',
  token: admin,
  body: {
    questions: [
      {
        text: 'Quel est le premier pilier du leadership ?',
        choices: [
          { text: 'La posture', isCorrect: true },
          { text: 'Le hasard', isCorrect: false },
          { text: 'La chance', isCorrect: false },
        ],
      },
      {
        text: 'Un leader doit…',
        choices: [
          { text: 'Fuir ses responsabilités', isCorrect: false },
          { text: 'Assumer ses décisions', isCorrect: true },
        ],
      },
    ],
  },
});
check('quiz défini (2 questions)', quizDef.status === 200 && quizDef.json?.questions?.length === 2);

await req('/admin/enrollments/grant', {
  method: 'POST',
  token: admin,
  body: { email: 'apprenant@laforgedesleaders.test', courseId },
});
await req(`/admin/courses/${courseId}`, {
  method: 'PATCH',
  token: admin,
  body: { status: 'PUBLISHED' },
});

console.log('— 3. Passage du quiz par l\'apprenant');
const quiz = await req(`/quiz/lessons/${quizLesson.json?.id}`, { token: learner });
check('quiz récupéré', quiz.status === 200 && quiz.json?.questions?.length === 2);
check(
  'les bonnes réponses ne fuient jamais',
  !JSON.stringify(quiz.json).includes('isCorrect'),
);

const [q1, q2] = quiz.json.questions;
const wrong = (q, i) => q.choices[i].id;

// Échec volontaire : 1 bonne réponse sur 2 = 50 % < 70 %
const fail1 = await req(`/quiz/lessons/${quizLesson.json?.id}/submit`, {
  method: 'POST',
  token: learner,
  body: {
    answers: [
      { questionId: q1.id, choiceId: q1.choices[0].id }, // ordre inconnu : on teste juste le mécanisme
      { questionId: q2.id, choiceId: q2.choices[0].id },
    ],
  },
});
check('soumission acceptée', fail1.status === 201 || fail1.status === 200);
check('pas de correction détaillée en cas d\'échec', fail1.json?.passed ? true : fail1.json?.corrections === undefined);

// Pour réussir à coup sûr : on demande la correction à l'admin (contexte de confiance)
const editorQuiz = await req(`/admin/lessons/${quizLesson.json?.id}/quiz`, { token: admin });
const goodAnswers = editorQuiz.json.questions.map((q) => ({
  questionId: q.id,
  choiceId: q.choices.find((c) => c.isCorrect).id,
}));

const pass = await req(`/quiz/lessons/${quizLesson.json?.id}/submit`, {
  method: 'POST',
  token: learner,
  body: { answers: goodAnswers },
});
check('quiz réussi à 100 %', pass.json?.passed === true && pass.json?.scorePercent === 100);
check('correction détaillée fournie après réussite', Array.isArray(pass.json?.corrections));

console.log('— 4. Certificat');
const early = await req('/certificates/claim', {
  method: 'POST',
  token: learner,
  body: { courseId },
});
check('certificat refusé avant 100 % → 409', early.status === 409, `(statut ${early.status})`);

await req(`/courses/lessons/${textLesson.json?.id}/progress`, {
  method: 'PUT',
  token: learner,
  body: { positionSeconds: 0, completed: true },
});

const claim = await req('/certificates/claim', {
  method: 'POST',
  token: learner,
  body: { courseId },
});
check('certificat délivré à 100 %', claim.status === 200 && /^FDL-\d{4}-/.test(claim.json?.code ?? ''));

const claim2 = await req('/certificates/claim', {
  method: 'POST',
  token: learner,
  body: { courseId },
});
check('claim idempotent (même code)', claim2.json?.code === claim.json?.code);

const mine = await req('/certificates/mine', { token: learner });
check('certificat listé dans « mes certificats »', mine.json?.some((c) => c.code === claim.json?.code));

console.log('— 5. Vérification publique (sans authentification)');
const verify = await req(`/certificates/verify/${claim.json?.code}`);
check('code valide reconnu', verify.status === 200 && verify.json?.valid === true);
check('nom et formation exposés', !!verify.json?.learnerName && !!verify.json?.courseTitle);

const verifyBad = await req('/certificates/verify/FDL-2026-INEXISTANT');
check('code inconnu → invalide', verifyBad.json?.valid === false);

console.log('— 6. Nettoyage');
const archive = await req(`/admin/courses/${courseId}`, { method: 'DELETE', token: admin });
check('archivage', archive.status === 200);

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
