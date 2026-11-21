// PATCH /api/profiles
// body: { userId, displayName, email, ... }  (vem do cliente)
function updateProfile(currentUser, body) {
  const profile = PROFILES[body.userId];
  if (!profile) return { status: 404 };
  Object.assign(profile, body);
  return { status: 200, body: profile };
}
