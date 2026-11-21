const post = (headers) => ({
  method: 'POST',
  headers: headers,
  body: { to: 'bruno', amount: 100 },
  sid: 'sid-ana'
});

test('o cookie de sessão tem HttpOnly e Secure', () => {
  const { sessionCookie } = load();
  const cookie = sessionCookie('abc').toLowerCase();
  assert.ok(cookie.indexOf('httponly') !== -1, 'falta HttpOnly');
  assert.ok(cookie.indexOf('secure') !== -1, 'falta Secure');
});

test('o cookie de sessão tem SameSite=Lax ou SameSite=Strict', () => {
  const { sessionCookie } = load();
  const cookie = sessionCookie('abc').toLowerCase();
  assert.ok(/samesite=(lax|strict)/.test(cookie), 'falta SameSite=Lax/Strict');
});

test('legítimo: POST com Origin correto transfere o valor', () => {
  const { transfer, ACCOUNTS, ALLOWED_ORIGIN } = load();
  const r = transfer(post({ origin: ALLOWED_ORIGIN }));
  assert.equal(r.status, 200);
  assert.equal(ACCOUNTS.ana.balance, 900, 'saldo da Ana');
  assert.equal(ACCOUNTS.bruno.balance, 150, 'saldo do Bruno');
});

test('Origin de outro site é recusado e o saldo não muda', () => {
  const { transfer, ACCOUNTS } = load();
  const r = transfer(post({ origin: 'https://evil.example' }));
  assert.equal(r.status, 403);
  assert.equal(ACCOUNTS.ana.balance, 1000);
});

test('domínio que apenas começa igual não é a mesma origem', () => {
  const { transfer, ACCOUNTS } = load();
  const r = transfer(post({ origin: 'https://banco.exemplo.com.evil.com' }));
  assert.equal(r.status, 403);
  assert.equal(ACCOUNTS.ana.balance, 1000);
});

test('Origin "null" é recusado', () => {
  const { transfer, ACCOUNTS } = load();
  assert.equal(transfer(post({ origin: 'null' })).status, 403);
  assert.equal(ACCOUNTS.ana.balance, 1000);
});

test('sem Origin, usa o Referer: legítimo passa, de outro site não', () => {
  const { transfer, ACCOUNTS, ALLOWED_ORIGIN } = load();
  assert.equal(transfer(post({ referer: ALLOWED_ORIGIN + '/transferir' })).status, 200, 'Referer legítimo');
  assert.equal(ACCOUNTS.ana.balance, 900);
  assert.equal(transfer(post({ referer: 'https://banco.exemplo.com.evil.com/x' })).status, 403, 'Referer parecido');
  assert.equal(ACCOUNTS.ana.balance, 900, 'saldo não pode mudar na segunda tentativa');
});

test('sem Origin e sem Referer a requisição é recusada', () => {
  const { transfer, ACCOUNTS } = load();
  assert.equal(transfer(post({})).status, 403);
  assert.equal(ACCOUNTS.ana.balance, 1000);
});

test('só POST é aceito: GET devolve 405 e não move dinheiro', () => {
  const { transfer, ACCOUNTS, ALLOWED_ORIGIN } = load();
  const r = transfer({ method: 'GET', headers: { origin: ALLOWED_ORIGIN }, body: { to: 'bruno', amount: 100 }, sid: 'sid-ana' });
  assert.equal(r.status, 405);
  assert.equal(ACCOUNTS.ana.balance, 1000);
});
