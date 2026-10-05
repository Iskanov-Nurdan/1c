const test = require('node:test'); const assert = require('node:assert');
const { boot, openProduct } = require('./harness');
test('smoke: harness открывает форму нового товара', () => {
  const env = boot();
  assert.deepStrictEqual(env.errors, []);
  openProduct(env, null);
  assert.ok(env.doc.querySelector('#modal-body [name="price"]'));
  assert.equal(env.doc.getElementById('modal-root').hidden, false);
});
test('smoke: редактирование существующего', () => {
  const env = boot();
  const p = env.App.Store.all('products').slice().sort((a,b)=>a.name.localeCompare(b.name))[0];
  openProduct(env, p);
  assert.equal(env.doc.querySelector('[name="name"]').value, p.name);
});
