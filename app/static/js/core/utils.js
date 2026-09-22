/* =============================================================================
   УТИЛИТЫ: DOM, форматирование, даты, числа
   Глобальное пространство имён App — модули подключаются обычными <script>,
   поэтому приложение работает и без сервера (открытием index.html).
   ========================================================================== */
window.App = window.App || {};

(function (App) {
  'use strict';

  /* --- DOM ---------------------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  /**
   * Создание элемента: el('div.card', {onclick}, [children])
   * Поддерживает css-подобный селектор в теге: 'div.a.b#id'
   */
  function el(tag, attrs, children) {
    const parts = String(tag).split(/([.#])/);
    const node = document.createElement(parts[0] || 'div');
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i] === '.') node.classList.add(parts[i + 1]);
      else node.id = parts[i + 1];
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined || children === false) return node;
    if (Array.isArray(children)) {
      children.forEach(function (c) { append(node, c); });
    } else if (children instanceof Node) {
      node.appendChild(children);
    } else {
      node.appendChild(document.createTextNode(String(children)));
    }
    return node;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* --- Числа и деньги ------------------------------------------------------ */
  function num(v, digits) {
    const n = Number(v || 0);
    const d = digits === undefined ? 2 : digits;
    return n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function money(v, opts) {
    const o = opts || {};
    const cur = o.currency || (App.Store && App.Store.settings && App.Store.settings().currency) || 'сом';
    const digits = o.digits === undefined ? (Math.abs(v) >= 1000 ? 0 : 2) : o.digits;
    return num(v, digits) + ' ' + cur;
  }

  /** Компактный формат для KPI: 1 234 567 → 1,23 млн */
  function moneyShort(v) {
    const cur = (App.Store && App.Store.settings && App.Store.settings().currency) || 'сом';
    const a = Math.abs(v || 0);
    const sign = v < 0 ? '−' : '';
    if (a >= 1e9) return sign + num(a / 1e9, 2) + ' млрд ' + cur;
    if (a >= 1e6) return sign + num(a / 1e6, 2) + ' млн ' + cur;
    if (a >= 1e4) return sign + num(a / 1e3, 0) + ' тыс ' + cur;
    return sign + num(a, 0) + ' ' + cur;
  }

  function pct(v, digits) { return num(v, digits === undefined ? 1 : digits) + '%'; }

  function round(v, d) { const p = Math.pow(10, d || 2); return Math.round((Number(v) || 0) * p) / p; }

  function sum(arr, fn) {
    return (arr || []).reduce(function (acc, x, i) { return acc + (Number(fn ? fn(x, i) : x) || 0); }, 0);
  }

  function groupBy(arr, fn) {
    return (arr || []).reduce(function (acc, x) {
      const k = fn(x);
      (acc[k] = acc[k] || []).push(x);
      return acc;
    }, {});
  }

  function sortBy(arr, fn, dir) {
    const d = dir === 'desc' ? -1 : 1;
    return arr.slice().sort(function (a, b) {
      const va = fn(a), vb = fn(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (va > vb ? 1 : -1) * d;
    });
  }

  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  /* --- Даты ---------------------------------------------------------------- */
  const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  /** ISO-дата YYYY-MM-DD из Date/строки */
  function iso(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return '';
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }

  function today() { return iso(new Date()); }

  function fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function fmtDateTime(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return fmtDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtDateLong(v) {
    const d = new Date(v);
    if (isNaN(d)) return String(v || '—');
    return d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
  }

  function monthName(m) { return MONTHS_NOM[m] || ''; }
  function monthShort(m) { return MONTHS_SHORT[m] || ''; }

  function addDays(d, n) { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt; }
  function addMonths(d, n) { const dt = new Date(d); dt.setMonth(dt.getMonth() + n); return dt; }

  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  /** Сколько дней до даты от сегодня (отрицательное = просрочено) */
  function daysLeft(d) { return daysBetween(today(), d); }

  function relTime(v) {
    const diff = Math.round((Date.now() - new Date(v)) / 1000);
    if (isNaN(diff)) return '—';
    if (diff < 60) return 'только что';
    if (diff < 3600) return Math.floor(diff / 60) + ' мин назад';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад';
    if (diff < 172800) return 'вчера';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' дн назад';
    return fmtDate(v);
  }

  function ym(v) { const d = new Date(v); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }

  /** Последние N месяцев в виде [{key:'2026-01', label:'янв', year, month}] */
  function lastMonths(n, from) {
    const base = from ? new Date(from) : new Date();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      out.push({ key: ym(d), label: MONTHS_SHORT[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
    }
    return out;
  }

  /* --- Прочее -------------------------------------------------------------- */
  let idc = 0;
  function uid(prefix) {
    idc += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + idc.toString(36);
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms || 250);
    };
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('');
  }

  /** Транслитерация + нормализация для поиска */
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е').trim(); }

  function includes(haystack, needle) { return norm(haystack).indexOf(norm(needle)) !== -1; }

  /** Детерминированный ГПСЧ — демо-данные одинаковы при каждой генерации */
  function rng(seed) {
    let s = seed || 42;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  function pick(rand, arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }
  function randInt(rand, a, b) { return a + Math.floor(rand() * (b - a + 1)); }

  /** Копирование в буфер обмена с фолбэком для file:// */
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta = el('textarea', { style: { position: 'fixed', opacity: 0 } });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* игнорируем */ }
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  /** Экспорт массива объектов в CSV (Excel открывает с BOM) */
  function toCSV(rows, columns) {
    const cols = columns || Object.keys(rows[0] || {}).map(function (k) { return { k: k, t: k }; });
    const esc = function (v) {
      const s = v === null || v === undefined ? '' : String(v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = cols.map(function (c) { return esc(c.t || c.k); }).join(';');
    const body = rows.map(function (r) {
      return cols.map(function (c) { return esc(c.csv ? c.csv(r) : r[c.k]); }).join(';');
    }).join('\n');
    return '﻿' + head + '\n' + body;
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  App.U = {
    $: $, $$: $$, el: el, append: append, clear: clear, escapeHtml: escapeHtml,
    num: num, money: money, moneyShort: moneyShort, pct: pct, round: round,
    sum: sum, groupBy: groupBy, sortBy: sortBy, uniq: uniq,
    iso: iso, today: today, pad: pad,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtDateLong: fmtDateLong,
    monthName: monthName, monthShort: monthShort, MONTHS_NOM: MONTHS_NOM, MONTHS_SHORT: MONTHS_SHORT,
    addDays: addDays, addMonths: addMonths, daysBetween: daysBetween, daysLeft: daysLeft,
    relTime: relTime, ym: ym, lastMonths: lastMonths,
    uid: uid, debounce: debounce, initials: initials, norm: norm, includes: includes,
    rng: rng, pick: pick, randInt: randInt, copy: copy, toCSV: toCSV, download: download
  };
})(window.App);
