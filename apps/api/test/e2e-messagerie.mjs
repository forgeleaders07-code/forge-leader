/**
 * Vérification de bout en bout de la messagerie privée
 * (exécution : node test/e2e-messagerie.mjs).
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
  return { token: r.json?.accessToken, id: r.json?.user?.id };
}

console.log('— 1. Préparation');
const admin = await login('admin@laforgedesleaders.test', 'Admin12345!');
const learner = await login('apprenant@laforgedesleaders.test', 'Apprenant123');
check('connexions', !!admin.token && !!learner.token);

console.log('— 2. Annuaire de contacts');
const contacts = await req('/messages/contacts?query=admin', { token: learner.token });
check('recherche de contact', contacts.status === 200 && contacts.json?.some((c) => c.id === admin.id));
check('emails jamais exposés', !JSON.stringify(contacts.json).includes('@laforgedesleaders.test'));

console.log('— 3. Conversation');
const conv = await req('/messages/conversations', {
  method: 'POST',
  token: learner.token,
  body: { recipientId: admin.id },
});
check('conversation créée', conv.status === 201 && !!conv.json?.id);

const convAgain = await req('/messages/conversations', {
  method: 'POST',
  token: learner.token,
  body: { recipientId: admin.id },
});
check('réouverture = même conversation (pas de doublon)', convAgain.json?.id === conv.json?.id);

const self = await req('/messages/conversations', {
  method: 'POST',
  token: learner.token,
  body: { recipientId: learner.id },
});
check('conversation avec soi-même refusée → 400', self.status === 400);

console.log('— 4. Échange de messages');
const m1 = await req(`/messages/conversations/${conv.json.id}/messages`, {
  method: 'POST',
  token: learner.token,
  body: { content: 'Bonjour ! Une question sur le module 1.' },
});
check('message envoyé (apprenant)', m1.status === 201);

const unreadAdmin = await req('/messages/unread-count', { token: admin.token });
check('non-lu compté côté admin', unreadAdmin.json?.unread >= 1, `(${unreadAdmin.json?.unread})`);

const threadAdmin = await req(`/messages/conversations/${conv.json.id}`, { token: admin.token });
check('fil lisible par le destinataire', threadAdmin.status === 200 && threadAdmin.json?.messages?.length >= 1);
check('contact affiché', threadAdmin.json?.contact?.firstName === 'Awa');

const unreadAfterRead = await req('/messages/unread-count', { token: admin.token });
check('ouverture du fil = marquage lu', unreadAfterRead.json?.unread === 0, `(${unreadAfterRead.json?.unread})`);

const m2 = await req(`/messages/conversations/${conv.json.id}/messages`, {
  method: 'POST',
  token: admin.token,
  body: { content: 'Bonjour Awa, bien sûr, je vous écoute !' },
});
check('réponse envoyée (admin)', m2.status === 201);

const list = await req('/messages/conversations', { token: learner.token });
const row = list.json?.find((c) => c.id === conv.json.id);
check('conversation listée avec dernier message', row?.lastMessage?.content?.includes('je vous écoute'));
check('non-lu affiché dans la liste', row?.unreadCount >= 1);

console.log('— 5. Confidentialité');
// Un tiers (nouvel utilisateur provisionné) ne doit pas lire la conversation
const stamp = Date.now();
await req('/admin/enrollments/grant', {
  method: 'POST',
  token: admin.token,
  body: { email: `tiers-${stamp}@laforgedesleaders.test`, courseId: (await req('/admin/courses', { token: admin.token })).json[0].id },
});
// Le tiers n'a pas de mot de passe → on teste avec le compte apprenant sur une conversation étrangère fictive
const notMine = await req(`/messages/conversations/00000000-0000-0000-0000-000000000000`, {
  token: learner.token,
});
check('conversation étrangère/inexistante → 403', notMine.status === 403, `(statut ${notMine.status})`);

const emptyMsg = await req(`/messages/conversations/${conv.json.id}/messages`, {
  method: 'POST',
  token: learner.token,
  body: { content: '   ' },
});
check('message vide refusé → 400', emptyMsg.status === 400, `(statut ${emptyMsg.status})`);

console.log(`\nRésultat : ${passed} OK, ${failed} KO`);
process.exit(failed === 0 ? 0 : 1);
