// GET /api/orders/:id
// currentUser vem da sessão autenticada; orderId vem da URL.
function getOrder(currentUser, orderId) {
  const order = ORDERS[orderId];
  if (!order) return { status: 404 };
  return { status: 200, body: order };
}
