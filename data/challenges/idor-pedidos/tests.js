test('legítimo: Ana lê o próprio pedido (501)', () => {
  const { getOrder, USERS } = load();
  const r = getOrder(USERS.ana, 501);
  assert.equal(r.status, 200);
  assert.equal(r.body && r.body.id, 501);
});

test('Ana não lê o pedido de Bruno (601)', () => {
  const { getOrder, USERS } = load();
  const r = getOrder(USERS.ana, 601);
  assert.oneOf(r.status, [403, 404], 'status ao acessar pedido de outro cliente');
});

test('a resposta de acesso negado não vaza dados do pedido', () => {
  const { getOrder, USERS } = load();
  const r = getOrder(USERS.ana, 601);
  assert.ok(!r.body, 'o body deve vir vazio quando o acesso é negado');
});

test('o isolamento vale nos dois sentidos (Bruno x pedido da Ana)', () => {
  const { getOrder, USERS } = load();
  assert.oneOf(getOrder(USERS.bruno, 501).status, [403, 404], 'Bruno acessando o pedido 501');
  assert.equal(getOrder(USERS.bruno, 601).status, 200, 'Bruno acessando o próprio pedido');
});

test('o id vindo da URL como texto também é verificado', () => {
  const { getOrder, USERS } = load();
  assert.oneOf(getOrder(USERS.ana, '601').status, [403, 404], "orderId '601'");
});

test('legítimo: administrador lê qualquer pedido', () => {
  const { getOrder, USERS } = load();
  assert.equal(getOrder(USERS.admin, 601).status, 200);
  assert.equal(getOrder(USERS.admin, 501).status, 200);
});

test('pedido inexistente continua retornando 404', () => {
  const { getOrder, USERS } = load();
  assert.equal(getOrder(USERS.ana, 999).status, 404);
});
