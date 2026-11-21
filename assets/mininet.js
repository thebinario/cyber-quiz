/*
 * Rede simulada para os desafios de SSRF: um DNS falso e servidores em memória.
 * Nada aqui faz requisição de verdade.
 *
 *   dns.resolve(host)            -> IP (string); lança erro se o nome não existe
 *   http.get(url, { ip, follow }) -> { status, headers, body, ip }
 *       ip     : fixa o IP de conexão (sem nova consulta de DNS)
 *       follow : segue redirecionamentos (padrão: true)
 *   http.requests                -> registro de todas as conexões feitas
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MiniNet = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isIp(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf(':') !== -1;
  }

  function redirect(to) { return { status: 302, headers: { location: to }, body: '' }; }
  function ok(body) { return { status: 200, headers: {}, body: body }; }

  function createNetwork() {
    var records = {
      'localhost': '127.0.0.1',
      'cdn.exemplo.com': '198.51.100.10',
      'img.exemplo.com': '198.51.100.11',
      'evil.example': '203.0.113.9',
      'admin.interno': '10.0.0.5',
      'metadata.interno': '169.254.169.254',
      'local.evil.example': '127.0.0.1',
      'v6.evil.example': '::1',
      'mapped.evil.example': '::ffff:127.0.0.1'
    };
    var rebindCalls = 0;

    var loopback = {
      '/admin': ok('PAINEL-ADMIN-INTERNO'),
      '/': ok('SERVICO-LOCAL')
    };
    var servers = {
      '198.51.100.10': {
        '/logo.png': ok('PNG-LOGO'),
        '/redir-ok': redirect('http://img.exemplo.com/a.png'),
        '/redir-internal': redirect('http://admin.interno/secret'),
        '/redir-metadata': redirect('http://169.254.169.254/latest/meta-data/iam/security-credentials/papel'),
        '/redir-loopback': redirect('http://127.0.0.1/admin'),
        '/redir-file': redirect('file:///etc/passwd'),
        '/loop': redirect('http://cdn.exemplo.com/loop'),
        '/chain1': redirect('http://cdn.exemplo.com/chain2'),
        '/chain2': redirect('http://cdn.exemplo.com/chain3'),
        '/chain3': redirect('http://cdn.exemplo.com/chain4'),
        '/chain4': redirect('http://cdn.exemplo.com/logo.png')
      },
      '198.51.100.11': { '/a.png': ok('PNG-A') },
      '203.0.113.9': { '/x.png': ok('PNG-X') },
      '10.0.0.5': { '/secret': ok('SEGREDO-INTERNO'), '/admin': ok('PAINEL-ADMIN-INTERNO') },
      '169.254.169.254': {
        '/latest/meta-data/iam/security-credentials/papel': ok('CHAVES-DE-NUVEM'),
        '/latest/meta-data/': ok('METADADOS-DA-INSTANCIA')
      },
      '127.0.0.1': loopback,
      '0.0.0.0': loopback,
      '::1': loopback,
      '::ffff:127.0.0.1': loopback,
      '::ffff:7f00:1': loopback
    };

    var requests = [];

    var dns = {
      resolve: function (host) {
        host = String(host).toLowerCase().replace(/^\[|\]$/g, '');
        if (isIp(host)) return host;
        if (host === 'rebind.evil.example') {
          rebindCalls++;
          return rebindCalls === 1 ? '203.0.113.9' : '127.0.0.1';
        }
        if (records[host]) return records[host];
        throw new Error('ENOTFOUND ' + host);
      }
    };

    function request(url, ip) {
      var host = url.hostname.replace(/^\[|\]$/g, '');
      var connectTo = ip || dns.resolve(host);
      requests.push({ scheme: url.protocol.replace(':', ''), host: host, ip: connectTo, path: url.pathname });
      var table = servers[connectTo];
      var res = (table && table[url.pathname]) || { status: table ? 404 : 502, headers: {}, body: '' };
      return { status: res.status, headers: res.headers, body: res.body, ip: connectTo };
    }

    var http = {
      requests: requests,
      get: function (rawUrl, opts) {
        opts = opts || {};
        var follow = opts.follow !== false;
        var url = new URL(rawUrl);
        if (url.protocol === 'file:') {
          requests.push({ scheme: 'file', host: '', ip: null, path: url.pathname });
          return { status: 200, headers: {}, body: 'root:x:0:0:root:/root:/bin/bash', ip: null };
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('protocolo não suportado: ' + url.protocol);
        }
        var res = request(url, opts.ip);
        var hops = 0;
        while (follow && res.status >= 300 && res.status < 400 && res.headers.location) {
          if (++hops > 5) throw new Error('redirecionamentos demais');
          url = new URL(res.headers.location, url);
          if (url.protocol === 'file:') {
            requests.push({ scheme: 'file', host: '', ip: null, path: url.pathname });
            return { status: 200, headers: {}, body: 'root:x:0:0:root:/root:/bin/bash', ip: null };
          }
          res = request(url, null);
        }
        return res;
      }
    };

    return { dns: dns, http: http };
  }

  return { createNetwork: createNetwork };
}));
