(function () {
  'use strict';

  var STORAGE_KEY = 'cyber-quiz:challenges:v1';
  var RUN_TIMEOUT_MS = 4000;
  var MAX_DRAFT = 40000;

  var TOPIC_LABELS = { idor: 'IDOR', csrf: 'CSRF', sqli: 'SQL Injection', ssrf: 'SSRF' };
  var DIFFICULTY_LABELS = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

  var app = document.getElementById('app');
  var index = null;
  var metas = {};
  var store = loadStore();
  var current = null; // desafio aberto

  /* ---------- DOM ---------- */

  function append(el, children) {
    children.forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) append(el, child);
      else if (typeof child === 'string' || typeof child === 'number') el.appendChild(document.createTextNode(String(child)));
      else el.appendChild(child);
    });
  }

  function h(tag, props) {
    var el = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'className') el.className = value;
        else if (key.indexOf('on') === 0 && typeof value === 'function') el.addEventListener(key.slice(2), value);
        else if (key === 'checked' || key === 'disabled' || key === 'value' || key === 'textContent') el[key] = value;
        else el.setAttribute(key, value === true ? '' : String(value));
      });
    }
    append(el, children);
    return el;
  }

  /** `código` e **negrito**, sem interpretar HTML. */
  function rich(text) {
    var frag = document.createDocumentFragment();
    String(text).split(/(`[^`]*`|\*\*[^*]+\*\*)/).forEach(function (part) {
      if (!part) return;
      if (part.charAt(0) === '`' && part.length > 1) {
        var code = document.createElement('code');
        code.textContent = part.slice(1, -1);
        frag.appendChild(code);
      } else if (part.indexOf('**') === 0 && part.length > 4) {
        var strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        frag.appendChild(strong);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    return frag;
  }

  function mount(node) {
    app.replaceChildren(node);
    var target = app.querySelector('[data-autofocus]');
    if (target) target.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ---------- armazenamento ---------- */

  function loadStore() {
    try {
      var data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
      if (data && typeof data === 'object') {
        return {
          solved: data.solved && typeof data.solved === 'object' ? data.solved : {},
          drafts: data.drafts && typeof data.drafts === 'object' ? data.drafts : {}
        };
      }
    } catch (e) { /* indisponível */ }
    return { solved: {}, drafts: {} };
  }

  function saveStore() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) { /* ignora */ }
  }

  /* ---------- carregamento ---------- */

  function fetchText(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Falha ao carregar ' + url + ' (' + res.status + ')');
      return res.text();
    });
  }

  function fetchJson(url) {
    return fetchText(url).then(function (text) { return JSON.parse(text); });
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    return fetchJson('data/challenges/index.json').then(function (data) {
      return Promise.all(data.challenges.map(function (id) {
        return fetchJson('data/challenges/' + id + '/challenge.json');
      })).then(function (all) {
        all.forEach(function (meta) { metas[meta.id] = meta; });
        index = data.challenges;
        return index;
      });
    });
  }

  function loadChallenge(id) {
    var base = 'data/challenges/' + id + '/';
    return Promise.all([
      fetchText(base + 'context.js'),
      fetchText(base + 'starter.js'),
      fetchText(base + 'tests.js'),
      fetchText(base + 'solution.js')
    ]).then(function (files) {
      return { meta: metas[id], context: files[0], starter: files[1], tests: files[2], solution: files[3] };
    });
  }

  function showError(err) {
    var isFile = window.location.protocol === 'file:';
    mount(h('div', { className: 'card' },
      h('h1', { tabindex: '-1', 'data-autofocus': true }, 'Não foi possível carregar os desafios'),
      h('p', null, isFile
        ? 'Abrir o arquivo direto do disco (file://) bloqueia o carregamento dos dados. Sirva a pasta com um servidor local, por exemplo: '
        : String(err && err.message ? err.message : err)),
      isFile ? h('p', null, h('code', null, 'python3 -m http.server 8000')) : null
    ));
  }

  /* ---------- lista ---------- */

  function chip(text, extra) { return h('span', { className: 'chip' + (extra ? ' ' + extra : '') }, text); }

  function renderList() {
    var solvedCount = index.filter(function (id) { return store.solved[id]; }).length;
    var groups = {};
    index.forEach(function (id) {
      var meta = metas[id];
      (groups[meta.topic] = groups[meta.topic] || []).push(meta);
    });

    var sections = Object.keys(TOPIC_LABELS).filter(function (t) { return groups[t]; }).map(function (topic) {
      return h('section', { className: 'topic-group', 'aria-labelledby': 'g-' + topic },
        h('h2', { id: 'g-' + topic }, TOPIC_LABELS[topic]),
        h('div', { className: 'challenge-grid' }, groups[topic].map(function (meta) {
          var solved = !!store.solved[meta.id];
          return h('a', { className: 'challenge-card' + (solved ? ' is-solved' : ''), href: '#/' + meta.id },
            h('span', { className: 'challenge-title' }, meta.title),
            h('span', { className: 'muted' }, meta.summary),
            h('span', { className: 'challenge-meta' },
              chip(DIFFICULTY_LABELS[meta.difficulty] || meta.difficulty),
              solved ? chip('✓ Resolvido', 'chip-ok') : chip('Pendente'))
          );
        })));
    });

    mount(h('div', null,
      h('h1', { tabindex: '-1', 'data-autofocus': true }, 'Desafios de correção de código'),
      h('p', null, 'Cada desafio traz um código vulnerável e um enunciado do que corrigir. Edite o código, rode os testes e só termina quando todos passam, inclusive os que garantem que o uso legítimo continua funcionando.'),
      h('p', { className: 'muted' }, solvedCount + ' de ' + index.length + ' desafios resolvidos neste navegador.'),
      sections
    ));
  }

  /* ---------- execução dos testes (Web Worker) ---------- */

  function runTests(job, done) {
    var finished = false;
    var worker;
    function finish(outcome) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (worker) worker.terminate();
      done(outcome);
    }
    try {
      worker = new Worker('assets/runner.js');
    } catch (e) {
      done({ loadError: 'Este navegador não conseguiu iniciar o Web Worker: ' + e.message, results: [] });
      return;
    }
    var timer = setTimeout(function () {
      finish({ loadError: 'Tempo esgotado (' + (RUN_TIMEOUT_MS / 1000) + ' s). Há um laço infinito no código?', results: [] });
    }, RUN_TIMEOUT_MS);
    worker.onmessage = function (event) { finish(event.data); };
    worker.onerror = function (event) {
      finish({ loadError: 'Erro ao executar: ' + (event.message || 'desconhecido'), results: [] });
    };
    worker.postMessage(job);
  }

  /* ---------- tela do desafio ---------- */

  function renderChallenge(data) {
    var meta = data.meta;
    current = data;
    var draft = store.drafts[meta.id];
    var startCode = typeof draft === 'string' ? draft : data.starter;

    var editor = h('textarea', {
      className: 'code-editor', id: 'code', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off',
      'aria-label': 'Código do desafio (JavaScript)', 'aria-describedby': 'editor-help', wrap: 'off'
    });
    editor.value = startCode;

    var results = h('div', { className: 'results', 'aria-live': 'polite' },
      h('p', { className: 'muted' }, 'Os resultados dos testes aparecem aqui.'));
    var runButton = h('button', { type: 'button', className: 'btn btn-primary' }, 'Executar testes');
    var resetButton = h('button', { type: 'button', className: 'btn btn-secondary' }, 'Restaurar código original');

    var trapTab = true;
    var saveTimer = null;

    function persistDraft() {
      if (editor.value === data.starter) delete store.drafts[meta.id];
      else if (editor.value.length <= MAX_DRAFT) store.drafts[meta.id] = editor.value;
      saveStore();
    }

    editor.addEventListener('input', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistDraft, 400);
    });

    editor.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        execute();
        return;
      }
      if (e.key === 'Escape') { trapTab = false; return; }
      if (e.key === 'Tab' && trapTab && !e.shiftKey) {
        e.preventDefault();
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        persistDraft();
        return;
      }
      if (e.key !== 'Tab' && e.key !== 'Shift') trapTab = true;
    });

    function renderResults(outcome, code) {
      if (outcome.loadError) {
        results.replaceChildren(h('div', { className: 'feedback bad', role: 'alert' },
          h('strong', null, 'Não foi possível rodar os testes'),
          h('pre', { className: 'error-text' }, outcome.loadError)));
        return;
      }
      var total = outcome.results.length;
      var passed = outcome.results.filter(function (r) { return r.ok; }).length;
      var all = passed === total && total > 0;
      var nodes = [
        h('p', { className: 'results-summary ' + (all ? 'ok' : 'bad') },
          (all ? '✓ ' : '✗ ') + passed + ' de ' + total + ' testes passaram'),
        h('ul', { className: 'test-list' }, outcome.results.map(function (r) {
          return h('li', { className: r.ok ? 'test-ok' : 'test-bad' },
            h('span', { className: 'test-mark', 'aria-hidden': 'true' }, r.ok ? '✓' : '✗'),
            h('span', { className: 'test-body' },
              h('span', { className: 'visually-hidden' }, r.ok ? 'Passou: ' : 'Falhou: '),
              h('span', { className: 'test-name' }, r.name),
              r.ok ? null : h('span', { className: 'test-msg' }, r.message)));
        }))
      ];
      if (all) {
        var firstTime = !store.solved[meta.id];
        if (code !== data.starter) {
          store.solved[meta.id] = store.solved[meta.id] || Date.now();
          saveStore();
        }
        nodes.unshift(h('div', { className: 'feedback ok', role: 'status' },
          h('strong', null, 'Desafio resolvido!'),
          h('span', null, rich(meta.explanation)),
          firstTime ? h('span', { className: 'muted' }, 'Progresso salvo neste navegador.') : null));
      }
      results.replaceChildren.apply(results, nodes);
    }

    function execute() {
      var code = editor.value;
      runButton.disabled = true;
      runButton.textContent = 'Executando…';
      results.replaceChildren(h('p', { className: 'muted' }, 'Executando os testes…'));
      persistDraft();
      runTests({
        context: data.context,
        code: code,
        tests: data.tests,
        exports: meta.exports,
        expose: meta.expose
      }, function (outcome) {
        runButton.disabled = false;
        runButton.textContent = 'Executar testes';
        renderResults(outcome, code);
      });
    }

    runButton.addEventListener('click', execute);

    var resetTimer = null;
    resetButton.addEventListener('click', function () {
      if (!resetButton.getAttribute('data-confirm')) {
        resetButton.setAttribute('data-confirm', '1');
        resetButton.textContent = 'Confirmar: descartar minhas alterações';
        resetTimer = setTimeout(function () {
          resetButton.removeAttribute('data-confirm');
          resetButton.textContent = 'Restaurar código original';
        }, 4000);
        return;
      }
      clearTimeout(resetTimer);
      resetButton.removeAttribute('data-confirm');
      resetButton.textContent = 'Restaurar código original';
      editor.value = data.starter;
      persistDraft();
      results.replaceChildren(h('p', { className: 'muted' }, 'Código original restaurado.'));
      editor.focus();
    });

    /* painel esquerdo */
    var statement = meta.statement.map(function (block) {
      if (block.type === 'ul') return h('ul', null, block.items.map(function (item) { return h('li', null, rich(item)); }));
      return h('p', null, rich(block.text));
    });

    var hintsShown = 0;
    var hintList = h('ol', { className: 'hints' });
    var hintButton = h('button', { type: 'button', className: 'btn btn-secondary btn-small' }, 'Mostrar dica 1 de ' + meta.hints.length);
    hintButton.addEventListener('click', function () {
      hintList.appendChild(h('li', null, rich(meta.hints[hintsShown])));
      hintsShown++;
      if (hintsShown >= meta.hints.length) hintButton.remove();
      else hintButton.textContent = 'Mostrar dica ' + (hintsShown + 1) + ' de ' + meta.hints.length;
    });

    var solutionBox = h('div', { 'aria-live': 'polite' });
    var solutionButton = h('button', { type: 'button', className: 'btn btn-secondary btn-small' }, 'Ver a solução');
    var solutionTimer = null;
    solutionButton.addEventListener('click', function () {
      if (!solutionButton.getAttribute('data-confirm')) {
        solutionButton.setAttribute('data-confirm', '1');
        solutionButton.textContent = 'Tem certeza? Tente as dicas antes. Clique para revelar';
        solutionTimer = setTimeout(function () {
          solutionButton.removeAttribute('data-confirm');
          solutionButton.textContent = 'Ver a solução';
        }, 5000);
        return;
      }
      clearTimeout(solutionTimer);
      solutionButton.remove();
      solutionBox.appendChild(h('pre', { className: 'code-block' }, h('code', null, data.solution)));
      solutionBox.appendChild(h('p', null, rich(meta.explanation)));
    });

    var left = h('section', { className: 'pane pane-statement', 'aria-labelledby': 'challenge-title' },
      h('a', { className: 'back-link', href: '#/' }, '← Todos os desafios'),
      h('h1', { id: 'challenge-title', tabindex: '-1', 'data-autofocus': true }, meta.title),
      h('p', { className: 'chips' },
        chip(TOPIC_LABELS[meta.topic] || meta.topic),
        chip(DIFFICULTY_LABELS[meta.difficulty] || meta.difficulty),
        store.solved[meta.id] ? chip('✓ Resolvido', 'chip-ok') : null),
      h('p', { className: 'muted owasp' }, 'OWASP: ' + meta.owasp),
      h('div', { className: 'statement' }, statement),
      h('details', null, h('summary', null, 'Dicas'), hintList, hintButton),
      h('details', null,
        h('summary', null, 'Contexto da aplicação (somente leitura)'),
        h('pre', { className: 'code-block' }, h('code', null, data.context))),
      h('details', null, h('summary', null, 'Solução'), solutionBox, solutionButton)
    );

    var right = h('section', { className: 'pane pane-editor', 'aria-label': 'Código e testes' },
      h('div', { className: 'editor-bar' },
        h('label', { className: 'editor-title', 'for': 'code' }, 'vulnerable.js'),
        h('div', { className: 'editor-actions' }, resetButton, runButton)),
      editor,
      h('p', { id: 'editor-help', className: 'muted small' },
        'Ctrl/⌘ + Enter executa os testes. A tecla Tab insere espaços; para sair do editor com o teclado, pressione Esc e depois Tab.'),
      results
    );

    mount(h('div', { className: 'split' }, left, right));
  }

  /* ---------- rotas ---------- */

  function route() {
    var id = window.location.hash.replace(/^#\/?/, '');
    loadIndex().then(function () {
      if (!id) {
        current = null;
        document.title = 'Desafios de correção — Cyber Quiz';
        renderList();
        return null;
      }
      if (!metas[id]) {
        window.location.hash = '#/';
        return null;
      }
      document.title = metas[id].title + ' — Desafios — Cyber Quiz';
      return loadChallenge(id).then(renderChallenge);
    }).catch(showError);
  }

  window.addEventListener('hashchange', route);
  route();
}());
