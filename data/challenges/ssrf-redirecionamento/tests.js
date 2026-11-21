const PRIVATE = (ip) => {
  if (ip === null) return true; // file:// conta como vazamento
  if (ip.indexOf(':') !== -1) return true;
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

function expectBlocked(url) {
  const { importImage, http } = load();
  const r = importImage(url);
  assert.oneOf(r.status, [400, 403], 'status para ' + url);
  assert.ok(!r.body, 'o body de ' + url + ' não deveria ser devolvido');
  const leaked = http.requests.filter((req) => PRIVATE(req.ip));
  assert.equal(leaked.length, 0, 'houve conexão interna ao tratar ' + url);
}

test('legítimo: imagem direta em host público', () => {
  const { importImage } = load();
  const r = importImage('https://cdn.exemplo.com/logo.png');
  assert.equal(r.status, 200);
  assert.equal(r.body, 'PNG-LOGO');
});

test('legítimo: redirecionamento entre hosts públicos é seguido', () => {
  const { importImage } = load();
  const r = importImage('https://cdn.exemplo.com/redir-ok');
  assert.equal(r.status, 200, 'status final');
  assert.equal(r.body, 'PNG-A', 'conteúdo do destino final');
});

test('redirecionamento para host interno (admin.interno) é bloqueado', () => {
  expectBlocked('https://cdn.exemplo.com/redir-internal');
});

test('redirecionamento para o serviço de metadados é bloqueado', () => {
  expectBlocked('https://cdn.exemplo.com/redir-metadata');
});

test('redirecionamento para loopback é bloqueado', () => {
  expectBlocked('https://cdn.exemplo.com/redir-loopback');
});

test('redirecionamento para file:// é bloqueado', () => {
  expectBlocked('https://cdn.exemplo.com/redir-file');
});

test('DNS rebinding: nenhuma conexão é feita ao IP interno', () => {
  const { importImage, http } = load();
  importImage('http://rebind.evil.example/x.png');
  const leaked = http.requests.filter((req) => PRIVATE(req.ip));
  assert.equal(leaked.length, 0, 'conectou em IP interno após o rebinding; conecte no IP já validado (opção ip)');
});

test('laço de redirecionamentos devolve 400 sem insistir para sempre', () => {
  const { importImage, http } = load();
  const r = importImage('https://cdn.exemplo.com/loop');
  assert.equal(r.status, 400);
  assert.ok(http.requests.length <= 5, 'tentou ' + http.requests.length + ' conexões; limite de 3 redirecionamentos');
});

test('no máximo 3 redirecionamentos: 3 passa, 4 não', () => {
  const { importImage } = load();
  assert.equal(importImage('https://cdn.exemplo.com/chain2').status, 200, '3 redirecionamentos');
  assert.equal(importImage('https://cdn.exemplo.com/chain1').status, 400, '4 redirecionamentos');
});
