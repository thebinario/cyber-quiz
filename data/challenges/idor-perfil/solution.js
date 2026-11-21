// PATCH /api/profiles
// body: { userId, displayName, email, ... }  (vem do cliente)
const EDITABLE_FIELDS = ['displayName', 'email'];

function updateProfile(currentUser, body) {
  const targetId = currentUser.role === 'admin' && body.userId
    ? body.userId
    : currentUser.id;

  const profile = PROFILES[targetId];
  if (!profile) return { status: 404 };

  for (const field of EDITABLE_FIELDS) {
    if (field in body) profile[field] = body[field];
  }
  return { status: 200, body: profile };
}
