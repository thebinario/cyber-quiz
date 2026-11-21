test('legítimo: administrador com a senha correta entra', () => {
  const { login } = load();
  const r = login('admin', 'S3nh@-Forte!');
  assert.equal(r.ok, true);
  assert.equal(r.user && r.user.username, 'admin');
});

test('senha errada não entra', () => {
  const { login } = load();
  assert.equal(login('admin', 'errada').ok, false);
});

test("admin'-- com qualquer senha não autentica", () => {
  const { login } = load();
  assert.equal(login("admin'--", 'qualquer').ok, false);
});

test("' OR '1'='1 no campo de usuário não autentica", () => {
  const { login } = load();
  assert.equal(login("' OR '1'='1' --", 'x').ok, false);
});

test("' OR '1'='1 no campo de senha não autentica", () => {
  const { login } = load();
  assert.equal(login('admin', "' OR '1'='1").ok, false);
});

test("legítimo: usuário e senha com apóstrofo continuam funcionando", () => {
  const { login } = load();
  assert.equal(login("d'arc", 'jeanne').ok, true, "usuário d'arc");
  assert.equal(login('ana', "it's-ana-2024").ok, true, "senha com apóstrofo");
});

test('os valores vão como parâmetros (?), não dentro do texto SQL', () => {
  const { login, db } = load();
  login("admin'--", 'x');
  const last = db.log[db.log.length - 1];
  assert.ok(last, 'nenhuma consulta foi enviada ao banco');
  assert.ok(last.sql.indexOf('admin') === -1, 'o SQL contém a entrada do usuário; use placeholders (?)');
  assert.ok(last.params.length >= 2, 'envie usuário e senha como parâmetros: db.query(sql, [..])');
});
