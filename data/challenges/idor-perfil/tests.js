test('legítimo: Ana altera o próprio perfil enviando o próprio userId', () => {
  const { updateProfile, USERS, PROFILES } = load();
  const r = updateProfile(USERS.ana, { userId: 'ana', displayName: 'Ana S.' });
  assert.equal(r.status, 200);
  assert.equal(PROFILES.ana.displayName, 'Ana S.');
});

test('sem userId no corpo, altera o perfil de quem está autenticado', () => {
  const { updateProfile, USERS, PROFILES } = load();
  const r = updateProfile(USERS.ana, { email: 'nova@exemplo.com' });
  assert.equal(r.status, 200);
  assert.equal(PROFILES.ana.email, 'nova@exemplo.com');
});

test('Ana não consegue alterar o perfil de Bruno', () => {
  const { updateProfile, USERS, PROFILES } = load();
  updateProfile(USERS.ana, { userId: 'bruno', displayName: 'Hackeado', email: 'x@evil.example' });
  assert.equal(PROFILES.bruno.displayName, 'Bruno', 'displayName de Bruno');
  assert.equal(PROFILES.bruno.email, 'bruno@exemplo.com', 'email de Bruno');
});

test('o userId do perfil nunca é sobrescrito pelo corpo', () => {
  const { updateProfile, USERS, PROFILES } = load();
  updateProfile(USERS.ana, { userId: 'bruno', displayName: 'X' });
  assert.equal(PROFILES.ana.userId, 'ana');
});

test('Ana não consegue se promover enviando role: "admin"', () => {
  const { updateProfile, USERS, PROFILES } = load();
  updateProfile(USERS.ana, { userId: 'ana', displayName: 'Ana', role: 'admin' });
  assert.equal(PROFILES.ana.role, 'user');
});

test('campos desconhecidos do corpo não são gravados no perfil', () => {
  const { updateProfile, USERS, PROFILES } = load();
  updateProfile(USERS.ana, { userId: 'ana', isVerified: true });
  assert.ok(!('isVerified' in PROFILES.ana), 'campo extra isVerified foi gravado');
});

test('legítimo: administrador edita o perfil indicado em userId', () => {
  const { updateProfile, USERS, PROFILES } = load();
  const r = updateProfile(USERS.admin, { userId: 'bruno', displayName: 'Bruno Silva' });
  assert.equal(r.status, 200);
  assert.equal(PROFILES.bruno.displayName, 'Bruno Silva');
});
