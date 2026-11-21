function login(username, password) {
  const sql =
    'SELECT id, username, role FROM users WHERE username = ? AND password_hash = ?';

  const rows = db.query(sql, [username, hash(password)]);
  return rows.length > 0 ? { ok: true, user: rows[0] } : { ok: false };
}
