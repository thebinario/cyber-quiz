/*
 * Web Worker que executa o código do desafio fora da página principal.
 * Sem acesso ao DOM; a rede do Worker é desligada antes de rodar qualquer código do usuário.
 * O thread principal encerra o Worker se a execução passar do tempo limite (loop infinito).
 */
'use strict';

importScripts('minisql.js', 'mininet.js', 'challenge-engine.js');

(function lockDown() {
  ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches'].forEach(function (name) {
    try {
      Object.defineProperty(self, name, { value: undefined, configurable: false, writable: false });
    } catch (e) { /* ignora */ }
  });
}());

self.onmessage = function (event) {
  var job = event.data;
  var outcome;
  try {
    outcome = self.ChallengeEngine.run(job, { MiniSql: self.MiniSql, MiniNet: self.MiniNet });
  } catch (err) {
    outcome = { loadError: String(err && err.message ? err.message : err), results: [] };
  }
  self.postMessage(outcome);
};
