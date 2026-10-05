'use strict';
// Загружает реальные скрипты приложения в jsdom (без изменений исходников).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const JS = path.resolve(__dirname, '..');
const CSS_DIR = path.resolve(__dirname, '..', '..', 'css');
const ORDER = ['core/utils.js', 'core/icons.js', 'core/config.js', 'core/api.js', 'core/i18n.js',
  'core/depreciation.js', 'core/store.js', 'core/seed.js', 'core/auth.js', 'core/router.js',
  'core/charts.js', 'core/ui.js', 'core/xlsx.js', 'core/select.js', 'core/helpers.js', 'modules/warehouse.js'];

const HTML = '<!doctype html><html><body>' +
  '<div id="toasts"></div>' +
  '<div class="modal-root" id="modal-root" hidden><div class="modal-root__backdrop" data-close></div>' +
  '<div class="modal" id="modal"><h2 id="modal-title"></h2><div id="modal-body"></div><footer id="modal-foot"></footer></div></div>' +
  '<main id="view"></main></body></html>';

function App0(w, routes, onRender) {
  w.App.Router = { add(p, d) { routes[p] = d; return w.App.Router; }, render: onRender, go() {} };
}
function boot() {
  const dom = new JSDOM(HTML, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = w.matchMedia || function () { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; };
  w.eval('window.App = window.App || {};');
  const errors = [];
  const routes = {}; let renders = 0;
  ORDER.forEach(function (f) {
    if (f === 'core/helpers.js') {
      App0(w, routes, () => renders++);
    }
    try { w.eval(fs.readFileSync(path.join(JS, f), 'utf8') + '\n//# sourceURL=' + f); }
    catch (e) { errors.push(f + ': ' + e.message); }
  });
  const App = w.App;
  try { App.Store.init(); } catch (e) { errors.push('Store.init: ' + e.message); }
  App.Auth.canEdit = () => true;
  return { dom, w, App, errors, routes, renders: () => renders, doc: w.document };
}

function click(env, text) {
  const btns = Array.from(env.doc.querySelectorAll('#modal-foot button'));
  const b = btns.find(x => x.textContent.trim().indexOf(text) >= 0);
  if (!b) throw new Error('кнопка не найдена: ' + text);
  b.click();
}

function fill(env, k, val) {
  const n = env.doc.querySelector('#modal-body [name="' + k + '"]');
  if (!n) throw new Error('поле не найдено ' + k);
  if (n.type === 'checkbox') n.checked = !!val; else n.value = val;
  return n;
}

// editProduct не экспортируется: открываем через страницу «Товары»
function openProduct(env, p) {
  const page = env.routes.products.render({ params: {}, sub: [] });
  const view = env.doc.getElementById('view');
  view.innerHTML = ''; view.appendChild(page);
  if (!p) {
    const b = Array.from(view.querySelectorAll('button')).find(x => x.textContent.indexOf('Новый товар') >= 0);
    b.click();
  } else {
    // кнопка «Изменить» нужной строки: ищем по тексту sku/имени
    const rows = Array.from(view.querySelectorAll('tbody tr'));
    const row = rows.find(r => r.textContent.indexOf(p.name) >= 0);
    if (!row) throw new Error('строка не найдена (пагинация?)');
    row.querySelector('button[title="Изменить"], button[aria-label="Изменить"]').click();
  }
}

module.exports = { boot, click, fill, openProduct, JS, CSS_DIR };
