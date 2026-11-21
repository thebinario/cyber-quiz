const PRIVATE = (ip) => {
  if (ip === null) return true; // file:// conta como vazamento
  if (ip.indexOf(':') !== -1) return true; // nenhum servidor público IPv6 neste cenário
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

function checkBlocked(urls) {
  urls.forEach((url) => {
    const { importImage, http } = load();
    let r;
    try { r = importImage(url); } catch (e) { throw new Error('lançou exceção para ' + url + ': ' + e.message); }
    assert.oneOf(r.status, [400, 403], 'status para ' + url);
    assert.ok(!r.body, 'o body de ' + url + ' não deveria ser devolvido');
    const leaked = http.requests.filter((req) => PRIVATE(req.ip));
    assert.equal(leaked.length, 0, 'houve conexão interna ao tratar ' + url);
  });
}

test('legítimo: baixa imagens de hosts públicos', () => {
  const { importImage } = load();
  const a = importImage('https://cdn.exemplo.com/logo.png');
  assert.equal(a.status, 200, 'cdn.exemplo.com');
  assert.equal(a.body, 'PNG-LOGO');
  const b = importImage('http://img.exemplo.com/a.png');
  assert.equal(b.status, 200, 'img.exemplo.com');
  assert.equal(b.body, 'PNG-A');
});

test('bloqueia loopback IPv4 em formas diferentes', () => {
  checkBlocked([
    'http://127.0.0.1/admin',
    'http://127.1/admin',
    'http://2130706433/admin',
    'http://0x7f.0.0.1/admin',
    'http://0.0.0.0/admin'
  ]);
});

test('bloqueia loopback IPv6 (::1 e IPv4 mapeado)', () => {
  checkBlocked(['http://[::1]/admin', 'http://[::ffff:127.0.0.1]/admin']);
});

test('bloqueia o serviço de metadados da nuvem (169.254.169.254)', () => {
  checkBlocked([
    'http://169.254.169.254/latest/meta-data/',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/papel',
    'http://metadata.interno/latest/meta-data/'
  ]);
});

test('bloqueia redes privadas (10.x, 172.16.x, 192.168.x)', () => {
  checkBlocked(['http://10.0.0.5/secret', 'http://172.16.0.9/', 'http://192.168.1.10/']);
});

test('bloqueia nomes que resolvem para IP interno (valide o IP resolvido)', () => {
  checkBlocked([
    'http://localhost/admin',
    'http://admin.interno/secret',
    'http://local.evil.example/admin',
    'http://v6.evil.example/admin',
    'http://mapped.evil.example/admin'
  ]);
});

test('bloqueia esquemas que não sejam http/https', () => {
  checkBlocked(['file:///etc/passwd', 'ftp://cdn.exemplo.com/logo.png']);
});

test('bloqueia o truque do usuário na URL (host real depois do @)', () => {
  checkBlocked(['http://cdn.exemplo.com@127.0.0.1/admin', 'http://cdn.exemplo.com:80@10.0.0.5/secret']);
});

test('texto que não é URL devolve 400 (sem exceção)', () => {
  const { importImage } = load();
  let r;
  try { r = importImage('isso não é url'); } catch (e) { throw new Error('lançou exceção: ' + e.message); }
  assert.equal(r.status, 400);
});
