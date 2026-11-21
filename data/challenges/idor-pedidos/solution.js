// GET /api/orders/:id
// currentUser vem da sessão autenticada; orderId vem da URL.
function getOrder(currentUser, orderId) {
  const order = ORDERS[orderId];
  if (!order) return { status: 404 };

  const isOwner = order.ownerId === currentUser.id;
  const isAdmin = currentUser.role === 'admin';
  if (!isOwner && !isAdmin) return { status: 403 };

  return { status: 200, body: order };
}
