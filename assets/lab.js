(function () {
  'use strict';

  var STORAGE_KEY = 'cyber-quiz:labs:v1';
  var VENDOR = 'lab/vendor/';
  var DIFFICULTY_LABELS = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
  var MEMORY_MB = 256;
  var COLS = 80;
  var ROWS = 24;

  var app = document.getElementById('app');
  var index = null;
  var metas = {};
  var store = loadStore();
  var session = null;            // laboratório aberto (emulador + terminal)
  var assetCache = {};           // arquivos grandes baixados uma vez

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
        else if (key === 'checked' || key === 'disabled' || key === 'value') el[key] = value;
        else el.setAttribute(key, value === true ? '' : String(value));
      });
    }
    append(el, children);
    return el;
  }

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

  function chip(text, extra) { return h('span', { className: 'chip' + (extra ? ' ' + extra : '') }, text); }

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
      if (data && typeof data === 'object' && data.solved && typeof data.solved === 'object') return { solved: data.solved };
    } catch (e) { /* indisponível */ }
    return { solved: {} };
  }

  function saveStore() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) { /* ignora */ }
  }

  /* ---------- rede ---------- */

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Falha ao carregar ' + url + ' (' + res.status + ')');
      return res.json();
    });
  }

  function fetchBuffer(url, onProgress) {
    if (assetCache[url]) return Promise.resolve(assetCache[url]);
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Falha ao baixar ' + url + ' (' + res.status + ')');
      var total = parseInt(res.headers.get('content-length') || '0', 10);
      if (!res.body || !res.body.getReader) return res.arrayBuffer();
      var reader = res.body.getReader();
      var chunks = [];
      var received = 0;
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) return;
          chunks.push(step.value);
          received += step.value.length;
          if (onProgress) onProgress(received, total);
          return pump();
        });
      }
      return pump().then(function () {
        var all = new Uint8Array(received);
        var offset = 0;
        chunks.forEach(function (c) { all.set(c, offset); offset += c.length; });
        return all.buffer;
      });
    }).then(function (buffer) {
      assetCache[url] = buffer;
      return buffer;
    });
  }

  var scriptPromises = {};
  function loadScript(src) {
    if (!scriptPromises[src]) {
      scriptPromises[src] = new Promise(function (resolve, reject) {
        var el = document.createElement('script');
        el.src = src;
        el.onload = resolve;
        el.onerror = function () { reject(new Error('Não foi possível carregar ' + src + '. Rode scripts/build_lab.py para baixar as dependências.')); };
        document.head.appendChild(el);
      });
    }
    return scriptPromises[src];
  }

  function concatBuffers(a, b) {
    var out = new Uint8Array(a.byteLength + b.byteLength);
    out.set(new Uint8Array(a), 0);
    out.set(new Uint8Array(b), a.byteLength);
    return out.buffer;
  }

  function sha256Hex(text) {
    if (!window.crypto || !window.crypto.subtle) return Promise.reject(new Error('Este navegador não oferece SHA-256 (use https ou localhost).'));
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  /* ---------- carregamento ---------- */

  function loadIndex() {
    if (index) return Promise.resolve(index);
    return fetchJson('data/labs/index.json').then(function (data) {
      return Promise.all(data.labs.map(function (id) { return fetchJson('data/labs/' + id + '/lab.json'); })).then(function (all) {
        all.forEach(function (m) { metas[m.id] = m; });
        index = data.labs;
        return index;
      });
    });
  }

  function showError(err) {
    var isFile = window.location.protocol === 'file:';
    mount(h('div', { className: 'card' },
      h('h1', { tabindex: '-1', 'data-autofocus': true }, 'Não foi possível carregar o laboratório'),
      h('p', null, isFile ? 'Abrir direto do disco (file://) bloqueia o carregamento. Sirva a pasta com: ' : String(err && err.message ? err.message : err)),
      isFile ? h('p', null, h('code', null, 'python3 -m http.server 8000')) : null));
  }

  /* ---------- lista ---------- */

  function renderList() {
    var solved = index.filter(function (id) { return store.solved[id]; }).length;
    mount(h('div', null,
      h('h1', { tabindex: '-1', 'data-autofocus': true }, 'Laboratório de CTF'),
      h('p', null, 'Cada laboratório abre um Linux de verdade, dentro do navegador, com um objetivo e uma flag. O enunciado fica de um lado e o terminal do outro. Nada é enviado a servidores e não há acesso à internet.'),
      h('p', { className: 'muted' }, solved + ' de ' + index.length + ' laboratórios resolvidos neste navegador. A primeira execução baixa cerca de 35 MB (depois fica em cache) e usa cerca de ' + MEMORY_MB + ' MB de memória.'),
      h('div', { className: 'challenge-grid' }, index.map(function (id) {
        var m = metas[id];
        var done = !!store.solved[id];
        return h('a', { className: 'challenge-card' + (done ? ' is-solved' : ''), href: '#/' + id },
          h('span', { className: 'challenge-title' }, m.title),
          h('span', { className: 'muted' }, m.summary),
          h('span', { className: 'challenge-meta' },
            chip(DIFFICULTY_LABELS[m.difficulty] || m.difficulty),
            chip(m.category),
            done ? chip('✓ Resolvido', 'chip-ok') : chip('Pendente')));
      }))));
  }

  /* ---------- sessão da VM ---------- */

  function destroySession() {
    if (!session) return;
    var s = session;
    session = null;
    s.dead = true;
    if (s.raf) cancelAnimationFrame(s.raf);
    try { if (s.emulator) s.emulator.destroy(); } catch (e) { /* ignora */ }
    try { if (s.term) s.term.dispose(); } catch (e) { /* ignora */ }
  }

  function formatMB(n) { return (n / 1048576).toFixed(1) + ' MB'; }

  function startVm(meta, ui) {
    destroySession();
    var s = { dead: false, emulator: null, term: null, raf: 0, pending: [] };
    session = s;
    ui.startButton.disabled = true;
    ui.restartButton.disabled = true;
    ui.termBox.replaceChildren();
    ui.status('Carregando componentes…');

    var progress = {};
    function report() {
      var received = 0;
      var total = 0;
      Object.keys(progress).forEach(function (k) { received += progress[k][0]; total += progress[k][1]; });
      ui.status('Baixando o sistema… ' + formatMB(received) + (total ? ' de ' + formatMB(total) : ''));
    }
    function dl(name, url) {
      return fetchBuffer(url, function (got, total) { progress[name] = [got, total]; report(); });
    }

    Promise.all([
      loadScript(VENDOR + 'libv86.js'),
      loadScript(VENDOR + 'xterm.js')
    ]).then(function () {
      return Promise.all([
        dl('bzimage', VENDOR + 'bzimage'),
        dl('initrd', VENDOR + 'initrd.img'),
        dl('bios', VENDOR + 'seabios.bin'),
        dl('vga', VENDOR + 'vgabios.bin'),
        fetchBuffer('lab/overlays/' + meta.id + '.cpio.gz')
      ]);
    }).then(function (files) {
      if (s.dead) return;
      ui.status('Iniciando o Linux…');

      // Ajusta a fonte para as 80 colunas caberem na largura do painel (largura do caractere ~ 0,6 x fonte).
      var avail = (ui.termBox.parentElement ? ui.termBox.parentElement.clientWidth : 640) - 40 - 16;
      var fontSize = Math.max(10, Math.min(15, Math.floor(avail / (COLS * 0.602))));
      var term = new window.Terminal({
        cols: COLS, rows: ROWS, fontSize: fontSize, cursorBlink: true, scrollback: 2000,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        theme: { background: '#0b0f14', foreground: '#d8dee9' },
        allowProposedApi: false
      });
      s.term = term;
      term.open(ui.termBox);

      var emulator = new window.V86({
        wasm_path: VENDOR + 'v86.wasm',
        bios: { buffer: files[2] },
        vga_bios: { buffer: files[3] },
        bzimage: { buffer: files[0] },
        initrd: { buffer: concatBuffers(files[1], files[4]) },
        cmdline: 'console=ttyS0,115200 quiet loglevel=3 rdinit=/init panic=-1 acpi=off pci=nomsi',
        memory_size: MEMORY_MB * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        autostart: true,
        disable_keyboard: true,
        disable_mouse: true,
        disable_speaker: true
      });
      s.emulator = emulator;

      var ready = false;
      var tail = '';
      emulator.add_listener('serial0-output-byte', function (byte) {
        s.pending.push(byte);
        tail = (tail + String.fromCharCode(byte)).slice(-40);
        if (!ready && tail.indexOf('agent@lab') !== -1) {
          ready = true;
          ui.status('Pronto. O terminal está ativo: clique nele e digite.');
          ui.restartButton.disabled = false;
          term.focus();
        }
        if (!s.raf) {
          s.raf = requestAnimationFrame(function () {
            s.raf = 0;
            if (s.dead || !s.pending.length) return;
            term.write(new Uint8Array(s.pending));
            s.pending = [];
          });
        }
      });
      term.onData(function (data) {
        if (ready && !s.dead) emulator.serial0_send(data);
      });
      ui.startButton.textContent = 'Parar';
      ui.startButton.disabled = false;
      ui.running = true;
      ui.restartButton.disabled = false;
    }).catch(function (err) {
      if (s.dead) return;
      ui.status('Erro: ' + (err && err.message ? err.message : err), true);
      ui.startButton.disabled = false;
      ui.restartButton.disabled = false;
      ui.startButton.textContent = 'Iniciar laboratório';
      ui.running = false;
    });
  }

  /* ---------- tela do laboratório ---------- */

  function renderLab(meta) {
    destroySession();

    var statusEl = h('p', { className: 'muted small lab-status', role: 'status', 'aria-live': 'polite' }, 'Clique em "Iniciar laboratório" para ligar o Linux.');
    var termBox = h('div', { className: 'terminal-box', 'aria-label': 'Terminal do laboratório' });
    var startButton = h('button', { type: 'button', className: 'btn btn-primary' }, 'Iniciar laboratório');
    var restartButton = h('button', { type: 'button', className: 'btn btn-secondary', disabled: true }, 'Reiniciar do zero');

    var ui = {
      termBox: termBox, startButton: startButton, restartButton: restartButton, running: false,
      status: function (text, bad) {
        statusEl.textContent = text;
        statusEl.className = 'small lab-status ' + (bad ? 'bad-text' : 'muted');
      }
    };

    startButton.addEventListener('click', function () {
      if (ui.running) {
        destroySession();
        termBox.replaceChildren();
        ui.running = false;
        startButton.textContent = 'Iniciar laboratório';
        restartButton.disabled = true;
        ui.status('Laboratório parado. Clique em "Iniciar laboratório" para ligar de novo.');
      } else {
        startVm(meta, ui);
      }
    });
    restartButton.addEventListener('click', function () { startVm(meta, ui); });

    /* flag */
    var flagInput = h('input', { type: 'text', id: 'flag', className: 'flag-input', placeholder: meta.flagFormat, autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'flag-help' });
    var flagResult = h('div', { 'aria-live': 'polite' });
    var flagForm = h('form', { className: 'flag-form', onsubmit: function (e) {
      e.preventDefault();
      var value = flagInput.value.trim();
      if (!value) { flagResult.replaceChildren(h('p', { className: 'bad-text' }, 'Digite a flag.')); return; }
      sha256Hex(value).then(function (hex) {
        if (hex === meta.flagSha256) {
          var first = !store.solved[meta.id];
          store.solved[meta.id] = store.solved[meta.id] || Date.now();
          saveStore();
          flagResult.replaceChildren(h('div', { className: 'feedback ok', role: 'status' },
            h('strong', null, 'Flag correta! Laboratório resolvido.'),
            h('span', null, rich(meta.explanation)),
            first ? h('span', { className: 'muted' }, 'Progresso salvo neste navegador.') : null));
        } else {
          flagResult.replaceChildren(h('div', { className: 'feedback bad', role: 'alert' },
            h('strong', null, 'Flag incorreta.'),
            h('span', null, 'Confira o formato (' + meta.flagFormat + ') e tente de novo.')));
        }
      }).catch(function (err) {
        flagResult.replaceChildren(h('div', { className: 'feedback bad', role: 'alert' }, h('strong', null, 'Erro'), h('span', null, err.message)));
      });
    } },
      h('label', { 'for': 'flag' }, 'Flag'),
      h('div', { className: 'flag-row' }, flagInput, h('button', { type: 'submit', className: 'btn btn-primary' }, 'Verificar')),
      h('p', { id: 'flag-help', className: 'muted small' }, 'Formato: ' + meta.flagFormat));

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

    var left = h('section', { className: 'pane pane-statement', 'aria-labelledby': 'lab-title' },
      h('a', { className: 'back-link', href: '#/' }, '← Todos os laboratórios'),
      h('h1', { id: 'lab-title', tabindex: '-1', 'data-autofocus': true }, meta.title),
      h('p', { className: 'chips' },
        chip(DIFFICULTY_LABELS[meta.difficulty] || meta.difficulty), chip(meta.category),
        store.solved[meta.id] ? chip('✓ Resolvido', 'chip-ok') : null),
      h('div', { className: 'statement' }, statement),
      h('details', null, h('summary', null, 'Dicas'), hintList, hintButton));

    var right = h('section', { className: 'pane pane-editor pane-lab', 'aria-label': 'Terminal e flag' },
      h('div', { className: 'editor-bar' },
        h('span', { className: 'editor-title' }, 'agent@lab (Alpine Linux, ' + MEMORY_MB + ' MB)'),
        h('div', { className: 'editor-actions' }, restartButton, startButton)),
      statusEl,
      termBox,
      flagForm,
      flagResult);

    mount(h('div', { className: 'split' }, left, right));
  }

  /* ---------- rotas ---------- */

  function route() {
    var id = window.location.hash.replace(/^#\/?/, '');
    loadIndex().then(function () {
      if (!id) {
        destroySession();
        document.title = 'Laboratório — Cyber Quiz';
        renderList();
      } else if (!metas[id]) {
        window.location.hash = '#/';
      } else {
        document.title = metas[id].title + ' — Laboratório — Cyber Quiz';
        renderLab(metas[id]);
      }
    }).catch(showError);
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', destroySession);
  route();
}());
