/*
 * Mini banco SQL em memória, só para os desafios.
 *
 * Interpreta um subconjunto de SQL de verdade (aspas, comentários, AND/OR, LIKE,
 * UNION, ORDER BY, LIMIT e placeholders `?`). Por isso uma consulta montada com
 * concatenação sofre injeção como num banco real, e uma consulta parametrizada
 * trata o valor sempre como dado.
 *
 * Não é um banco de verdade: não use para nada além de estudo.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MiniSql = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEYWORDS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'LIKE', 'ORDER', 'BY', 'ASC', 'DESC',
    'LIMIT', 'UNION', 'ALL', 'NULL', 'IS', 'AS'];

  function SqlError(message) {
    var e = new Error('SQL: ' + message);
    e.name = 'SqlError';
    return e;
  }

  function tokenize(sql) {
    var tokens = [];
    var i = 0;
    var n = sql.length;
    var placeholders = 0;
    while (i < n) {
      var c = sql[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '-' && sql[i + 1] === '-') {
        while (i < n && sql[i] !== '\n') i++;
        continue;
      }
      if (c === '#') {
        while (i < n && sql[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && sql[i + 1] === '*') {
        var end = sql.indexOf('*/', i + 2);
        if (end === -1) throw SqlError('comentário não terminado');
        i = end + 2;
        continue;
      }
      if (c === "'") {
        var value = '';
        i++;
        var closed = false;
        while (i < n) {
          if (sql[i] === "'") {
            if (sql[i + 1] === "'") { value += "'"; i += 2; continue; }
            closed = true;
            i++;
            break;
          }
          value += sql[i++];
        }
        if (!closed) throw SqlError('string não terminada (aspa aberta)');
        tokens.push({ t: 'str', v: value });
        continue;
      }
      var m;
      if ((m = /^\d+(\.\d+)?/.exec(sql.slice(i)))) {
        tokens.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i)))) {
        var upper = m[0].toUpperCase();
        if (KEYWORDS.indexOf(upper) !== -1) tokens.push({ t: 'kw', v: upper });
        else tokens.push({ t: 'id', v: m[0].toLowerCase() });
        i += m[0].length;
        continue;
      }
      if (c === '?') { tokens.push({ t: 'ph', v: placeholders++ }); i++; continue; }
      if ((m = /^(<>|!=|<=|>=|=|<|>)/.exec(sql.slice(i)))) {
        tokens.push({ t: 'op', v: m[0] === '!=' ? '<>' : m[0] });
        i += m[0].length;
        continue;
      }
      if ('(),*;.'.indexOf(c) !== -1) { tokens.push({ t: 'p', v: c }); i++; continue; }
      throw SqlError('caractere inesperado "' + c + '"');
    }
    return tokens;
  }

  function Parser(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  Parser.prototype.peek = function () { return this.tokens[this.pos]; };
  Parser.prototype.next = function () { return this.tokens[this.pos++]; };
  Parser.prototype.isKw = function (kw) {
    var t = this.peek();
    return !!t && t.t === 'kw' && t.v === kw;
  };
  Parser.prototype.isP = function (p) {
    var t = this.peek();
    return !!t && t.t === 'p' && t.v === p;
  };
  Parser.prototype.expectKw = function (kw) {
    if (!this.isKw(kw)) throw SqlError('esperado ' + kw + (this.peek() ? ' perto de "' + this.peek().v + '"' : ' no fim da consulta'));
    this.pos++;
  };

  Parser.prototype.parseStatement = function () {
    var selects = [this.parseSelect()];
    var dedupe = false;
    while (this.isKw('UNION')) {
      this.pos++;
      if (this.isKw('ALL')) this.pos++; else dedupe = true;
      selects.push(this.parseSelect());
    }
    if (this.isP(';')) this.pos++;
    if (this.peek()) {
      if (this.tokens[this.pos - 1] && this.tokens[this.pos - 1].v === ';') {
        throw SqlError('várias instruções na mesma consulta não são permitidas');
      }
      throw SqlError('sintaxe inválida perto de "' + this.peek().v + '"');
    }
    return { selects: selects, dedupe: dedupe };
  };

  Parser.prototype.parseSelect = function () {
    this.expectKw('SELECT');
    var cols = [];
    if (this.isP('*')) {
      this.pos++;
      cols.push({ star: true });
    } else {
      do {
        if (this.isP(',')) this.pos++;
        var t = this.next();
        if (!t) throw SqlError('lista de colunas incompleta');
        if (t.t === 'id') cols.push({ id: t.v });
        else if (t.t === 'num' || t.t === 'str') cols.push({ literal: t.v, label: String(t.v) });
        else if (t.t === 'kw' && t.v === 'NULL') cols.push({ literal: null, label: 'null' });
        else throw SqlError('coluna inválida perto de "' + t.v + '"');
      } while (this.isP(','));
    }
    this.expectKw('FROM');
    var table = this.next();
    if (!table || table.t !== 'id') throw SqlError('nome de tabela esperado');
    var sel = { cols: cols, table: table.v, where: null, orderBy: null, desc: false, limit: null };
    if (this.isKw('WHERE')) { this.pos++; sel.where = this.parseOr(); }
    if (this.isKw('ORDER')) {
      this.pos++;
      this.expectKw('BY');
      var col = this.next();
      if (!col || col.t !== 'id') throw SqlError('coluna esperada em ORDER BY');
      sel.orderBy = col.v;
      if (this.isKw('DESC')) { this.pos++; sel.desc = true; } else if (this.isKw('ASC')) this.pos++;
    }
    if (this.isKw('LIMIT')) {
      this.pos++;
      var lim = this.next();
      if (!lim || lim.t !== 'num') throw SqlError('número esperado em LIMIT');
      sel.limit = lim.v;
    }
    return sel;
  };

  Parser.prototype.parseOr = function () {
    var left = this.parseAnd();
    while (this.isKw('OR')) {
      this.pos++;
      left = { op: 'or', a: left, b: this.parseAnd() };
    }
    return left;
  };
  Parser.prototype.parseAnd = function () {
    var left = this.parseNot();
    while (this.isKw('AND')) {
      this.pos++;
      left = { op: 'and', a: left, b: this.parseNot() };
    }
    return left;
  };
  Parser.prototype.parseNot = function () {
    if (this.isKw('NOT')) { this.pos++; return { op: 'not', a: this.parseNot() }; }
    return this.parseCmp();
  };
  Parser.prototype.parseCmp = function () {
    var left = this.parseOperand();
    var t = this.peek();
    if (t && t.t === 'op') {
      this.pos++;
      return { op: t.v, a: left, b: this.parseOperand() };
    }
    if (this.isKw('LIKE')) { this.pos++; return { op: 'like', a: left, b: this.parseOperand() }; }
    if (this.isKw('IS')) {
      this.pos++;
      var negate = false;
      if (this.isKw('NOT')) { this.pos++; negate = true; }
      this.expectKw('NULL');
      return { op: 'isnull', a: left, negate: negate };
    }
    return { op: 'truthy', a: left };
  };
  Parser.prototype.parseOperand = function () {
    var t = this.next();
    if (!t) throw SqlError('expressão incompleta');
    if (t.t === 'p' && t.v === '(') {
      var e = this.parseOr();
      if (!this.isP(')')) throw SqlError('parêntese não fechado');
      this.pos++;
      return e;
    }
    if (t.t === 'str' || t.t === 'num') return { lit: t.v };
    if (t.t === 'id') return { col: t.v };
    if (t.t === 'ph') return { ph: t.v };
    if (t.t === 'kw' && t.v === 'NULL') return { lit: null };
    throw SqlError('expressão inválida perto de "' + t.v + '"');
  };

  function numeric(v) { return typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))); }

  function evalNode(node, row, params) {
    if ('lit' in node) return node.lit;
    if ('ph' in node) {
      if (node.ph >= params.length) throw SqlError('faltam parâmetros para os placeholders (?)');
      return params[node.ph];
    }
    if ('col' in node) {
      if (!Object.prototype.hasOwnProperty.call(row, node.col)) throw SqlError('coluna inexistente: ' + node.col);
      return row[node.col];
    }
    var a;
    var b;
    switch (node.op) {
      case 'or': return !!(evalNode(node.a, row, params) || evalNode(node.b, row, params));
      case 'and': return !!(evalNode(node.a, row, params) && evalNode(node.b, row, params));
      case 'not': return !evalNode(node.a, row, params);
      case 'truthy': return !!evalNode(node.a, row, params);
      case 'isnull':
        a = evalNode(node.a, row, params);
        return node.negate ? a !== null && a !== undefined : a === null || a === undefined;
      case 'like':
        a = evalNode(node.a, row, params);
        b = evalNode(node.b, row, params);
        if (a === null || b === null || a === undefined || b === undefined) return false;
        var re = '^' + String(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$';
        return new RegExp(re, 'is').test(String(a));
      default:
        a = evalNode(node.a, row, params);
        b = evalNode(node.b, row, params);
        if (a === null || b === null || a === undefined || b === undefined) return false;
        if (node.op === '=') return String(a) === String(b);
        if (node.op === '<>') return String(a) !== String(b);
        var x = numeric(a) && numeric(b) ? Number(a) : String(a);
        var y = numeric(a) && numeric(b) ? Number(b) : String(b);
        if (node.op === '<') return x < y;
        if (node.op === '>') return x > y;
        if (node.op === '<=') return x <= y;
        return x >= y;
    }
  }

  function runSelect(sel, tables, params) {
    var source = tables[sel.table];
    if (!source) throw SqlError('tabela inexistente: ' + sel.table);
    var rows = source.filter(function (row) { return sel.where ? evalNode(sel.where, row, params) : true; });
    if (sel.orderBy) {
      rows = rows.slice();
      rows.forEach(function (row) {
        if (!Object.prototype.hasOwnProperty.call(row, sel.orderBy)) throw SqlError('coluna inexistente: ' + sel.orderBy);
      });
      rows.sort(function (r1, r2) {
        var a = r1[sel.orderBy];
        var b = r2[sel.orderBy];
        var cmp = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
        return sel.desc ? -cmp : cmp;
      });
    }
    if (sel.limit !== null) rows = rows.slice(0, sel.limit);
    var labels = [];
    sel.cols.forEach(function (col) {
      if (col.star) {
        Object.keys(source[0] || {}).forEach(function (k) { labels.push(k); });
      } else {
        labels.push(col.id || col.label);
      }
    });
    var projected = rows.map(function (row) {
      var values = [];
      sel.cols.forEach(function (col) {
        if (col.star) Object.keys(row).forEach(function (k) { values.push(row[k]); });
        else if ('literal' in col) values.push(col.literal);
        else if (!Object.prototype.hasOwnProperty.call(row, col.id)) throw SqlError('coluna inexistente: ' + col.id);
        else values.push(row[col.id]);
      });
      return values;
    });
    return { labels: labels, rows: projected };
  }

  function createDatabase(data) {
    var tables = {};
    Object.keys(data).forEach(function (name) {
      tables[name.toLowerCase()] = data[name].map(function (row) {
        var copy = {};
        Object.keys(row).forEach(function (k) { copy[k.toLowerCase()] = row[k]; });
        return copy;
      });
    });
    var log = [];
    return {
      log: log,
      query: function (sql, params) {
        params = params || [];
        log.push({ sql: String(sql), params: params.slice() });
        var stmt = new Parser(tokenize(String(sql))).parseStatement();
        var results = stmt.selects.map(function (sel) { return runSelect(sel, tables, params); });
        var first = results[0];
        var all = first.rows.slice();
        for (var i = 1; i < results.length; i++) {
          if (results[i].labels.length !== first.labels.length) {
            throw SqlError('os SELECTs do UNION têm números diferentes de colunas');
          }
          all = all.concat(results[i].rows);
        }
        if (stmt.dedupe) {
          var seen = {};
          all = all.filter(function (r) {
            var key = JSON.stringify(r);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
          });
        }
        return all.map(function (values) {
          var obj = {};
          first.labels.forEach(function (label, idx) { obj[label] = values[idx]; });
          return obj;
        });
      }
    };
  }

  return { createDatabase: createDatabase, SqlError: SqlError };
}));
