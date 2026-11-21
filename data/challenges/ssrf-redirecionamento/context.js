// Rede simulada: nenhuma requisição real é feita.
const { dns, http } = MiniNet.createNetwork();

// Já implementada (veja o desafio anterior): true para IPs que o servidor não deve acessar.
function isPrivateIp(ip) {
  ip = ip.toLowerCase();
  if (ip.includes(':')) {
    if (ip === '::1' || ip === '::') return true;
    const mapped = ip.match(/^::ffff:(.+)$/);
    if (mapped) {
      const rest = mapped[1];
      if (rest.includes('.')) return isPrivateIp(rest);
      const [hi, lo] = rest.split(':').map((part) => parseInt(part, 16));
      return isPrivateIp([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
    }
    return /^(fc|fd|fe[89ab])/.test(ip);
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127);
}
