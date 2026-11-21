// Cabeçalho Set-Cookie enviado após o login
function sessionCookie(sid) {
  return 'sid=' + sid + '; Path=/';
}

// POST /transfer — request = { method, headers, body, sid }
function transfer(request) {
  const session = SESSIONS[request.sid];
  if (!session) return { status: 401 };

  const { to, amount } = request.body;
  ACCOUNTS[session.userId].balance -= amount;
  ACCOUNTS[to].balance += amount;
  return { status: 200 };
}
