function sumCartQuantity(cart) {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

function getProductId() {
  return new URLSearchParams(window.location.search).get('id');
}

function renderProductError(message) {
  document.querySelector('[data-product-root]').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">😕</div>
      <p>${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="shop.html">Voltar para a loja</a>
    </div>
  `;
}

function renderProduct(product) {
  document.querySelector('[data-breadcrumb-current]').textContent = product.name;

  const root = document.querySelector('[data-product-root]');
  root.innerHTML = `
    <div class="product-detail fade-in">
      <div class="product-image">${productImagePlaceholder()}</div>
      <div class="product-info">
        <span class="badge product-category-badge">${escapeHtml(product.categoryName || '')}</span>
        <h1>${escapeHtml(product.name)}</h1>
        <p class="product-description">${escapeHtml(product.description || 'Sem descrição disponível.')}</p>

        <div class="product-variants">
          <h3>Tamanho</h3>
          <div class="variant-chips" data-variant-chips></div>
        </div>

        <div class="product-price-block">
          <span class="product-price" data-product-price>Selecione um tamanho</span>
          <span class="product-stock" data-product-stock></span>
        </div>

        <div class="product-quantity">
          <h3>Quantidade</h3>
          <div class="quantity-input">
            <button type="button" data-qty-decrease aria-label="Diminuir quantidade">−</button>
            <input type="number" min="1" value="1" data-qty-input readonly />
            <button type="button" data-qty-increase aria-label="Aumentar quantidade">+</button>
          </div>
        </div>

        <button class="btn btn-primary btn-block product-add-btn" type="button" data-add-to-cart disabled>
          ${ICONS.cart}
          <span>Adicionar ao carrinho</span>
        </button>
      </div>
    </div>
  `;

  wireProductInteractions(product);
}

function wireProductInteractions(product) {
  const chipsContainer = document.querySelector('[data-variant-chips]');
  const priceEl = document.querySelector('[data-product-price]');
  const stockEl = document.querySelector('[data-product-stock]');
  const qtyInput = document.querySelector('[data-qty-input]');
  const addButton = document.querySelector('[data-add-to-cart]');

  let selectedVariant = null;

  const variants = product.variants || [];

  chipsContainer.innerHTML = variants.length
    ? variants
        .map(
          (variant) => `
            <button type="button" class="variant-chip" data-variant-id="${variant.id}" ${variant.stock <= 0 ? 'disabled' : ''}>
              ${escapeHtml(variant.size)}
            </button>
          `
        )
        .join('')
    : '<p class="empty-state" style="padding:0">Sem variações cadastradas.</p>';

  function selectVariant(variant) {
    selectedVariant = variant;
    chipsContainer.querySelectorAll('.variant-chip').forEach((chip) => {
      chip.classList.toggle('is-selected', chip.dataset.variantId === variant.id);
    });
    priceEl.textContent = formatPrice(variant.price);
    stockEl.textContent = `${variant.stock} unidades disponíveis`;
    qtyInput.value = 1;
    qtyInput.max = variant.stock;
    addButton.disabled = variant.stock <= 0;
  }

  chipsContainer.querySelectorAll('.variant-chip:not(:disabled)').forEach((chip) => {
    chip.addEventListener('click', () => {
      const variant = variants.find((v) => v.id === chip.dataset.variantId);
      selectVariant(variant);
    });
  });

  document.querySelector('[data-qty-decrease]').addEventListener('click', () => {
    const value = Math.max(1, Number(qtyInput.value) - 1);
    qtyInput.value = value;
  });

  document.querySelector('[data-qty-increase]').addEventListener('click', () => {
    if (!selectedVariant) return;
    const value = Math.min(selectedVariant.stock, Number(qtyInput.value) + 1);
    qtyInput.value = value;
  });

  addButton.addEventListener('click', async () => {
    if (!selectedVariant) return;

    if (!isAuthenticated()) {
      const redirect = encodeURIComponent(`product.html?id=${product.id}`);
      window.location.href = `auth.html?redirect=${redirect}`;
      return;
    }

    addButton.disabled = true;
    const originalContent = addButton.innerHTML;
    addButton.innerHTML = '<span class="spinner"></span>';

    try {
      const cart = await apiPost('/cart/items', {
        variantId: selectedVariant.id,
        quantity: Number(qtyInput.value),
      });
      setCartCount(sumCartQuantity(cart));
      showToast('Produto adicionado ao carrinho!', 'success');
    } catch (error) {
      showToast(error.message || 'Não foi possível adicionar ao carrinho', 'error');
    } finally {
      addButton.disabled = false;
      addButton.innerHTML = originalContent;
    }
  });
}

async function initProductPage() {
  const id = getProductId();
  if (!id) {
    renderProductError('Produto não encontrado.');
    return;
  }

  try {
    const product = await apiGet(`/products/${id}`);
    renderProduct(product);
  } catch (error) {
    renderProductError(error.message || 'Não foi possível carregar este produto.');
  }
}

document.addEventListener('DOMContentLoaded', initProductPage);
