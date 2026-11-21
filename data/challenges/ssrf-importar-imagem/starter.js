// POST /api/import-image  { "url": "https://..." }
function importImage(url) {
  const res = http.get(url);
  return { status: 200, body: res.body };
}
