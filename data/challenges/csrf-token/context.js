const USERS = {
  ana:   { id: 'ana',   email: 'ana@exemplo.com'   },
  bruno: { id: 'bruno', email: 'bruno@exemplo.com' }
};

const SESSIONS = {}; // sid -> dados da sessão, guardados no servidor

// Gera uma string hexadecimal aleatória com 2 * bytes caracteres.
function randomToken(bytes = 16) {
  let out = '';
  for (let i = 0; i < bytes; i++) {
    out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return out;
}
