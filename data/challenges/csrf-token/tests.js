test('legítimo: abrir o formulário e enviar com o token altera o e-mail', () => {
  const { login, renderEmailForm, changeEmail, USERS } = load();
  const sid = login('ana');
  const form = renderEmailForm(sid);
  assert.equal(form.status, 200);
  assert.equal(typeof form.csrfToken, 'string', 'renderEmailForm deve devolver csrfToken');
  const r = changeEmail(sid, { csrfToken: form.csrfToken, newEmail: 'novo@exemplo.com' });
  assert.equal(r.status, 200);
  assert.equal(USERS.ana.email, 'novo@exemplo.com');
});

test('sem token a troca é recusada (403) e o e-mail não muda', () => {
  const { login, changeEmail, USERS } = load();
  const sid = login('ana');
  const r = changeEmail(sid, { newEmail: 'atacante@evil.example' });
  assert.equal(r.status, 403);
  assert.equal(USERS.ana.email, 'ana@exemplo.com');
});

test('token errado é recusado', () => {
  const { login, renderEmailForm, changeEmail, USERS } = load();
  const sid = login('ana');
  renderEmailForm(sid);
  const r = changeEmail(sid, { csrfToken: 'token-qualquer', newEmail: 'atacante@evil.example' });
  assert.equal(r.status, 403);
  assert.equal(USERS.ana.email, 'ana@exemplo.com');
});

test('token ausente nunca "casa" (undefined, vazio ou null)', () => {
  const { login, changeEmail, USERS } = load();
  const sid = login('ana');
  [undefined, '', null].forEach((value) => {
    const r = changeEmail(sid, { csrfToken: value, newEmail: 'atacante@evil.example' });
    assert.equal(r.status, 403, 'csrfToken = ' + String(value));
  });
  assert.equal(USERS.ana.email, 'ana@exemplo.com');
});

test('o token de outra sessão não vale', () => {
  const { login, renderEmailForm, changeEmail, USERS } = load();
  const sidAna = login('ana');
  const sidBruno = login('bruno');
  const tokenBruno = renderEmailForm(sidBruno).csrfToken;
  const r = changeEmail(sidAna, { csrfToken: tokenBruno, newEmail: 'atacante@evil.example' });
  assert.equal(r.status, 403);
  assert.equal(USERS.ana.email, 'ana@exemplo.com');
});

test('o token é longo (>= 16 caracteres) e diferente em cada sessão', () => {
  const { login, renderEmailForm } = load();
  const a = renderEmailForm(login('ana')).csrfToken;
  const b = renderEmailForm(login('bruno')).csrfToken;
  assert.ok(typeof a === 'string' && a.length >= 16, 'token curto demais ou ausente');
  assert.notEqual(a, b, 'sessões diferentes devem ter tokens diferentes');
});

test('sessão inexistente retorna 401', () => {
  const { changeEmail, renderEmailForm } = load();
  assert.equal(renderEmailForm('nao-existe').status, 401, 'renderEmailForm');
  assert.equal(changeEmail('nao-existe', { csrfToken: 'x', newEmail: 'a@b.c' }).status, 401, 'changeEmail');
});
