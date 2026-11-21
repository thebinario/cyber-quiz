function login(username, password) {
  const sql =
    "SELECT id, username, role FROM users WHERE username = '" + username +
    "' AND password_hash = '" + hash(password) + "'";

  const rows = db.query(sql);
  return rows.length > 0 ? { ok: true, user: rows[0] } : { ok: false };
}
