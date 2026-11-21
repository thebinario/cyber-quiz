// POST /api/import-image  { "url": "https://..." }
const MAX_REDIRECTS = 3;

// Valida esquema e IP resolvido. Devolve { url, ip } ou null se for proibido.
function validate(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch (e) { return null; }
  if (!['http:', 'https:'].includes(url.protocol)) return null;

  let ip;
  try { ip = dns.resolve(url.hostname.replace(/^\[|\]$/g, '')); } catch (e) { return null; }
  if (isPrivateIp(ip)) return null;
  return { url, ip };
}

function importImage(rawUrl) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const target = validate(current);
    if (!target) return { status: 403 };

    // Conecta no IP validado e não segue o redirecionamento automaticamente.
    const res = http.get(target.url.href, { ip: target.ip, follow: false });

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      current = new URL(res.headers.location, target.url).href;
      continue; // o próximo salto passa pela mesma validação
    }
    return { status: res.status, body: res.body };
  }
  return { status: 400 }; // redirecionamentos demais
}
