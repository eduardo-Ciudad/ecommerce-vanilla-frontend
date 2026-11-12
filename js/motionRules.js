function shouldHeaderStick(scrollY, threshold = 4) {
  return Number(scrollY) > Number(threshold);
}

if (typeof module !== 'undefined') {
  module.exports = { shouldHeaderStick };
}
