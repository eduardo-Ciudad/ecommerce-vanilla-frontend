const RELATED_PRODUCTS_COUNT = 4;

const SHIPPING_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7.5" cy="18.5" r="1.5"/><circle cx="17.5" cy="18.5" r="1.5"/></svg>';
const EXCHANGE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>';
const SHIELD_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/></svg>';
const CLOCK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const PREVIOUS_IMAGE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>';
const NEXT_IMAGE_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>';

function sumCartQuantity(cart) {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

function getProductId() {
  return new URLSearchParams(window.location.search).get('id');
}

function renderProductError(message) {
  document.querySelector('[data-product-root]').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${ICONS.frown}</div>
      <p>${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="shop.html">Voltar para a loja</a>
    </div>
  `;
}

function productSku(product) {
  return `GK-${product.id.slice(0, 8).toUpperCase()}`;
}

function renderBreadcrumb(product) {
  document.querySelector('[data-breadcrumb-current]').textContent = product.name;
  const categoryCrumb = document.querySelector('[data-breadcrumb-category]');
  if (product.categoryName) {
    categoryCrumb.innerHTML = `<a href="shop.html?category=${product.categoryId}">${escapeHtml(product.categoryName)}</a> <span>/</span>`;
  }
}

function renderProduct(product) {
  renderBreadcrumb(product);
  applyProductSeo(product);

  const root = document.querySelector('[data-product-root]');
  const productImages = Array.isArray(product.images)
    ? product.images.filter((image) => image?.url)
    : [];
  const mainImageUrl = productImages[0]?.url || product.imageUrl;
  const imageContent = mainImageUrl
    ? `<img src="${escapeHtml(mainImageUrl)}" alt="${escapeHtml(product.name)}" data-product-main-image />`
    : productImagePlaceholder();
  const thumbnailsContent = productImages.length
    ? `
      <div class="product-thumbnails" aria-label="Imagens do produto">
        ${productImages.map((image, index) => `
          <button
            type="button"
            class="product-thumbnail${index === 0 ? ' is-active' : ''}"
            data-product-thumbnail
            data-full-image="${escapeHtml(image.url)}"
            aria-label="Exibir imagem ${index + 1} de ${escapeHtml(product.name)}"
            aria-pressed="${index === 0 ? 'true' : 'false'}"
          >
            <img
              src="${escapeHtml(image.thumbnailUrl || image.url)}"
              alt=""
            />
          </button>
        `).join('')}
      </div>
    `
    : '';
  const galleryNavigationContent = productImages.length > 1
    ? `
      <button
        type="button"
        class="product-gallery-arrow product-gallery-arrow--previous"
        data-gallery-direction="previous"
        aria-label="Exibir imagem anterior"
      >
        ${PREVIOUS_IMAGE_ICON}
      </button>
      <button
        type="button"
        class="product-gallery-arrow product-gallery-arrow--next"
        data-gallery-direction="next"
        aria-label="Exibir próxima imagem"
      >
        ${NEXT_IMAGE_ICON}
      </button>
    `
    : '';
  const specifications = Array.isArray(product.specifications)
    ? product.specifications
    : [];
  const specificationsContent = specifications.length
    ? `
      <dl class="product-specifications">
        ${specifications.map((specification) => `
          <div class="product-specification">
            <dt>${escapeHtml(specification.name || '')}</dt>
            <dd>${escapeHtml(specification.value || '')}</dd>
          </div>
        `).join('')}
      </dl>
    `
    : `
      <div class="empty-state empty-state--inline">
        <p>Nenhuma especificação cadastrada para este produto.</p>
      </div>
    `;

  root.innerHTML = `
    <div class="product-detail fade-in">
      <div class="product-gallery">
        <div class="product-main-image">
          ${productCardBadge(product)}
          <span class="product-image-wishlist" aria-hidden="true">${ICONS.heart}</span>
          <div class="product-image">${imageContent}</div>
          ${galleryNavigationContent}
        </div>
        ${thumbnailsContent}
      </div>

      <div class="product-info">
        <div class="product-meta-row">
          <span class="badge product-category-badge">${escapeHtml(product.categoryName || '')}</span>
          <span class="product-sku">SKU: ${productSku(product)}</span>
        </div>

        <h1>${escapeHtml(product.name)}</h1>

        <div class="product-variants">
          <div class="product-variants-header">
            <h3>Tamanho</h3>
            <button type="button" class="product-size-guide" data-size-guide>Tabela de medidas</button>
          </div>
          <div class="variant-chips" data-variant-chips></div>
        </div>

        <div class="product-price-block">
          <span class="product-price" data-product-price>Selecione um tamanho</span>
          <span class="product-installment" data-product-installment hidden></span>
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

        <div class="product-actions">
          <button class="btn btn-primary product-add-btn" type="button" data-add-to-cart disabled>
            ${ICONS.cart}
            <span>Adicionar ao carrinho</span>
          </button>
          <span class="product-wishlist-btn" aria-hidden="true">${ICONS.heart}</span>
        </div>

        <form class="product-shipping" data-shipping-form>
          <span class="product-shipping-title">Calcular Frete</span>
          <div class="product-shipping-row">
            <input type="text" inputmode="numeric" maxlength="9" placeholder="00000-000" data-shipping-cep />
            <button type="submit">Calcular</button>
          </div>
          <div class="product-shipping-result" data-shipping-result></div>
        </form>

        <div class="product-benefits">
          <span>${SHIPPING_ICON} Frete grátis acima de R$199</span>
          <span>${EXCHANGE_ICON} Troca em 30 dias</span>
          <span>${SHIELD_ICON} Compra segura</span>
        </div>
      </div>
    </div>

    <div class="product-tabs">
      <div class="product-tabs-nav" role="tablist">
        <button type="button" class="is-active" data-tab-trigger="desc" role="tab">Descrição</button>
        <button type="button" data-tab-trigger="specs" role="tab">Especificações</button>
        <button type="button" data-tab-trigger="size" role="tab">Tabela de Medidas</button>
        <button type="button" data-tab-trigger="reviews" role="tab">Avaliações</button>
      </div>
      <div class="product-tab-panel" data-tab-panel="desc">
        <p>${escapeHtml(product.description || 'Sem descrição disponível.')}</p>
      </div>
      <div class="product-tab-panel" data-tab-panel="specs" hidden>
        ${specificationsContent}
      </div>
      <div class="product-tab-panel" data-tab-panel="size" hidden>
        <div class="empty-state empty-state--inline">
          <p>Tabela de medidas em breve.</p>
        </div>
      </div>
      <div class="product-tab-panel" data-tab-panel="reviews" hidden>
        <div class="empty-state empty-state--inline">
          <p>Ainda não há avaliações para este produto.</p>
        </div>
      </div>
    </div>

    <div class="related-products" data-related-root hidden>
      <div class="section-header-row">
        <div>
          <div class="section-eyebrow">Você também pode gostar</div>
          <h2 class="section-heading">Produtos Relacionados</h2>
        </div>
        <a class="section-link" href="shop.html${product.categoryId ? `?category=${product.categoryId}` : ''}">Ver todos →</a>
      </div>
      <div class="product-grid" data-related-grid></div>
    </div>
  `;

  wireProductGallery();
  wireProductInteractions(product);
  wireProductTabs();
  wireShippingForm();
  loadRelatedProducts(product);
}

function wireProductGallery() {
  const mainImage = document.querySelector('[data-product-main-image]');
  const thumbnails = document.querySelectorAll('[data-product-thumbnail]');
  const navigationButtons = document.querySelectorAll('[data-gallery-direction]');

  if (!mainImage || !thumbnails.length) return;

  thumbnails.forEach((thumbnail) => {
    const thumbnailImage = thumbnail.querySelector('img');

    if (thumbnailImage) {
      thumbnailImage.addEventListener('error', () => {
        thumbnailImage.src = thumbnail.dataset.fullImage;
      }, { once: true });
    }

    thumbnail.addEventListener('click', () => {
      mainImage.src = thumbnail.dataset.fullImage;

      thumbnails.forEach((item) => {
        const isActive = item === thumbnail;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
    });
  });

  navigationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const activeIndex = Array.from(thumbnails)
        .findIndex((thumbnail) => thumbnail.classList.contains('is-active'));
      const currentIndex = activeIndex >= 0 ? activeIndex : 0;
      const offset = button.dataset.galleryDirection === 'next' ? 1 : -1;
      const targetIndex = (currentIndex + offset + thumbnails.length) % thumbnails.length;

      thumbnails[targetIndex].click();
    });
  });
}

function wireProductTabs() {
  const triggers = document.querySelectorAll('[data-tab-trigger]');
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const tab = trigger.dataset.tabTrigger;
      triggers.forEach((t) => t.classList.toggle('is-active', t === trigger));
      document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.tabPanel !== tab;
      });
    });
  });

  document.querySelector('[data-size-guide]').addEventListener('click', () => {
    showToast('Tabela de medidas em breve', 'info');
  });
}

function shippingOptionRow(option) {
  return `
    <div class="product-shipping-option">
      <span>${escapeHtml(option.methodLabel)} — até ${applyHandlingDays(option.deadlineDays)} dias úteis</span>
      <strong>${formatPrice(option.price)}</strong>
    </div>
  `;
}

function wireShippingForm() {
  const form = document.querySelector('[data-shipping-form]');
  const cepInput = document.querySelector('[data-shipping-cep]');
  const result = document.querySelector('[data-shipping-result]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const digits = cepInput.value.replace(/\D/g, '');

    if (digits.length !== 8) {
      result.innerHTML = '<p class="empty-state empty-state--inline">Informe um CEP válido.</p>';
      return;
    }

    result.innerHTML = '<p class="empty-state empty-state--inline"><span class="spinner"></span> Calculando frete...</p>';

    try {
      const options = await apiGet(`/shipping/calculate?cep=${encodeURIComponent(digits)}`);
      result.innerHTML = options.length
        ? options.map(shippingOptionRow).join('')
        : '<p class="empty-state empty-state--inline">Não foi possível calcular o frete para este CEP.</p>';
    } catch (error) {
      result.innerHTML = '<p class="empty-state empty-state--inline">Não foi possível calcular o frete para este CEP.</p>';
      showToast(error.message || 'Erro ao calcular frete', 'error');
    }
  });
}

async function loadRelatedProducts(product) {
  if (!product.categoryId) return;

  const grid = document.querySelector('[data-related-grid]');
  const section = document.querySelector('[data-related-root]');

  try {
    const response = await apiGet(`/products?page=0&size=20`);
    const related = response.content
      .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
      .slice(0, RELATED_PRODUCTS_COUNT);

    if (!related.length) return;

    grid.innerHTML = related.map((p) => buildProductCard(p)).join('');
    section.hidden = false;
  } catch (error) {
    logAppError('product.related.load', error, {
      code: 'RELATED_PRODUCTS_LOAD_FAILED',
      productId: product.id,
    });
  }
}

function wireProductInteractions(product) {
  const chipsContainer = document.querySelector('[data-variant-chips]');
  const priceEl = document.querySelector('[data-product-price]');
  const installmentEl = document.querySelector('[data-product-installment]');
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
    : '<p class="empty-state empty-state--inline">Sem variações cadastradas.</p>';

  function selectVariant(variant) {
    selectedVariant = variant;
    chipsContainer.querySelectorAll('.variant-chip').forEach((chip) => {
      chip.classList.toggle('is-selected', chip.dataset.variantId === variant.id);
    });
    priceEl.textContent = formatPrice(variant.price);
    installmentEl.hidden = false;
    installmentEl.textContent = `ou 3x de ${formatPrice(variant.price / 3)} sem juros`;
    stockEl.innerHTML = `${CLOCK_ICON} ${variant.stock} unidades disponíveis`;
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
      addToGuestCart({
        variantId: selectedVariant.id,
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        size: selectedVariant.size,
        price: selectedVariant.price,
        quantity: Number(qtyInput.value),
        stock: selectedVariant.stock,
      });
      setCartCount(guestCartCount());
      showToast('Produto adicionado ao carrinho!', 'success');
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
