/**
 * Vérification de bout en bout de la communauté
 * (exécution : node test/e2e-communaute.mjs).
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
const anon = await req('/community/feed');
check('feed sans token → 401', anon.status === 401);

console.log('— 2. Publication');
const stamp = Date.now();
const post = await req('/community/posts', {
  method: 'POST',
  token: learner,
  body: { content: `Première victoire : leçon 1 terminée ! (${stamp})` },
});
check('publication créée', post.status === 201 && !!post.json?.id);
check('auteur renvoyé', post.json?.author?.firstName === 'Awa');

const empty = await req('/community/posts', { method: 'POST', token: learner, body: { content: '   ' } });
check('publication vide refusée → 400', empty.status === 400, `(statut ${empty.status})`);

const feed = await req('/community/feed', { token: learner });
check('publication visible dans le fil', feed.json?.posts?.some((p) => p.id === post.json.id));

console.log('— 3. Réactions (toggle)');
const r1 = await req(`/community/posts/${post.json.id}/reaction`, {
  method: 'PUT',
  token: admin,
  body: { type: 'CLAP' },
});
check('réaction posée', r1.json?.myReaction === 'CLAP');

const r2 = await req(`/community/posts/${post.json.id}/reaction`, {
  method: 'PUT',
  token: admin,
  body: { type: 'LOVE' },
});
check('changement de réaction (remplace)', r2.json?.myReaction === 'LOVE');

const feed2 = await req('/community/feed', { token: admin });
const p2 = feed2.json?.posts?.find((p) => p.id === post.json.id);
check('une seule réaction comptée', (p2?.reactionCounts?.LOVE ?? 0) === 1 && !p2?.reactionCounts?.CLAP);
check('myReaction correcte dans le fil', p2?.myReaction === 'LOVE');

const r3 = await req(`/community/posts/${post.json.id}/reaction`, {
  method: 'PUT',
  token: admin,
  body: { type: 'LOVE' },
});
check('re-cliquer retire la réaction', r3.json?.myReaction === null);

console.log('— 4. Commentaires');
const comment = await req(`/community/posts/${post.json.id}/comments`, {
  method: 'POST',
  token: admin,
  body: { content: 'Bravo Awa, continue comme ça ! 🔥' },
});
check('commentaire créé', comment.status === 201);

const comments = await req(`/community/posts/${post.json.id}/comments`, { token: learner });
check('commentaires listés', comments.json?.length >= 1);

const feed3 = await req('/community/feed', { token: learner });
const p3 = feed3.json?.posts?.find((p) => p.id === post.json.id);
check('compteur de commentaires à jour', p3?.commentCount >= 1);

console.log('— 5. Droits de suppression');
const delOther = await req(`/community/comments/${comment.json.id}`, {
  method: 'DELETE',
  token: learner,
});
check("suppression du commentaire d'autrui → 403", delOther.status === 403, `(statut ${delOther.status})`);

const delByAdmin = await req(`/community/posts/${post.json.id}`, { method: 'DELETE', token: admin });
check('admin peut supprimer toute publication', delByAdmin.status === 204, `(statut ${delByAdmin.status})`);

const feed4 = await req('/community/feed', { token: learner });
check('publication disparue du fil', !feed4.json?.posts?.some((p) => p.id === post.json.id));

console.log('— 6. Pagination');
for (let i = 0; i < 3; i++) {
  await req('/community/posts', {
    method: 'POST',
    token: admin,
    body: { content: `Post de pagination ${stamp}-${i}` },
  });
}
const page1 = await req('/community/feed?limit=2', { token: admin });
check('taille de page respectée', page1.json?.posts?.length === 2);
check('curseur fourni', !!page1.json?.nextCursor);
const page2 = await req(`/community/feed?limit=2&cursor=${page1.json.nextCursor}`, { token: admin });
check(
  'page suivante sans doublon',
  page2.json?.posts?.every((p) => !page1.json.posts.some((q) => q.id === p.id)),
);

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
