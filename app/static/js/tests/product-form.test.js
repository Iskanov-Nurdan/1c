'use strict';
// Атака на editProduct / UI.formModal. Тесты [BUG] ДОЛЖНЫ падать на текущем коде.
const test = require('node:test');
const assert = require('node:assert');
const { boot, click, fill, openProduct, CSS_DIR } = require('./harness');
const fs = require('fs');
const path = require('path');

const BASE = { name: 'Тестовый товар', sku: 'TST-1', cost: '10', price: '20', vat: '12', minStock: '5' };

function submit(over, opts) {
  opts = opts || {};
  const env = boot();
  const cats = env.App.Store.all('categories');
  const before = env.App.Store.all('products').length;
  openProduct(env, opts.product || null);
  const vals = Object.assign({}, opts.product ? {} : BASE, over || {});
  fill(env, 'categoryId', (opts.product && opts.product.categoryId) || cats[0].id);
  Object.keys(vals).forEach(function (k) { fill(env, k, vals[k]); });
  click(env, 'Сохранить');
  const all = env.App.Store.all('products');
  return { env: env, added: all.length - before, closed: env.doc.getElementById('modal-root').hidden, all: all };
}
function errText(env) {
  return Array.from(env.doc.querySelectorAll('.field__error')).filter(function (e) { return !e.hidden; }).map(function (e) { return e.textContent; });
}
function firstProduct(env) {
  return env.App.Store.all('products').slice().sort(function (a, b) { return a.name.localeCompare(b.name); })[0];
}

/* --- Валидация значений ---------------------------------------------------- */
test('[BUG] имя из одних пробелов проходит required', function () {
  assert.equal(submit({ name: '   ' }).added, 0, 'товар с именем "   " сохранён');
});
test('[BUG] артикул из пробелов проходит required', function () {
  assert.equal(submit({ sku: '   ' }).added, 0, 'товар с sku "   " сохранён');
});
test('[BUG] значения не trim-ятся при сохранении', function () {
  const r = submit({ name: '  Болт  ', sku: ' B-1 ' });
  const p = r.all.find(function (x) { return x.sku && x.sku.trim() === 'B-1'; });
  assert.ok(p, 'не сохранился');
  assert.equal(p.name, 'Болт', 'name = ' + JSON.stringify(p.name));
  assert.equal(p.sku, 'B-1', 'sku = ' + JSON.stringify(p.sku));
});
test('[BUG] отрицательные цена и себестоимость сохраняются', function () {
  assert.equal(submit({ cost: '-10', price: '-5' }).added, 0, 'сохранён товар cost=-10 price=-5');
});
test('[BUG] нулевые цена/себестоимость сохраняются', function () {
  assert.equal(submit({ cost: '0', price: '0' }).added, 0, 'сохранён товар с ценой 0');
});
test('[BUG] price=-5 при пустой cost: ошибка "Цена ниже себестоимости" (сравнение с null -> 0), а не про отрицательную цену', function () {
  const r = submit({ cost: '', price: '-5' });
  const msgs = errText(r.env);
  assert.ok(msgs.indexOf('Цена ниже себестоимости') < 0, 'сообщения: ' + JSON.stringify(msgs));
});
test('[BUG] НДС > 100, < 0 и 100000 принимаются (в БД max_digits=5)', function () {
  assert.equal(submit({ vat: '150' }).added, 0, 'vat=150 сохранён');
  assert.equal(submit({ vat: '-5' }).added, 0, 'vat=-5 сохранён');
  assert.equal(submit({ vat: '100000' }).added, 0, 'vat=100000 сохранён');
});
test('[BUG] отрицательный минимальный запас принимается', function () {
  assert.equal(submit({ minStock: '-3' }).added, 0, 'minStock=-3 сохранён');
});
test('[BUG] 1e308 принимается как цена/себестоимость', function () {
  assert.equal(submit({ cost: '1e308', price: '1e308' }).added, 0, 'сохранён товар с ценой 1e308');
});
test('[BUG] step=0.01 не контролируется: price=10.005 принимается', function () {
  assert.equal(submit({ cost: '5', price: '10.005' }).added, 0, 'price=10.005 сохранён, хотя step=0.01');
});
test('[BUG] очищенный minStock сохраняется как null', function () {
  assert.equal(submit({ minStock: '' }).added, 0, 'minStock очищен и сохранён как null');
});
test('[BUG] карточка товара печатает "null" при minStock=null (productCard: p.minStock + " " + p.unit)', function () {
  const r = submit({ name: '000 тест' });
  r.env.App.Store.update('products', r.all.find(function (x) { return x.sku === 'TST-1'; }).id, { minStock: null }, { silent: true });
  const view = r.env.doc.getElementById('view');
  view.innerHTML = '';
  view.appendChild(r.env.routes.products.render({ params: {}, sub: [] }));
  const row = Array.from(view.querySelectorAll('tbody tr')).find(function (t) { return t.textContent.indexOf('000 тест') >= 0; });
  assert.ok(row, 'строка не найдена');
  row.querySelector('button[title="Карточка товара"]').click();
  assert.ok(!/null/.test(r.env.doc.getElementById('modal-body').textContent), 'в карточке текст "null"');
});
test('[BUG] нет ограничения длины: name>255 и sku>40 (лимиты модели Django) принимаются', function () {
  assert.equal(submit({ name: 'А'.repeat(300) }).added, 0, 'name 300 символов сохранён (max_length=255)');
  assert.equal(submit({ sku: 'S'.repeat(41) }).added, 0, 'sku 41 символ сохранён (max_length=40)');
});

/* --- Штрихкод -------------------------------------------------------------- */
test('[BUG] авто-штрихкод не всегда 13 цифр (Math.floor(random*1e11) теряет ведущие нули)', function () {
  const env = boot();
  env.w.Math.random = function () { return 0.05; };
  openProduct(env, null);
  const bc = env.doc.querySelector('[name="barcode"]').value;
  assert.match(bc, /^\d{13}$/, 'сгенерирован "' + bc + '" (' + bc.length + ' цифр)');
});
test('[BUG] авто-штрихкод имеет неверную контрольную сумму EAN-13', function () {
  const env = boot();
  env.w.Math.random = function () { return 0.5; };
  openProduct(env, null);
  const bc = env.doc.querySelector('[name="barcode"]').value;
  const d = bc.split('').map(Number);
  const sum = d.slice(0, 12).reduce(function (s, x, i) { return s + x * (i % 2 ? 3 : 1); }, 0);
  const chk = (10 - (sum % 10)) % 10;
  assert.equal(d[12], chk, 'штрихкод ' + bc + ': контрольная цифра ' + d[12] + ', ожидалась ' + chk);
});
test('[BUG] произвольная строка в «Штрихкод (EAN-13)» принимается ("abc", "123")', function () {
  assert.equal(submit({ barcode: 'abc' }).added, 0, 'barcode "abc" сохранён');
  assert.equal(submit({ barcode: '123' }).added, 0, 'barcode "123" сохранён');
});
test('[BUG] дубликат штрихкода принимается', function () {
  const bc = boot().App.Store.all('products')[0].barcode;
  const r = submit({ barcode: bc });
  const dup = r.all.filter(function (p) { return p.barcode === bc; });
  assert.equal(dup.length, 1, 'штрихкод ' + bc + ' теперь у ' + dup.length + ' товаров');
});
test('[BUG] дубликат артикула (sku) принимается', function () {
  const sku = boot().App.Store.all('products')[0].sku;
  const r = submit({ sku: sku });
  assert.equal(r.all.filter(function (p) { return p.sku === sku; }).length, 1, 'sku ' + sku + ' продублирован');
});
test('[BUG] при редактировании sku можно заменить на чужой', function () {
  const env0 = boot();
  const ps = env0.App.Store.all('products').slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  const p = ps[0];
  const other = ps.find(function (x) { return x.sku !== p.sku; });
  const r = submit({ sku: other.sku }, { product: p });
  assert.equal(r.all.filter(function (x) { return x.sku === other.sku; }).length, 1, 'sku ' + other.sku + ' продублирован при update');
});

/* --- XSS ------------------------------------------------------------------- */
test('XSS: name/sku не интерпретируются как HTML (ожидается зелёный)', function () {
  const evil = '<img src=x onerror="window.__xss=1">';
  const r = submit({ name: evil, sku: evil });
  const view = r.env.doc.getElementById('view');
  view.innerHTML = '';
  view.appendChild(r.env.routes.products.render({ params: {}, sub: [] }));
  assert.equal(view.querySelectorAll('img[src="x"]').length, 0);
  assert.ok(!r.env.w.__xss);
});

/* --- Редактирование существующего ----------------------------------------------- */
test('редактирование: id/companyId сохраняются, исходный объект не мутируется до Save (ожидается зелёный)', function () {
  const env = boot();
  const p = firstProduct(env);
  const snap = JSON.stringify(p);
  openProduct(env, p);
  fill(env, 'name', 'Другое имя');
  assert.equal(JSON.stringify(p), snap, 'объект мутирован до сохранения');
  click(env, 'Сохранить');
  const q = env.App.Store.get('products', p.id);
  assert.equal(q.id, p.id);
  assert.equal(q.name, 'Другое имя');
  assert.equal(q.companyId, p.companyId);
});
test('[BUG] товар с единицей вне справочника молча получает другую единицу при Save (select empty:false)', function () {
  const env = boot();
  const p = firstProduct(env);
  env.App.Store.update('products', p.id, { unit: 'м2' }, { silent: true });
  openProduct(env, env.App.Store.get('products', p.id));
  click(env, 'Сохранить');
  assert.equal(env.App.Store.get('products', p.id).unit, 'м2', 'unit изменился на "' + env.App.Store.get('products', p.id).unit + '"');
});
test('[BUG] пустой справочник units: товар сохраняется с unit=""', function () {
  const env = boot();
  env.App.Store.raw('units').length = 0;
  openProduct(env, null);
  fill(env, 'name', 'X'); fill(env, 'sku', 'X-1'); fill(env, 'cost', '1'); fill(env, 'price', '2');
  fill(env, 'categoryId', env.App.Store.all('categories')[0].id);
  click(env, 'Сохранить');
  const p = env.App.Store.all('products').find(function (x) { return x.sku === 'X-1'; });
  assert.ok(!p || p.unit, 'товар сохранён с unit=' + JSON.stringify(p && p.unit));
});
test('[BUG] categoryId из select - строка: при числовых id категорий теряется связь (strict ===)', function () {
  const env = boot();
  env.App.Store.raw('categories').forEach(function (c, i) { c.id = i + 1; });
  const cat = env.App.Store.all('categories')[0];
  openProduct(env, null);
  fill(env, 'name', 'N'); fill(env, 'sku', 'N-1'); fill(env, 'cost', '1'); fill(env, 'price', '2');
  fill(env, 'categoryId', String(cat.id));
  click(env, 'Сохранить');
  const p = env.App.Store.all('products').find(function (x) { return x.sku === 'N-1'; });
  assert.strictEqual(p.categoryId, cat.id, 'categoryId сохранён как ' + JSON.stringify(p.categoryId) + ', ожидалось число ' + cat.id);
});

/* --- Сбои onSave / жизненный цикл модалки --------------------------------------- */
test('[BUG] onSave бросает после insert: модалка остаётся открытой, повторный клик создаёт дубль', function () {
  const env = boot();
  env.App.Router.render = function () { throw new Error('render failed'); };
  openProduct(env, null);
  const before = env.App.Store.all('products').length;
  Object.keys(BASE).forEach(function (k) { fill(env, k, BASE[k]); });
  fill(env, 'categoryId', env.App.Store.all('categories')[0].id);
  const btn = Array.from(env.doc.querySelectorAll('#modal-foot button')).find(function (b) { return b.textContent.indexOf('Сохранить') >= 0; });
  btn.click(); btn.click();
  const added = env.App.Store.all('products').length - before;
  assert.equal(added, 1, 'после исключения в onSave и 2 кликов добавлено ' + added + ' записей; модалка открыта: ' + !env.doc.getElementById('modal-root').hidden);
});
test('[BUG] утечка keydown-обработчика: modal() дважды без закрытия -> слушатель остаётся после close', function () {
  const env = boot();
  const d = env.doc; let added = 0, removed = 0;
  const a = d.addEventListener.bind(d), r = d.removeEventListener.bind(d);
  d.addEventListener = function (t, f, o) { if (t === 'keydown') added++; return a(t, f, o); };
  d.removeEventListener = function (t, f, o) { if (t === 'keydown') removed++; return r(t, f, o); };
  env.App.UI.modal({ title: 'a', body: [] });
  env.App.UI.modal({ title: 'b', body: [] });
  env.App.UI.closeModal();
  assert.equal(added - removed, 0, 'keydown: добавлено ' + added + ', снято ' + removed + ' (утечка ' + (added - removed) + ')');
});
test('[BUG] Esc закрывает форму и теряет введённые данные без подтверждения', function () {
  const env = boot();
  openProduct(env, null);
  fill(env, 'name', 'Много набранного текста');
  env.doc.dispatchEvent(new env.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(env.doc.getElementById('modal-root').hidden, false, 'форма закрыта по Esc, данные потеряны');
});
test('[BUG] клик по подложке закрывает форму с несохранёнными данными', function () {
  const env = boot();
  openProduct(env, null);
  fill(env, 'name', 'Набрано');
  env.doc.querySelector('.modal-root__backdrop').click();
  assert.equal(env.doc.getElementById('modal-root').hidden, false, 'закрыто кликом по фону');
});

/* --- UI.form: корневые причины --------------------------------------------------- */
test('[BUG] UI.form: required checkbox не валидируется (нет error-узла)', function () {
  const env = boot();
  const f = env.App.UI.form({ fields: [{ k: 'agree', t: 'Согласен', type: 'checkbox', required: true }], values: {} });
  assert.equal(f.validate(), false, 'unchecked required-checkbox считается валидным');
});
test('[BUG] UI.form: min/max не проверяются в validate()', function () {
  const env = boot();
  const f = env.App.UI.form({ fields: [{ k: 'n', t: 'N', type: 'number', min: 0, max: 100 }], values: { n: -50 } });
  assert.equal(f.validate(), false, 'n=-50 при min=0 считается валидным');
});
test('[BUG] UI.form: col вне 1..12 порождает класс без CSS-правила (нет нормализации)', function () {
  const env = boot();
  const f = env.App.UI.form({ fields: [{ k: 'a', t: 'A', col: 13 }] });
  const css = fs.readFileSync(path.join(CSS_DIR, 'components.css'), 'utf8');
  const cn = f.node.children[0].className.match(/col-\d+/)[0];
  assert.ok(css.indexOf('.form-grid > .' + cn + ' ') >= 0, 'для класса ' + cn + ' нет CSS-правила');
});
