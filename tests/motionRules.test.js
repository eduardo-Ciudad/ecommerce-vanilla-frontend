const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldHeaderStick } = require('../js/motionRules.js');

test('header permanece no estado inicial até scrollY 4', () => {
  assert.equal(shouldHeaderStick(0), false);
  assert.equal(shouldHeaderStick(4), false);
});

test('header ativa o estado fixado acima de scrollY 4', () => {
  assert.equal(shouldHeaderStick(4.01), true);
  assert.equal(shouldHeaderStick(20), true);
});
