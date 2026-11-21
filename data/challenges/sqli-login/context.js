// "Hash" de brincadeira, só para o exemplo (não use algo assim de verdade).
const hash = (senha) => 'h$' + senha;

const db = MiniSql.createDatabase({
  users: [
    { id: 1, username: 'admin',  password_hash: hash('S3nh@-Forte!'),  role: 'admin' },
    { id: 2, username: 'ana',    password_hash: hash("it's-ana-2024"), role: 'user'  },
    { id: 3, username: "d'arc",  password_hash: hash('jeanne'),        role: 'user'  }
  ]
});
