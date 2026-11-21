// POST /api/import-image  { "url": "https://..." }
function isPrivateIp(ip) {
  ip = ip.toLowerCase();

  if (ip.includes(':')) { // IPv6
    if (ip === '::1' || ip === '::') return true;
    const mapped = ip.match(/^::ffff:(.+)$/); // IPv4 dentro de IPv6
    if (mapped) {
      const rest = mapped[1];
      if (rest.includes('.')) return isPrivateIp(rest);
      const [hi, lo] = rest.split(':').map((part) => parseInt(part, 16));
      return isPrivateIp([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
    }
    return /^(fc|fd|fe[89ab])/.test(ip); // fc00::/7 e fe80::/10
  }

  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127);
}

function importImage(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch (e) { return { status: 400 }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { status: 400 };

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let ip;
  try { ip = dns.resolve(host); } catch (e) { return { status: 400 }; }
  if (isPrivateIp(ip)) return { status: 403 };

  const res = http.get(url.href, { ip, follow: false }); // conecta no IP validado
  return { status: 200, body: res.body };
}
