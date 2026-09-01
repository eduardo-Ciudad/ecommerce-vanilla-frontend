let currentCart = null;

function renderEmptyCart() {
  document.querySelector('[data-cart-root]').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${ICONS.shoppingCart}</div>
      <p>Seu carrinho está vazio.</p>
      <a class="btn btn-primary" href="shop.html">Continuar comprando</a>
    </div>
  `;
}

function cartTotal(cart) {
  return cart.items.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
}

function renderCart(cart) {
  currentCart = cart;

  if (!cart.items.length) {
    renderEmptyCart();
    return;
  }

  const root = document.querySelector('[data-cart-root]');
  root.innerHTML = `
    <div class="cart-layout fade-in">
      <ul class="cart-items" data-cart-items>
        ${cart.items.map(renderCartItem).join('')}
      </ul>
      <aside class="cart-summary">
        <h2>Resumo do Pedido</h2>
        <div class="cart-summary-row">
          <span>Subtotal</span>
          <span data-cart-subtotal>${formatPrice(cartTotal(cart))}</span>
        </div>
        <div class="cart-summary-row">
          <span>Frete</span>
          <span>Grátis</span>
        </div>
        <div class="cart-summary-row cart-summary-total">
          <span>Total</span>
          <span data-cart-total>${formatPrice(cartTotal(cart))}</span>
        </div>
        <button class="btn btn-primary btn-block" type="button" data-checkout-btn>Finalizar Pedido</button>
      </aside>
    </div>
  `;

  wireCartItemEvents();
  document.querySelector('[data-checkout-btn]').addEventListener('click', handleCheckout);
}

function renderCartItem(item) {
  return `
    <li class="cart-item" data-cart-item-id="${item.id}" data-variant-id="${item.variantId}" data-price="${item.price}">
      <div class="cart-item-image">${productImagePlaceholder()}</div>
      <div class="cart-item-info">
        <span class="cart-item-name">${escapeHtml(item.productName)}</span>
        <span class="cart-item-size">Tamanho: ${escapeHtml(item.size)}</span>
        <span class="cart-item-price">${formatPrice(item.price)} / unidade</span>
      </div>
      <div class="quantity-input cart-item-qty">
        <button type="button" data-qty-decrease aria-label="Diminuir quantidade">−</button>
        <input type="number" min="1" value="${item.quantity}" data-qty-input readonly />
        <button type="button" data-qty-increase aria-label="Aumentar quantidade">+</button>
      </div>
      <span class="cart-item-subtotal" data-cart-item-subtotal>${formatPrice(item.price * item.quantity)}</span>
      <button class="cart-item-remove" type="button" data-remove-item aria-label="Remover item">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
      </button>
    </li>
  `;
}

function updateSummary() {
  const total = cartTotal(currentCart);
  document.querySelector('[data-cart-subtotal]').textContent = formatPrice(total);
  document.querySelector('[data-cart-total]').textContent = formatPrice(total);
}

async function updateItemQuantity(itemId, variantId, quantity) {
  return apiPut(`/cart/items/${itemId}`, { variantId, quantity });
}

function wireCartItemEvents() {
  document.querySelectorAll('[data-cart-item-id]').forEach((row) => {
    const itemId = row.dataset.cartItemId;
    const variantId = row.dataset.variantId;
    const price = Number(row.dataset.price);
    const qtyInput = row.querySelector('[data-qty-input]');
    const subtotalEl = row.querySelector('[data-cart-item-subtotal]');
    const decreaseButton = row.querySelector('[data-qty-decrease]');
    const increaseButton = row.querySelector('[data-qty-increase]');
    let isUpdating = false;

    async function changeQuantity(newQuantity) {
      if (newQuantity < 1 || isUpdating) return;

      const previous = Number(qtyInput.value);
      const currentItem = currentCart.items.find(
        (item) => String(item.id) === itemId,
      );

      if (!currentItem) {
        showToast('Não foi possível localizar o item no carrinho', 'error');
        return;
      }

      isUpdating = true;
      decreaseButton.disabled = true;
      increaseButton.disabled = true;

      currentItem.quantity = newQuantity;
      qtyInput.value = newQuantity;
      subtotalEl.textContent = formatPrice(price * newQuantity);
      updateSummary();

      try {
        const cart = await updateItemQuantity(itemId, variantId, newQuantity);
        const updatedItem = cart.items.find(
          (item) => String(item.id) === itemId,
        );

        if (!updatedItem) {
          throw new ApiContractError(
            `/cart/items/${itemId}`,
            'o item atualizado não foi retornado no carrinho',
          );
        }

        currentCart.items = currentCart.items.map((item) =>
          String(item.id) === itemId ? updatedItem : item,
        );

        qtyInput.value = updatedItem.quantity;
        subtotalEl.textContent = formatPrice(
          Number(updatedItem.price) * updatedItem.quantity,
        );
        updateSummary();
        setCartCount(
          currentCart.items.reduce(
            (total, item) => total + item.quantity,
            0,
          ),
        );
      } catch (error) {
        currentItem.quantity = previous;
        qtyInput.value = previous;
        subtotalEl.textContent = formatPrice(price * previous);
        updateSummary();
        showToast(error.message || 'Não foi possível atualizar a quantidade', 'error');
      } finally {
        isUpdating = false;
        decreaseButton.disabled = false;
        increaseButton.disabled = false;
      }
    }

    decreaseButton.addEventListener('click', () => {
      changeQuantity(Number(qtyInput.value) - 1);
    });
    increaseButton.addEventListener('click', () => {
      changeQuantity(Number(qtyInput.value) + 1);
    });

    row.querySelector('[data-remove-item]').addEventListener('click', async () => {
      try {
        await apiDelete(`/cart/items/${itemId}`);
        const cart = await apiGet('/cart');
        setCartCount(cart.items.reduce((total, item) => total + item.quantity, 0));
        renderCart(cart);
        showToast('Item removido do carrinho', 'success');
      } catch (error) {
        showToast(error.message || 'Não foi possível remover o item', 'error');
      }
    });
  });
}

function handleCheckout() {
  // O pedido agora é criado em checkout.js, após a seleção de endereço e frete.
  window.location.href = 'checkout.html';
}

async function initCartPage() {
  if (!requireAuth()) return;

  try {
    const cart = await apiGet('/cart');
    renderCart(cart);
  } catch (error) {
    showToast(error.message || 'Não foi possível carregar o carrinho', 'error');
    renderEmptyCart();
  }
}

document.addEventListener('DOMContentLoaded', initCartPage);
