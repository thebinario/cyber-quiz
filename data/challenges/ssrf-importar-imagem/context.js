// Rede simulada: nenhuma requisição real é feita.
const { dns, http } = MiniNet.createNetwork();
// dns.resolve('cdn.exemplo.com') -> '198.51.100.10'
// http.get(url, { ip, follow })  -> { status, headers, body }
