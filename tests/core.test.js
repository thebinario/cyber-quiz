'use strict';
// Executar: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../assets/quiz-core.js');

// Gerador pseudoaleatório determinístico (mulberry32) para testes reproduzíveis.
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadBank() {
  const dir = path.join(__dirname, '..', 'data');
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const byTopic = {};
  index.topics.forEach((id) => {
    const topic = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
    topic.questions.forEach((q) => { q.topic = id; });
    byTopic[id] = topic.questions;
  });
  return byTopic;
}

const bank = loadBank();
const all = Object.values(bank).flat();

test('shuffle mantém os mesmos elementos e não altera a entrada', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = input.slice();
  const out = Core.shuffle(input, seeded(1));
  assert.deepEqual(input, copy);
  assert.deepEqual(out.slice().sort(), copy);
});

test('shuffle com sementes diferentes produz ordens diferentes', () => {
  const input = Array.from({ length: 20 }, (_, i) => i);
  assert.notDeepEqual(Core.shuffle(input, seeded(1)), Core.shuffle(input, seeded(2)));
});

test('selectBalanced devolve a quantidade pedida, sem repetir perguntas', () => {
  const picked = Core.selectBalanced(bank, 15, new Set(), seeded(7));
  assert.equal(picked.length, 15);
  assert.equal(new Set(picked.map((q) => q.id)).size, 15);
});

test('selectBalanced distribui as perguntas entre os temas', () => {
  const picked = Core.selectBalanced(bank, 16, new Set(), seeded(3));
  const counts = {};
  picked.forEach((q) => { counts[q.topic] = (counts[q.topic] || 0) + 1; });
  Object.keys(bank).forEach((id) => assert.equal(counts[id], 4, `tema ${id}`));
});

test('selectBalanced com 15 perguntas diferencia no máximo uma por tema', () => {
  const picked = Core.selectBalanced(bank, 15, new Set(), seeded(11));
  const counts = Object.keys(bank).map((id) => picked.filter((q) => q.topic === id).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, JSON.stringify(counts));
});

test('selectBalanced prioriza perguntas ainda não vistas', () => {
  // 10 vistas em cada tema: sobram inéditas suficientes em todos eles
  const seen = new Set(Object.values(bank).flatMap((qs) => qs.slice(0, 10).map((q) => q.id)));
  const picked = Core.selectBalanced(bank, 15, seen, seeded(5));
  picked.forEach((q) => assert.ok(!seen.has(q.id), `${q.id} já tinha sido vista`));
});

test('selectBalanced completa com perguntas já vistas quando faltam inéditas', () => {
  const seen = new Set(all.map((q) => q.id));
  const picked = Core.selectBalanced(bank, 15, seen, seeded(5));
  assert.equal(picked.length, 15);
});

test('selectBalanced não passa do total disponível', () => {
  const picked = Core.selectBalanced(bank, 9999, new Set(), seeded(5));
  assert.equal(picked.length, all.length);
});

test('selectFromPool usa só o tema pedido e prioriza as inéditas', () => {
  const pool = bank.idor;
  const seen = new Set(pool.slice(0, 5).map((q) => q.id));
  const picked = Core.selectFromPool(pool, 15, seen, seeded(9));
  assert.equal(picked.length, 15);
  picked.forEach((q) => {
    assert.equal(q.topic, 'idor');
    assert.ok(!seen.has(q.id));
  });
});

test('duas tentativas com sementes diferentes sorteiam conjuntos diferentes', () => {
  const a = Core.selectBalanced(bank, 15, new Set(), seeded(100)).map((q) => q.id).sort();
  const b = Core.selectBalanced(bank, 15, new Set(), seeded(200)).map((q) => q.id).sort();
  assert.notDeepEqual(a, b);
});

test('prepareQuestion mantém o gabarito apontando para o mesmo texto', () => {
  all.forEach((q) => {
    const expected = q.answer.map((i) => q.options[i]).sort();
    for (let seed = 1; seed <= 5; seed++) {
      const p = Core.prepareQuestion(q, seeded(seed));
      const shown = p.correct.map((i) => p.options[i]).sort();
      assert.deepEqual(shown, expected, q.id);
      assert.equal(p.options.length, q.options.length);
      assert.deepEqual(p.options.slice().sort(), q.options.slice().sort());
    }
  });
});

test('prepareQuestion embaralha as alternativas', () => {
  const q = bank.idor[0];
  const orders = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    orders.add(Core.prepareQuestion(q, seeded(seed)).options.join('|'));
  }
  assert.ok(orders.size > 1);
});

test('isCorrect exige exatamente o mesmo conjunto', () => {
  const single = { correct: [2] };
  assert.equal(Core.isCorrect(single, [2]), true);
  assert.equal(Core.isCorrect(single, [1]), false);
  assert.equal(Core.isCorrect(single, []), false);
  assert.equal(Core.isCorrect(single, [2, 3]), false);

  const multi = { correct: [0, 2, 3] };
  assert.equal(Core.isCorrect(multi, [3, 0, 2]), true);
  assert.equal(Core.isCorrect(multi, [0, 2]), false);
  assert.equal(Core.isCorrect(multi, [0, 1, 2, 3]), false);
});

test('summarize calcula total, acertos e quebra por tema e tipo', () => {
  const s = Core.summarize([
    { topic: 'idor', category: 'conceito', correct: true },
    { topic: 'idor', category: 'tipos', correct: false },
    { topic: 'csrf', category: 'conceito', correct: true },
    { topic: 'csrf', category: 'correcao', correct: true }
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.correct, 3);
  assert.equal(s.percent, 75);
  assert.deepEqual(s.byTopic.idor, { correct: 1, total: 2 });
  assert.deepEqual(s.byTopic.csrf, { correct: 2, total: 2 });
  assert.deepEqual(s.byCategory.conceito, { correct: 2, total: 2 });
});

test('summarize com lista vazia não divide por zero', () => {
  const s = Core.summarize([]);
  assert.equal(s.percent, 0);
  assert.equal(s.total, 0);
});

test('o banco tem ao menos 15 perguntas por tema e na soma', () => {
  Object.keys(bank).forEach((id) => assert.ok(bank[id].length >= 15, id));
  assert.ok(all.length >= 15);
});
