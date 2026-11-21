(function () {
  'use strict';

  var Core = window.QuizCore;

  var STORAGE_KEY = 'cyber-quiz:v1';
  var MAX_HISTORY = 20;
  var COUNT_CHOICES = [15, 20, 30, 40];

  var CATEGORY_LABELS = {
    conceito: 'Conceito',
    exploracao: 'Exploração',
    tipos: 'Tipos',
    correcao: 'Correção',
    owasp: 'OWASP',
    deteccao: 'Detecção'
  };
  var DIFFICULTY_LABELS = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

  var app = document.getElementById('app');
  var topics = {};
  var topicOrder = [];
  var run = null;
  var controls = null; // atalhos de teclado da questão em exibição
  var lastSetup = { mode: 'mixed', count: 15, feedbackEach: true };

  /* ---------- helpers de DOM (sempre textContent: nada de innerHTML) ---------- */

  function append(el, children) {
    children.forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) {
        append(el, child);
      } else if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(String(child)));
      } else {
        el.appendChild(child);
      }
    });
  }

  function h(tag, props) {
    var el = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'className') {
          el.className = value;
        } else if (key.indexOf('on') === 0 && typeof value === 'function') {
          el.addEventListener(key.slice(2), value);
        } else if (key === 'checked' || key === 'disabled' || key === 'value') {
          el[key] = value;
        } else {
          el.setAttribute(key, value === true ? '' : String(value));
        }
      });
    }
    append(el, children);
    return el;
  }

  /** Converte `trecho` em <code>trecho</code>, sem interpretar HTML. */
  function rich(text) {
    var frag = document.createDocumentFragment();
    String(text).split('`').forEach(function (part, i) {
      if (!part) return;
      if (i % 2 === 1) {
        var code = document.createElement('code');
        code.textContent = part;
        frag.appendChild(code);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    return frag;
  }

  function mount(node) {
    controls = null;
    app.replaceChildren(node);
    var target = app.querySelector('[data-autofocus]');
    if (target) target.focus();
    window.scrollTo(0, 0);
  }

  /* ---------- armazenamento local (opcional) ---------- */

  function loadStore() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (data && typeof data === 'object') {
        return {
          seen: Array.isArray(data.seen) ? data.seen : [],
          history: Array.isArray(data.history) ? data.history : []
        };
      }
    } catch (e) { /* storage indisponível ou corrompido */ }
    return { seen: [], history: [] };
  }

  function saveStore(store) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) { /* ignora */ }
  }

  /* ---------- carregamento ---------- */

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ': HTTP ' + res.status);
      return res.json();
    });
  }

  function loadData() {
    return fetchJson('data/index.json').then(function (index) {
      return Promise.all(index.topics.map(function (id) { return fetchJson('data/' + id + '.json'); }));
    }).then(function (list) {
      list.forEach(function (topic) {
        topic.questions.forEach(function (q) { q.topic = topic.id; });
        topics[topic.id] = topic;
        topicOrder.push(topic.id);
      });
    });
  }

  function totalQuestions() {
    return topicOrder.reduce(function (n, id) { return n + topics[id].questions.length; }, 0);
  }

  function modeLabel(mode) {
    return mode === 'mixed' ? 'Misto' : (topics[mode] ? topics[mode].title : mode);
  }

  /* ---------- tela inicial ---------- */

  function renderHome() {
    run = null;
    document.title = 'Cyber Quiz — questões de AppSec e Pentest';

    var store = loadStore();
    var modes = [{
      id: 'mixed', title: 'Misto', description: 'Sorteia de todos os temas', size: totalQuestions()
    }].concat(topicOrder.map(function (id) {
      return { id: id, title: topics[id].title, description: topics[id].description, size: topics[id].questions.length };
    }));

    var countSelect = h('select', { id: 'count', name: 'count' });

    function sizeOf(mode) {
      return modes.filter(function (m) { return m.id === mode; })[0].size;
    }

    function fillCounts(mode, preferred) {
      var size = sizeOf(mode);
      var choices = COUNT_CHOICES.filter(function (n) { return n <= size; });
      if (!choices.length) choices = [size];
      countSelect.replaceChildren();
      choices.forEach(function (n) {
        countSelect.appendChild(h('option', { value: String(n), selected: n === preferred }, n + ' questões'));
      });
      if (choices.indexOf(preferred) === -1) countSelect.value = String(choices[0]);
    }

    fillCounts(lastSetup.mode, lastSetup.count);

    var form = h('form', {
      className: 'card',
      onsubmit: function (e) {
        e.preventDefault();
        var mode = form.elements.mode.value;
        var count = parseInt(countSelect.value, 10);
        var feedbackEach = form.elements.feedback.checked;
        lastSetup = { mode: mode, count: count, feedbackEach: feedbackEach };
        startRun(mode, count, feedbackEach);
      }
    },
      h('fieldset', null,
        h('legend', null, 'Escolha o tema'),
        modes.map(function (m) {
          return h('label', { className: 'choice' },
            h('input', {
              type: 'radio', name: 'mode', value: m.id, checked: m.id === lastSetup.mode,
              onchange: function () { fillCounts(m.id, parseInt(countSelect.value, 10)); }
            }),
            h('span', { className: 'choice-body' },
              h('strong', null, m.title),
              h('span', { className: 'muted' }, m.description + ' · ' + m.size + ' questões no banco')
            )
          );
        })
      ),
      h('div', { className: 'field' },
        h('label', { 'for': 'count' }, 'Quantidade de questões por tentativa'),
        countSelect
      ),
      h('label', { className: 'check' },
        h('input', { type: 'checkbox', name: 'feedback', checked: lastSetup.feedbackEach }),
        h('span', null, 'Mostrar a resposta correta e a explicação depois de cada questão (desmarque para simular uma prova e ver tudo só no final)')
      ),
      h('div', { className: 'actions' },
        h('button', { type: 'submit', className: 'btn btn-primary' }, 'Começar')
      )
    );

    var children = [
      h('h1', { tabindex: '-1', 'data-autofocus': true }, 'Teste seus conhecimentos em segurança de aplicações'),
      h('p', null,
        'Perguntas no estilo de entrevista técnica sobre IDOR, CSRF, SQL Injection e SSRF: o que é, como se explora, ',
        'quais são os tipos, como corrigir e em qual categoria do OWASP Top 10 a falha se encaixa.'),
      h('p', { className: 'muted' },
        'Cada tentativa sorteia questões diferentes, embaralha as alternativas e prioriza as que você ainda não viu.'),
      form
    ];

    if (store.history.length) {
      children.push(h('section', { className: 'card' },
        h('h2', null, 'Suas últimas tentativas'),
        h('ul', { className: 'history' },
          store.history.slice(0, 5).map(function (entry) {
            var pct = entry.total ? Math.round((entry.correct / entry.total) * 100) : 0;
            return h('li', null,
              h('strong', null, entry.correct + '/' + entry.total + ' (' + pct + '%)'),
              h('span', null, modeLabel(entry.mode)),
              h('span', { className: 'when' }, formatDate(entry.at))
            );
          })
        ),
        h('button', {
          type: 'button', className: 'btn btn-secondary',
          onclick: function () { saveStore({ seen: [], history: [] }); renderHome(); }
        }, 'Limpar histórico')
      ));
    }

    mount(h('div', null, children));
  }

  function formatDate(ms) {
    try {
      return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return '';
    }
  }

  /* ---------- tentativa ---------- */

  function startRun(mode, count, feedbackEach) {
    var store = loadStore();
    var seen = new Set(store.seen);
    var picked;
    if (mode === 'mixed') {
      var byTopic = {};
      topicOrder.forEach(function (id) { byTopic[id] = topics[id].questions; });
      picked = Core.selectBalanced(byTopic, count, seen);
    } else {
      picked = Core.selectFromPool(topics[mode].questions, count, seen);
    }

    // Marca como vistas já no sorteio: mesmo abandonando, a próxima tentativa varia.
    var seenNow = new Set(store.seen);
    picked.forEach(function (q) { seenNow.add(q.id); });
    store.seen = Array.from(seenNow);
    saveStore(store);

    run = {
      mode: mode,
      feedbackEach: feedbackEach,
      items: picked.map(function (q) { return Core.prepareQuestion(q); }),
      answers: [],
      index: 0
    };
    renderQuestion();
  }

  function renderQuestion() {
    var item = run.items[run.index];
    var total = run.items.length;
    var isMulti = item.type === 'multi';
    var isLast = run.index === total - 1;
    var confirmed = false;
    var inputs = [];
    var labels = [];

    document.title = 'Questão ' + (run.index + 1) + ' de ' + total + ' — Cyber Quiz';

    function readSelection() {
      return inputs.map(function (inp, i) { return inp.checked ? i : -1; })
        .filter(function (i) { return i >= 0; });
    }

    var primary = h('button', { type: 'submit', className: 'btn btn-primary', disabled: true },
      run.feedbackEach ? 'Confirmar resposta' : (isLast ? 'Finalizar' : 'Próxima'));
    var skip = h('button', {
      type: 'button', className: 'btn btn-secondary',
      onclick: function () { submit(true); }
    }, 'Pular');
    var feedbackBox = h('div', { 'aria-live': 'polite' });

    item.options.forEach(function (text, i) {
      var input = h('input', {
        type: isMulti ? 'checkbox' : 'radio', name: 'answer', value: String(i), id: 'opt-' + i,
        onchange: function () { primary.disabled = readSelection().length === 0; }
      });
      var badge = h('span', { className: 'option-badge' });
      var label = h('label', { className: 'option' + (isMulti ? ' is-multi' : ''), 'for': 'opt-' + i },
        input,
        h('span', { className: 'option-body' },
          h('span', { className: 'option-key', 'aria-hidden': 'true' }, String(i + 1)),
          h('span', { className: 'option-text' }, rich(text)),
          badge
        )
      );
      label.badge = badge;
      inputs.push(input);
      labels.push(label);
    });

    function lockAndMark(selected) {
      inputs.forEach(function (inp) { inp.disabled = true; });
      labels.forEach(function (label, i) {
        var chosen = selected.indexOf(i) !== -1;
        var right = item.correct.indexOf(i) !== -1;
        label.classList.add('is-locked');
        if (right) {
          label.classList.add('is-correct');
          label.badge.textContent = chosen ? '✓ Correta' : '✓ Era correta';
        } else if (chosen) {
          label.classList.add('is-wrong');
          label.badge.textContent = '✗ Sua resposta';
        }
      });
    }

    function submit(skipped) {
      if (confirmed) {
        advance();
        return;
      }
      var selected = skipped ? [] : readSelection();
      if (!skipped && !selected.length) return;
      var ok = Core.isCorrect(item, selected);
      run.answers[run.index] = { selected: selected, correct: ok };

      if (!run.feedbackEach) {
        advance();
        return;
      }

      confirmed = true;
      lockAndMark(selected);
      var title = skipped ? 'Questão pulada.' : (ok ? 'Correto!' : 'Incorreto.');
      feedbackBox.replaceChildren(
        h('div', { className: 'feedback ' + (ok ? 'ok' : 'bad') },
          h('strong', null, title),
          h('span', null, rich(item.explanation))
        )
      );
      primary.disabled = false;
      primary.textContent = isLast ? 'Ver resultado' : 'Próxima questão';
      skip.hidden = true;
      primary.focus();
    }

    function advance() {
      run.index += 1;
      if (run.index >= total) {
        finish();
      } else {
        renderQuestion();
      }
    }

    var form = h('form', {
      className: 'card',
      onsubmit: function (e) { e.preventDefault(); submit(false); }
    },
      h('div', { className: 'quiz-meta' },
        h('span', { className: 'counter' }, 'Questão ' + (run.index + 1) + ' de ' + total),
        h('span', { className: 'chip' }, topics[item.topic].title),
        h('span', { className: 'chip' }, CATEGORY_LABELS[item.category] || item.category),
        h('span', { className: 'chip' }, DIFFICULTY_LABELS[item.difficulty] || item.difficulty)
      ),
      h('progress', { max: total, value: run.index, 'aria-label': 'Progresso do quiz' }),
      h('fieldset', null,
        h('legend', { className: 'question-text', tabindex: '-1', 'data-autofocus': true }, rich(item.question)),
        h('p', { className: 'hint' }, isMulti ? 'Selecione todas as alternativas corretas.' : 'Selecione uma alternativa.'),
        labels
      ),
      feedbackBox,
      h('div', { className: 'actions' }, primary, skip)
    );

    mount(form);
    // mount() zera `controls`; registra os atalhos desta questão depois dela.
    controls = {
      toggle: function (i) {
        if (confirmed || !inputs[i]) return;
        inputs[i].checked = isMulti ? !inputs[i].checked : true;
        primary.disabled = readSelection().length === 0;
      },
      confirm: function () {
        if (!primary.disabled) primary.click();
      }
    };
  }

  /* ---------- resultado ---------- */

  function finish() {
    var results = run.items.map(function (item, i) {
      return { topic: item.topic, category: item.category, correct: run.answers[i].correct };
    });
    var summary = Core.summarize(results);

    var store = loadStore();
    store.history.unshift({ at: Date.now(), mode: run.mode, correct: summary.correct, total: summary.total });
    store.history = store.history.slice(0, MAX_HISTORY);
    saveStore(store);

    renderResults(summary);
  }

  function verdict(percent) {
    if (percent >= 85) return 'Excelente. Você domina o básico dessas vulnerabilidades.';
    if (percent >= 70) return 'Bom resultado. Revise as questões erradas abaixo.';
    if (percent >= 50) return 'Há lacunas. Leia as explicações e faça um novo sorteio.';
    return 'Comece pelas explicações abaixo e repita o tema.';
  }

  function breakdownTable(title, firstColumn, data, labelOf) {
    var keys = Object.keys(data);
    return h('div', null,
      h('h3', null, title),
      h('table', null,
        h('thead', null, h('tr', null,
          h('th', null, firstColumn),
          h('th', { className: 'num' }, 'Acertos')
        )),
        h('tbody', null, keys.map(function (key) {
          return h('tr', null,
            h('td', null, labelOf(key)),
            h('td', { className: 'num' }, data[key].correct + ' de ' + data[key].total)
          );
        }))
      )
    );
  }

  function answerList(item, indexes) {
    if (!indexes.length) return h('p', { className: 'muted' }, 'Nenhuma alternativa selecionada.');
    return h('ul', null, indexes.map(function (i) { return h('li', null, rich(item.options[i])); }));
  }

  function renderResults(summary) {
    document.title = 'Resultado — Cyber Quiz';

    var review = run.items.map(function (item, i) {
      var answer = run.answers[i];
      var status = !answer.selected.length ? 'Não respondida' : (answer.correct ? 'Acertou' : 'Errou');
      return h('details', { className: 'review-item', open: !answer.correct },
        h('summary', null,
          h('span', { className: answer.correct ? 'tag-ok' : 'tag-bad' }, (answer.correct ? '✓ ' : '✗ ') + status),
          ' · ' + (i + 1) + '. ',
          rich(item.question)
        ),
        h('div', { className: 'review-body' },
          h('p', { className: 'muted' },
            topics[item.topic].title + ' · ' + (CATEGORY_LABELS[item.category] || item.category)),
          h('p', null, h('strong', null, 'Sua resposta')),
          answerList(item, answer.selected),
          h('p', null, h('strong', null, 'Resposta correta')),
          answerList(item, item.correct),
          h('p', null, h('strong', null, 'Explicação: '), rich(item.explanation))
        )
      );
    });

    var repeatMode = run.mode;
    var repeatCount = run.items.length;
    var repeatFeedback = run.feedbackEach;

    mount(h('div', null,
      h('section', { className: 'card' },
        h('h1', { tabindex: '-1', 'data-autofocus': true }, 'Resultado'),
        h('p', { className: 'score' }, summary.correct + ' de ' + summary.total + ' (' + summary.percent + '%)'),
        h('p', null, verdict(summary.percent)),
        h('p', { className: 'muted' }, 'Tema: ' + modeLabel(repeatMode)),
        breakdownTable('Por tema', 'Tema', summary.byTopic, function (id) { return topics[id].title; }),
        breakdownTable('Por tipo de pergunta', 'Tipo', summary.byCategory, function (id) { return CATEGORY_LABELS[id] || id; }),
        h('div', { className: 'actions' },
          h('button', {
            type: 'button', className: 'btn btn-primary',
            onclick: function () { startRun(repeatMode, repeatCount, repeatFeedback); }
          }, 'Novo sorteio'),
          h('button', { type: 'button', className: 'btn btn-secondary', onclick: renderHome }, 'Voltar ao início')
        )
      ),
      h('section', null,
        h('h2', null, 'Revisão das questões'),
        review
      )
    ));
  }

  /* ---------- teclado: 1-9 escolhe a alternativa; Enter confirma ---------- */

  document.addEventListener('keydown', function (e) {
    if (!controls || e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (/^[1-9]$/.test(e.key)) {
      controls.toggle(parseInt(e.key, 10) - 1);
      e.preventDefault();
    } else if (e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') {
      controls.confirm();
      e.preventDefault();
    }
  });

  /* ---------- início ---------- */

  loadData().then(renderHome).catch(function (err) {
    var local = location.protocol === 'file:';
    mount(h('div', { className: 'notice', role: 'alert' },
      h('p', null, h('strong', null, 'Não foi possível carregar as questões.')),
      h('p', null, rich(local
        ? 'Você abriu o arquivo direto do disco. Rode `python3 -m http.server 8000` na pasta do projeto e acesse http://localhost:8000.'
        : 'Tente recarregar a página. Detalhe: ' + err.message))
    ));
  });
}());
