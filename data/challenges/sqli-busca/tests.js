test('legítimo: busca por parte do nome', () => {
  const { searchProducts } = load();
  const r = searchProducts('monitor');
  assert.equal(r.status, 200);
  assert.equal(r.rows.length, 2, 'produtos com "monitor"');
});

test("legítimo: busca com apóstrofo (d'água) funciona", () => {
  const { searchProducts } = load();
  const r = searchProducts("d'água");
  assert.equal(r.status, 200);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].name, "Garrafa d'água");
});

test('legítimo: termo vazio lista todos os produtos', () => {
  const { searchProducts } = load();
  assert.equal(searchProducts('').rows.length, 6);
});

test('legítimo: ordena por price e, sem sort, por name', () => {
  const { searchProducts } = load();
  const prices = searchProducts('', 'price').rows.map((r) => r.price);
  assert.equal(prices.length, 6, 'quantidade de produtos ao ordenar por price');
  assert.equal(JSON.stringify(prices), JSON.stringify(prices.slice().sort((a, b) => a - b)), 'ordem por price');
  const names = searchProducts('').rows.map((r) => r.name);
  assert.equal(names.length, 6, 'quantidade de produtos na ordenação padrão');
  assert.equal(JSON.stringify(names), JSON.stringify(names.slice().sort((a, b) => a.localeCompare(b))), 'ordem padrão por name');
});

test('UNION SELECT não vaza a tabela de usuários', () => {
  const { searchProducts } = load();
  let rows = [];
  try {
    rows = searchProducts("' UNION SELECT username, password_hash FROM users --").rows;
  } catch (e) { rows = []; }
  assert.ok(rows.every((r) => r.name !== 'admin' && r.name !== 'ana'), 'dados de users apareceram no resultado');
});

test("' OR '1'='1 e ' OR 1=1 -- não devolvem todos os produtos", () => {
  const { searchProducts } = load();
  assert.equal(searchProducts("' OR '1'='1").rows.length, 0, "payload ' OR '1'='1");
  assert.equal(searchProducts("' OR 1=1 --").rows.length, 0, "payload ' OR 1=1 --");
});

test('sort fora da allowlist devolve 400 sem consultar o banco', () => {
  const { searchProducts, db } = load();
  ['nope', 'price; DROP TABLE products', '(SELECT 1)', 'price DESC, name'].forEach((sort) => {
    const before = db.log.length;
    const r = searchProducts('', sort);
    assert.equal(r.status, 400, 'sort = ' + sort);
    assert.equal(db.log.length, before, 'o banco não deveria ser consultado com sort = ' + sort);
  });
});
