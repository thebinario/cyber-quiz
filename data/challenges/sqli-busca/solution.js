// GET /api/products?q=<termo>&sort=<coluna>
const SORTABLE_COLUMNS = ['name', 'price', 'category'];

function searchProducts(q, sort) {
  const orderBy = sort || 'name';
  if (!SORTABLE_COLUMNS.includes(orderBy)) return { status: 400, rows: [] };

  // O valor do LIKE vai como parâmetro; o ORDER BY vem da allowlist acima.
  const sql = 'SELECT name, price FROM products WHERE name LIKE ? ORDER BY ' + orderBy;
  return { status: 200, rows: db.query(sql, ['%' + (q || '') + '%']) };
}
