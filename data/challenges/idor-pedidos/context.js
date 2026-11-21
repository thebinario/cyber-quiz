// Dados da aplicação (somente leitura). Cada teste recebe uma cópia nova.
const USERS = {
  ana:   { id: 'ana',   role: 'user'  },
  bruno: { id: 'bruno', role: 'user'  },
  admin: { id: 'admin', role: 'admin' }
};

const ORDERS = {
  501: { id: 501, ownerId: 'ana',   item: 'Teclado mecânico', total: 350 },
  601: { id: 601, ownerId: 'bruno', item: 'Monitor 27"',      total: 1899 }
};
