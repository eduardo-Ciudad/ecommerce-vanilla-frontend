const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateCartSubtotal,
  getFreeShippingProgress,
  getQuickAddOptions,
  parseWishlistProductIds,
} = require('../js/cartRules.js');

const compareSizes = (a, b) => Number(a.size) - Number(b.size);

test('quick add: produto sem variantes', () => {
  assert.deepEqual(getQuickAddOptions({}, compareSizes), { type: 'none', sizes: [] });
});

test('quick add: todas as variantes sem estoque', () => {
  const product = { variants: [{ id: 1, size: '2', color: 'Azul', stock: 0 }] };
  assert.deepEqual(getQuickAddOptions(product, compareSizes), { type: 'none', sizes: [] });
});

test('quick add: uma cor retorna tamanhos em ordem', () => {
  const product = { variants: [
    { id: 3, size: '10', color: 'Azul', stock: 1 },
    { id: 1, size: '2', color: 'azul', stock: 2 },
    { id: 2, size: '4', color: 'Azul', stock: 3 },
  ] };
  const result = getQuickAddOptions(product, compareSizes);
  assert.equal(result.type, 'sizes');
  assert.deepEqual(result.sizes.map((option) => option.size), ['2', '4', '10']);
});

test('quick add: várias cores exige escolha', () => {
  const product = { variants: [
    { id: 1, size: '2', color: 'Azul', stock: 1 },
    { id: 2, size: '4', color: 'Rosa', stock: 1 },
  ] };
  assert.deepEqual(getQuickAddOptions(product, compareSizes), { type: 'choose', sizes: [] });
});

test('quick add: cor nula é aceita como produto sem cor', () => {
  const product = { variants: [{ id: 1, size: '6', color: null, stock: 1 }] };
  assert.equal(getQuickAddOptions(product, compareSizes).type, 'sizes');
});

test('subtotal: lista vazia', () => {
  assert.equal(calculateCartSubtotal([]), 0);
});

test('subtotal: aceita preço em string e centavos', () => {
  assert.ok(Math.abs(calculateCartSubtotal([{ price: '33.33', quantity: 3 }]) - 99.99) < 1e-9);
});

test('frete: subtotal zero e abaixo do limite', () => {
  assert.deepEqual(getFreeShippingProgress(0, 199), { available: true, percentage: 0, remaining: 199 });
  assert.deepEqual(getFreeShippingProgress(99.5, 199), { available: true, percentage: 50, remaining: 99.5 });
});

test('frete: exatamente e acima do limite', () => {
  assert.deepEqual(getFreeShippingProgress(199, 199), { available: true, percentage: 100, remaining: 0 });
  assert.deepEqual(getFreeShippingProgress(250, 199), { available: true, percentage: 100, remaining: 0 });
});

test('frete: arredonda valor restante para centavos', () => {
  assert.equal(getFreeShippingProgress(99.999, 199).remaining, 99);
});

test('frete: threshold ausente ou zero indica sem barra', () => {
  assert.equal(getFreeShippingProgress(20).available, false);
  assert.equal(getFreeShippingProgress(20, 0).available, false);
});

test('wishlist: JSON inválido e valor que não é array', () => {
  assert.deepEqual(parseWishlistProductIds('{'), []);
  assert.deepEqual(parseWishlistProductIds('{"id":1}'), []);
});

test('wishlist: normaliza ids numéricos', () => {
  assert.deepEqual(parseWishlistProductIds('[1,2,"3"]'), ['1', '2', '3']);
});
