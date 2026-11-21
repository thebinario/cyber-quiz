/*
 * Núcleo do quiz: sorteio, embaralhamento, correção e resumo.
 * Sem acesso ao DOM, para poder ser testado no Node (tests/core.test.js).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QuizCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Número aleatório em [0, 1). Usa crypto quando disponível. */
  function defaultRng() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.getRandomValues === 'function') {
      var buf = new Uint32Array(1);
      c.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  /** Fisher-Yates; devolve uma cópia embaralhada. */
  function shuffle(list, rng) {
    var random = rng || defaultRng;
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** Fila de um tema: perguntas ainda não vistas primeiro, depois as já vistas. */
  function orderedQueue(questions, seen, rng) {
    var unseen = [];
    var already = [];
    questions.forEach(function (q) {
      (seen.has(q.id) ? already : unseen).push(q);
    });
    return shuffle(unseen, rng).concat(shuffle(already, rng));
  }

  /** Sorteia `count` perguntas de uma lista única, priorizando as não vistas. */
  function selectFromPool(questions, count, seen, rng) {
    var queue = orderedQueue(questions, seen || new Set(), rng);
    return shuffle(queue.slice(0, Math.min(count, queue.length)), rng);
  }

  /**
   * Sorteio misto e equilibrado: percorre os temas em rodadas (em ordem
   * aleatória a cada rodada) até completar `count`.
   * byTopic: { idDoTema: [perguntas] }
   */
  function selectBalanced(byTopic, count, seen, rng) {
    var seenSet = seen || new Set();
    var ids = Object.keys(byTopic);
    var queues = {};
    var total = 0;
    ids.forEach(function (id) {
      queues[id] = orderedQueue(byTopic[id], seenSet, rng);
      total += queues[id].length;
    });
    var target = Math.min(count, total);
    var picked = [];
    while (picked.length < target) {
      var progressed = false;
      var round = shuffle(ids, rng);
      for (var i = 0; i < round.length && picked.length < target; i++) {
        var next = queues[round[i]].shift();
        if (next) {
          picked.push(next);
          progressed = true;
        }
      }
      if (!progressed) break;
    }
    return shuffle(picked, rng);
  }

  /**
   * Embaralha as alternativas de uma pergunta e converte o gabarito para
   * as posições exibidas.
   */
  function prepareQuestion(q, rng) {
    var indexed = q.options.map(function (text, original) {
      return { text: text, original: original };
    });
    var shown = shuffle(indexed, rng);
    var correct = [];
    shown.forEach(function (opt, position) {
      if (q.answer.indexOf(opt.original) !== -1) correct.push(position);
    });
    return {
      id: q.id,
      topic: q.topic,
      category: q.category,
      difficulty: q.difficulty,
      type: q.type,
      question: q.question,
      explanation: q.explanation,
      options: shown.map(function (o) { return o.text; }),
      correct: correct
    };
  }

  /** Acerto exige exatamente o mesmo conjunto de alternativas do gabarito. */
  function isCorrect(prepared, selected) {
    var a = prepared.correct.slice().sort(function (x, y) { return x - y; });
    var b = (selected || []).slice().sort(function (x, y) { return x - y; });
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function bump(map, key, ok) {
    if (!map[key]) map[key] = { correct: 0, total: 0 };
    map[key].total += 1;
    if (ok) map[key].correct += 1;
  }

  /** results: [{ topic, category, correct: boolean }] */
  function summarize(results) {
    var byTopic = {};
    var byCategory = {};
    var correct = 0;
    results.forEach(function (r) {
      if (r.correct) correct += 1;
      bump(byTopic, r.topic, r.correct);
      bump(byCategory, r.category, r.correct);
    });
    var total = results.length;
    return {
      total: total,
      correct: correct,
      percent: total ? Math.round((correct / total) * 100) : 0,
      byTopic: byTopic,
      byCategory: byCategory
    };
  }

  return {
    shuffle: shuffle,
    selectFromPool: selectFromPool,
    selectBalanced: selectBalanced,
    prepareQuestion: prepareQuestion,
    isCorrect: isCorrect,
    summarize: summarize
  };
}));
