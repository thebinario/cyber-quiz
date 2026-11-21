// Cabeçalho Set-Cookie enviado após o login
function sessionCookie(sid) {
  return 'sid=' + sid + '; Path=/; HttpOnly; Secure; SameSite=Lax';
}

// Origem da requisição: Origin, ou a origem do Referer como alternativa.
function requestOrigin(headers) {
  if (headers.origin) return headers.origin;
  if (headers.referer) {
    try { return new URL(headers.referer).origin; } catch (e) { return null; }
  }
  return null;
}

// POST /transfer — request = { method, headers, body, sid }
function transfer(request) {
  if (request.method !== 'POST') return { status: 405 };
  if (requestOrigin(request.headers || {}) !== ALLOWED_ORIGIN) return { status: 403 };

  const session = SESSIONS[request.sid];
  if (!session) return { status: 401 };

  const { to, amount } = request.body;
  ACCOUNTS[session.userId].balance -= amount;
  ACCOUNTS[to].balance += amount;
  return { status: 200 };
}
