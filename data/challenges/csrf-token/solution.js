function login(userId) {
  const sid = randomToken();
  SESSIONS[sid] = { userId, csrfToken: randomToken(16) };
  return sid; // enviado ao navegador no cookie "sid"
}

// GET /settings/email: devolve o necessário para montar o formulário
function renderEmailForm(sid) {
  const session = SESSIONS[sid];
  if (!session) return { status: 401 };
  return { status: 200, csrfToken: session.csrfToken };
}

// POST /settings/email: body = { csrfToken, newEmail }
function changeEmail(sid, body) {
  const session = SESSIONS[sid];
  if (!session) return { status: 401 };

  const valid = typeof body.csrfToken === 'string' && body.csrfToken === session.csrfToken;
  if (!valid) return { status: 403 };

  USERS[session.userId].email = body.newEmail;
  return { status: 200 };
}
