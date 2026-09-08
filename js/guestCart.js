function getGuestCart() {
  const raw = readStorage(STORAGE_KEYS.GUEST_CART);
  if (!raw) return [];

  try {
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    removeStorage(STORAGE_KEYS.GUEST_CART);
    return [];
  }
}

function saveGuestCart(items) {
  localStorage.setItem(STORAGE_KEYS.GUEST_CART, JSON.stringify(items));
  return items;
}

function addToGuestCart(item) {
  const items = getGuestCart();
  const existingItem = items.find(
    (cartItem) => String(cartItem.variantId) === String(item.variantId),
  );

  if (existingItem) {
    existingItem.quantity = Math.min(
      Number(existingItem.stock),
      Number(existingItem.quantity) + Number(item.quantity),
    );
  } else {
    const stock = Math.max(0, Number(item.stock));
    items.push({
      variantId: item.variantId,
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      price: Number(item.price),
      quantity: Math.min(stock, Math.max(1, Number(item.quantity))),
      stock,
    });
  }

  return saveGuestCart(items);
}

function updateGuestCartItemQuantity(variantId, quantity) {
  const items = getGuestCart();
  const item = items.find(
    (cartItem) => String(cartItem.variantId) === String(variantId),
  );
  if (!item) return items;

  item.quantity = Math.min(
    Number(item.stock),
    Math.max(1, Number(quantity)),
  );
  return saveGuestCart(items);
}

function removeFromGuestCartItem(variantId) {
  return saveGuestCart(
    getGuestCart().filter(
      (item) => String(item.variantId) !== String(variantId),
    ),
  );
}

function clearGuestCart() {
  removeStorage(STORAGE_KEYS.GUEST_CART);
}

function guestCartCount() {
  return getGuestCart().reduce(
    (total, item) => total + Number(item.quantity),
    0,
  );
}
