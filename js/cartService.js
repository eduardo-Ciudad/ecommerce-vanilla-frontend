(() => {
function normalizeCartItem(item) {
  return {
    productName: item.productName || '',
    imageUrl: item.imageUrl || '',
    size: item.size || '',
    color: item.color || '',
    price: Number(item.price) || 0,
    quantity: Number(item.quantity) || 0,
    stock: item.stock == null || item.stock === '' ? null : Number(item.stock),
    variantId: item.variantId,
    itemId: item.id ?? item.itemId ?? item.variantId,
  };
}

function normalizeCartItems(items) {
  return (Array.isArray(items) ? items : []).map(normalizeCartItem);
}

async function getItems() {
  if (!isAuthenticated()) return normalizeCartItems(getGuestCart());
  const cart = await apiGet('/cart');
  return normalizeCartItems(cart.items);
}

async function addItem(product, variant, quantity = 1) {
  if (!isAuthenticated()) {
    return normalizeCartItems(addToGuestCart({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      size: variant.size,
      color: variant.color || null,
      price: variant.price,
      quantity,
      stock: variant.stock,
    }));
  }

  const cart = await apiPost('/cart/items', { variantId: variant.id, quantity });
  return normalizeCartItems(cart.items);
}

async function updateQuantity(item, quantity) {
  const stock = Number(item.stock);
  const normalizedQuantity = Math.max(
    1,
    Number.isFinite(stock) ? Math.min(Number(quantity), stock) : Number(quantity),
  );

  if (!isAuthenticated()) {
    return normalizeCartItems(updateGuestCartItemQuantity(item.variantId, normalizedQuantity));
  }

  const cart = await apiPut(`/cart/items/${item.itemId}`, {
    variantId: item.variantId,
    quantity: normalizedQuantity,
  });
  return normalizeCartItems(cart.items);
}

async function removeItem(item) {
  if (!isAuthenticated()) {
    return normalizeCartItems(removeFromGuestCartItem(item.variantId));
  }

  await apiDelete(`/cart/items/${item.itemId}`);
  const cart = await apiGet('/cart');
  return normalizeCartItems(cart.items);
}

function getSubtotal(items) {
  return calculateCartSubtotal(items);
}

function syncCartBadge(items) {
  const count = items.reduce((total, item) => total + Number(item.quantity || 0), 0);
  setCartCount(count);
  return count;
}

window.cartService = {
  addItem,
  getItems,
  updateQuantity,
  removeItem,
  getSubtotal,
  syncCartBadge,
};
})();
