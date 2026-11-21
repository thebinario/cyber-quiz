'use strict';
// Valida todos os desafios: o código inicial falha, a solução passa e uma
// "correção" que nega tudo não é aceita. Executar: node --test tests/challenges.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../assets/challenge-engine.js');
const MiniSql = require('../assets/minisql.js');
const MiniNet = require('../assets/mininet.js');

const root = path.join(__dirname, '..', 'data', 'challenges');
const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
const TOPICS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'index.json'), 'utf8')).topics;

function read(id, file) { return fs.readFileSync(path.join(root, id, file), 'utf8'); }

function run(id, meta, code) {
  return Engine.run({
    context: read(id, 'context.js'),
    code: code,
    tests: read(id, 'tests.js'),
    exports: meta.exports,
    expose: meta.expose
  }, { MiniSql: MiniSql, MiniNet: MiniNet });
}

test('há ao menos 2 desafios por tema', () => {
  TOPICS.forEach((topic) => {
    const n = index.challenges.filter((id) => JSON.parse(read(id, 'challenge.json')).topic === topic).length;
    assert.ok(n >= 2, topic + ' tem ' + n);
  });
});

index.challenges.forEach((id) => {
  const meta = JSON.parse(read(id, 'challenge.json'));

  test(id + ': metadados completos', () => {
    assert.equal(meta.id, id);
    assert.ok(TOPICS.includes(meta.topic), 'tema inválido');
    assert.ok(['facil', 'medio', 'dificil'].includes(meta.difficulty));
    ['title', 'owasp', 'summary', 'explanation'].forEach((k) => assert.ok(meta[k], k));
    assert.ok(Array.isArray(meta.statement) && meta.statement.length >= 2);
    assert.ok(Array.isArray(meta.hints) && meta.hints.length >= 2);
    assert.ok(Array.isArray(meta.exports) && meta.exports.length >= 1);
  });

  test(id + ': o código inicial é vulnerável (algum teste falha) e roda sem erro de carga', () => {
    const out = run(id, meta, read(id, 'starter.js'));
    assert.equal(out.loadError, undefined, out.loadError);
    assert.ok(out.results.length >= 5, 'poucos testes');
    assert.ok(out.results.some((r) => !r.ok), 'o código inicial passa em tudo; não há vulnerabilidade a corrigir');
  });

  test(id + ': a solução passa em todos os testes', () => {
    const out = run(id, meta, read(id, 'solution.js'));
    assert.equal(out.loadError, undefined, out.loadError);
    const failed = out.results.filter((r) => !r.ok).map((r) => r.name + ' => ' + r.message);
    assert.deepEqual(failed, []);
  });

  test(id + ': tem testes "legítimo:" e uma correção que nega tudo é reprovada neles', () => {
    const denyAll = meta.exports.map((n) =>
      'function ' + n + '() { return { status: 403, ok: false, rows: [], csrfToken: undefined }; }').join('\n');
    const out = run(id, meta, denyAll);
    const legit = out.results.filter((r) => r.name.indexOf('legítimo') === 0);
    assert.ok(legit.length >= 1, 'faltam testes de comportamento legítimo');
    assert.ok(legit.every((r) => !r.ok), 'um teste legítimo passou mesmo negando tudo');
  });

  test(id + ': o estado é isolado entre testes (load() recria o contexto)', () => {
    const out1 = run(id, meta, read(id, 'solution.js'));
    const out2 = run(id, meta, read(id, 'solution.js'));
    assert.deepEqual(out1.results, out2.results);
  });
});

test('erro de sintaxe no código do usuário vira loadError, sem derrubar o motor', () => {
  const meta = JSON.parse(read('idor-pedidos', 'challenge.json'));
  const out = run('idor-pedidos', meta, 'function getOrder( {');
  assert.ok(out.loadError && /SyntaxError/.test(out.loadError));
});

test('exceção dentro do código do usuário vira falha do teste', () => {
  const meta = JSON.parse(read('idor-pedidos', 'challenge.json'));
  const out = run('idor-pedidos', meta, 'function getOrder() { throw new Error("boom"); }');
  assert.ok(out.results.every((r) => !r.ok && /boom/.test(r.message)));
});
