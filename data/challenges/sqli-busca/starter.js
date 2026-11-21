// GET /api/products?q=<termo>&sort=<coluna>
function searchProducts(q, sort) {
  const orderBy = sort || 'name';
  const sql =
    "SELECT name, price FROM products WHERE name LIKE '%" + q + "%' ORDER BY " + orderBy;

  return { status: 200, rows: db.query(sql) };
}
