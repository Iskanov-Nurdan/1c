'use strict';
// Проверка раскладки .form-grid / .col-N разбором CSS и исходников.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JS, CSS_DIR } = require('./harness');

const css = fs.readFileSync(path.join(CSS_DIR, 'components.css'), 'utf8');
const allCss = fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(CSS_DIR, f), 'utf8')).join('\n');

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (e.name === 'node_modules' || e.name === 'tests') return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p);
  });
  return out;
}
const srcs = walk(JS, []);

test('для каждого col: N из модулей есть правило .form-grid > .col-N (ожидается зелёный)', function () {
  const used = new Set([12]);
  srcs.forEach(function (f) {
    (fs.readFileSync(f, 'utf8').match(/\bcol:\s*(\d+)/g) || []).forEach(function (m) { used.add(Number(m.replace(/\D/g, ''))); });
  });
  used.forEach(function (n) {
    assert.ok(new RegExp('\\.form-grid\\s*>\\s*\\.col-' + n + '\\s*\\{\\s*grid-column:\\s*span ' + n + ';').test(css), 'нет правила для col-' + n);
  });
});

test('на узком экране (<=720px) все поля в 1 колонку, включая .form-section (ожидается зелёный)', function () {
  assert.match(css, /@media \(max-width: 720px\)\s*\{\s*\.form-grid > \*\s*\{\s*grid-column: 1 \/ -1 !important;/);
});

test('нигде вне UI.form не создаются .field.col-N вне .form-grid (ожидается зелёный)', function () {
  // поиск мест, где создаются div.field.col-N / class col-N НЕ внутри UI.form
  const offenders = [];
  srcs.forEach(function (f) {
    const t = fs.readFileSync(f, 'utf8');
    if (/ui\.js$/.test(f)) return;
    if (/['"]div\.field\.col-|class:\s*['"][^'"]*\bcol-\d+/.test(t)) offenders.push(path.basename(f));
  });
  assert.deepStrictEqual(offenders, []);
});
