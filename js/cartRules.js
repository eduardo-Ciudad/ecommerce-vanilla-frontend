function calculateCartSubtotal(items) {
  return (Array.isArray(items) ? items : []).reduce(
    (total, item) => total + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
}

function getFreeShippingProgress(subtotal, threshold) {
  const normalizedThreshold = Number(threshold);
  if (!Number.isFinite(normalizedThreshold) || normalizedThreshold <= 0) {
    return { available: false, percentage: 0, remaining: 0 };
  }

  const normalizedSubtotal = Math.max(0, Number(subtotal) || 0);
  return {
    available: true,
    percentage: Math.min(100, (normalizedSubtotal / normalizedThreshold) * 100),
    remaining: Math.max(0, Math.round((normalizedThreshold - normalizedSubtotal) * 100) / 100),
  };
}

function parseWishlistProductIds(raw) {
  if (!raw) return [];

  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function getQuickAddOptions(product, compareSizes) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const available = variants.filter((variant) => Number(variant?.stock) > 0);
  if (!available.length) return { type: 'none', sizes: [] };

  const colors = new Set(
    available
      .map((variant) => String(variant?.color || '').trim().toLocaleLowerCase('pt-BR'))
      .filter(Boolean),
  );
  if (colors.size > 1) return { type: 'choose', sizes: [] };

  const sorted = [...available].sort(
    typeof compareSizes === 'function' ? compareSizes : () => 0,
  );
  const seenSizes = new Set();
  const sizes = sorted.reduce((result, variant) => {
    const size = String(variant?.size || '').trim();
    const key = size.toLocaleLowerCase('pt-BR');
    if (!size || seenSizes.has(key)) return result;
    seenSizes.add(key);
    result.push({ size, variantId: variant.id, variant });
    return result;
  }, []);

  return sizes.length ? { type: 'sizes', sizes } : { type: 'none', sizes: [] };
}

if (typeof module !== 'undefined') {
  module.exports = {
    calculateCartSubtotal,
    getFreeShippingProgress,
    getQuickAddOptions,
    parseWishlistProductIds,
  };
}
