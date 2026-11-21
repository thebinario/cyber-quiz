function login(userId) {
  const sid = randomToken();
  SESSIONS[sid] = { userId };
  return sid; // enviado ao navegador no cookie "sid"
}

// GET /settings/email: devolve o necessário para montar o formulário
function renderEmailForm(sid) {
  if (!SESSIONS[sid]) return { status: 401 };
  return { status: 200 };
}

// POST /settings/email: body = { csrfToken, newEmail }
function changeEmail(sid, body) {
  const session = SESSIONS[sid];
  if (!session) return { status: 401 };
  USERS[session.userId].email = body.newEmail;
  return { status: 200 };
}
