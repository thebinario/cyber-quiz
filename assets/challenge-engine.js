/*
 * Motor dos desafios: junta contexto + código do usuário, roda os testes e devolve
 * o resultado. Sem DOM. Roda dentro de um Web Worker no site e direto no Node nos testes.
 *
 * Convenção do arquivo de testes (corpo de função):
 *   test('nome', () => { const { funcao, dados } = load(); assert.equal(...); });
 * `load()` executa o contexto e o código do usuário do zero a cada chamada, então
 * cada teste começa com o estado limpo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChallengeEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SAFE_JSON = function (v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  };

  function short(v) {
    var s = v === undefined ? 'undefined' : SAFE_JSON(v);
    return s.length > 120 ? s.slice(0, 117) + '...' : s;
  }

  function AssertionFailure(message) {
    var e = new Error(message);
    e.name = 'AssertionFailure';
    return e;
  }

  var assert = {
    ok: function (value, message) {
      if (!value) throw AssertionFailure(message || 'esperava um valor verdadeiro');
    },
    equal: function (actual, expected, message) {
      if (actual !== expected) {
        throw AssertionFailure((message ? message + ' — ' : '') + 'esperado ' + short(expected) + ', recebido ' + short(actual));
      }
    },
    notEqual: function (actual, unexpected, message) {
      if (actual === unexpected) {
        throw AssertionFailure((message ? message + ' — ' : '') + 'não deveria ser ' + short(unexpected));
      }
    },
    oneOf: function (actual, list, message) {
      if (list.indexOf(actual) === -1) {
        throw AssertionFailure((message ? message + ' — ' : '') + 'esperado um entre ' + short(list) + ', recebido ' + short(actual));
      }
    },
    includes: function (haystack, needle, message) {
      if (haystack === undefined || haystack === null || haystack.indexOf(needle) === -1) {
        throw AssertionFailure((message ? message + ' — ' : '') + 'esperava encontrar ' + short(needle) + ' em ' + short(haystack));
      }
    }
  };

  function buildLoader(options, injected) {
    var names = Object.keys(injected);
    var exportsList = (options.exports || []).concat(options.expose || []);
    var body = options.context + '\n;\n' + options.code + '\n;\nreturn {' +
      exportsList.map(function (n) { return JSON.stringify(n) + ': ' + n; }).join(',') + '};';
    var factory = new Function(names.join(','), body); // eslint-disable-line no-new-func
    var values = names.map(function (n) { return injected[n]; });
    return function load() {
      return factory.apply(null, values);
    };
  }

  /**
   * options: { context, code, tests, exports[], expose[] }
   * injected: libs disponíveis no escopo do contexto (MiniSql, MiniNet).
   * Retorna { loadError?, results: [{ name, ok, message }] }
   */
  function run(options, injected) {
    var results = [];
    var load;
    try {
      // Cada chamada a load() recria o estado: o try aqui pega erros de sintaxe cedo.
      load = buildLoader(options, injected || {});
      load();
    } catch (err) {
      return { loadError: (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err)), results: [] };
    }

    var collected = [];
    function test(name, fn) { collected.push({ name: name, fn: fn }); }

    try {
      new Function('test', 'assert', 'load', options.tests)(test, assert, load); // eslint-disable-line no-new-func
    } catch (err) {
      return { loadError: 'Erro nos testes do desafio: ' + (err && err.message), results: [] };
    }

    collected.forEach(function (t) {
      try {
        t.fn();
        results.push({ name: t.name, ok: true });
      } catch (err) {
        var message = err && err.message ? err.message : String(err);
        if (err && err.name !== 'AssertionFailure') message = (err.name || 'Erro') + ': ' + message;
        results.push({ name: t.name, ok: false, message: message });
      }
    });
    return { results: results };
  }

  return { run: run, assert: assert };
}));
