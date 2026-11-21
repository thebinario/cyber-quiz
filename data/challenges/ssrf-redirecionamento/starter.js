// POST /api/import-image  { "url": "https://..." }
function importImage(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch (e) { return { status: 400 }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { status: 400 };

  let ip;
  try { ip = dns.resolve(url.hostname); } catch (e) { return { status: 400 }; }
  if (isPrivateIp(ip)) return { status: 403 };

  // Segue redirecionamentos sozinho e resolve o DNS de novo ao conectar.
  const res = http.get(rawUrl);
  return { status: 200, body: res.body };
}
