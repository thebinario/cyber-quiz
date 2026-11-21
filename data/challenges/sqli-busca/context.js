const db = MiniSql.createDatabase({
  products: [
    { id: 1, name: 'Teclado Mecânico',  price: 350, category: 'perifericos' },
    { id: 2, name: 'Mouse sem Fio',     price: 90,  category: 'perifericos' },
    { id: 3, name: 'Monitor 27"',       price: 1899, category: 'telas' },
    { id: 4, name: "Garrafa d'água",    price: 35,  category: 'casa' },
    { id: 5, name: 'Webcam Full HD',    price: 240, category: 'perifericos' },
    { id: 6, name: 'Suporte de Monitor', price: 120, category: 'telas' }
  ],
  users: [
    { id: 1, username: 'admin', password_hash: 'h$S3nh@-Forte!', role: 'admin' },
    { id: 2, username: 'ana',   password_hash: 'h$ana-2024',      role: 'user'  }
  ]
});
