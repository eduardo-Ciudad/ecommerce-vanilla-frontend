const LOCAL_SALE_PAYMENT_OPTIONS = [
  ['CASH', 'Dinheiro'],
  ['PIX', 'Pix'],
  ['CARD_MACHINE', 'Maquininha'],
  ['PAYMENT_LINK', 'Link de pagamento'],
  ['STORE_CREDIT', 'Fiado'],
];

let localSaleItems = [];
let localSalePaymentMethod = '';
let localSaleSearchController = null;
let localSaleSearchTimer = null;
let localSaleSubmitting = false;
let localSaleSearchResults = [];

function parseLocalSaleDiscount() {
  const input = document.getElementById('sale-discount').value.trim();
  if (!input) return 0;
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(input)) return NaN;
  const value = Number(input.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : NaN;
}

function localSaleSubtotal() {
  return localSaleItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
}

function localSaleVariantLabel(variant) {
  return variantShortLabel({ color: variant.color, size: variant.size });
}

function renderLocalSalePayments() {
  const container = document.querySelector('[data-sale-payments]');
  container.innerHTML = LOCAL_SALE_PAYMENT_OPTIONS.map(([value, label]) => `
    <button type="button" class="local-sale-payment-btn" data-payment-method="${escapeAttr(value)}" aria-pressed="false">${escapeHtml(label)}</button>
  `).join('');
  container.querySelectorAll('[data-payment-method]').forEach((button) => {
    button.addEventListener('click', () => {
      localSalePaymentMethod = button.dataset.paymentMethod;
      container.querySelectorAll('[data-payment-method]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      document.querySelector('[data-store-credit-warning]').hidden = localSalePaymentMethod !== 'STORE_CREDIT';
      updateLocalSaleSummary();
    });
  });
}

function renderLocalSaleSearchState(content) {
  document.querySelector('[data-sale-results]').innerHTML = content;
}

function normalizeLocalSaleCode(value) {
  return String(value || '').trim().toLocaleUpperCase('pt-BR');
}

function localSaleVariantDisplayName(variant) {
  const label = localSaleVariantLabel(variant);
  return [variant.productName, label].filter(Boolean).join(' ');
}

function renderLocalSaleSearchResults(products, term, addExactMatch = false) {
  const allVariants = products.flatMap((product) => (product.variants || []).map((variant) => ({
    ...variant,
    productName: product.name,
  })));
  const normalizedTerm = normalizeLocalSaleCode(term);
  const exactMatches = allVariants.filter((variant) => (
    normalizeLocalSaleCode(variant.sku) === normalizedTerm
    || normalizeLocalSaleCode(variant.gtin) === normalizedTerm
  ));
  localSaleSearchResults = exactMatches.length ? exactMatches : allVariants;

  if (addExactMatch && exactMatches.length === 1) {
    const [variant] = exactMatches;
    const existingQuantity = localSaleItems.find((item) => item.id === variant.id)?.quantity || 0;
    const displayName = localSaleVariantDisplayName(variant);
    if (Number(variant.stock || 0) <= existingQuantity) {
      showToast(`Sem estoque: ${displayName}`, 'warning');
    } else {
      addLocalSaleVariant(variant.id);
      showToast(`Adicionado: ${displayName}`, 'success');
    }
    const searchInput = document.getElementById('local-sale-search');
    searchInput.value = '';
    searchInput.focus();
    renderLocalSaleSearchState('<p class="empty-state empty-state--spacious">Digite pelo menos 2 caracteres para buscar.</p>');
    return;
  }

  if (!localSaleSearchResults.length) {
    renderLocalSaleSearchState('<p class="empty-state empty-state--spacious">Nenhuma variante encontrada.</p>');
    return;
  }
  renderLocalSaleSearchState(localSaleSearchResults.map((variant) => {
    const stock = Number(variant.stock || 0);
    const label = localSaleVariantLabel(variant);
    return `
      <div class="local-sale-result-row">
        <div class="local-sale-result-info"><strong>${escapeHtml(variant.productName)}</strong>${label ? `<span>${escapeHtml(label)}</span>` : ''}${variant.sku || variant.gtin ? `<small>${variant.sku ? `SKU: ${escapeHtml(variant.sku)}` : ''}${variant.sku && variant.gtin ? ' · ' : ''}${variant.gtin ? `Cód.: ${escapeHtml(variant.gtin)}` : ''}</small>` : ''}</div>
        <span class="local-sale-stock">${escapeHtml(stock)} em estoque</span>
        <strong class="local-sale-price">${formatPrice(variant.price)}</strong>
        <button class="btn btn-secondary" type="button" data-add-variant="${escapeAttr(variant.id)}" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Sem estoque' : 'Adicionar'}</button>
      </div>`;
  }).join(''));
  document.querySelectorAll('[data-add-variant]').forEach((button) => {
    button.addEventListener('click', () => addLocalSaleVariant(button.dataset.addVariant));
  });
}

async function searchLocalSaleProducts(term, addExactMatch = false) {
  localSaleSearchController?.abort();
  localSaleSearchController = new AbortController();
  renderLocalSaleSearchState('<div class="local-sale-search-skeleton"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>');
  try {
    const response = await apiGet(`/products?page=0&size=20&includeWithoutImage=true&q=${encodeURIComponent(term)}`, { signal: localSaleSearchController.signal });
    renderLocalSaleSearchResults(response.content || [], term, addExactMatch);
  } catch (error) {
    if (error.code === 'API_ABORTED') return;
    renderLocalSaleSearchState('<p class="empty-state empty-state--spacious">Não foi possível buscar os produtos. Tente novamente.</p>');
  }
}

function addLocalSaleVariant(variantId) {
  const variant = localSaleSearchResults.find((item) => item.id === variantId);
  if (!variant) return false;
  const existing = localSaleItems.find((item) => item.id === variantId);
  if (existing) {
    if (existing.quantity >= Number(existing.stock)) {
      showToast('A quantidade já atingiu o estoque disponível', 'warning');
      return false;
    }
    existing.quantity += 1;
  } else {
    localSaleItems.push({ ...variant, quantity: 1 });
  }
  renderLocalSaleItems();
  return true;
}

function changeLocalSaleQuantity(variantId, delta) {
  const item = localSaleItems.find((entry) => entry.id === variantId);
  if (!item) return;
  item.quantity = Math.max(1, Math.min(Number(item.stock), item.quantity + delta));
  renderLocalSaleItems();
}

function removeLocalSaleItem(variantId) {
  localSaleItems = localSaleItems.filter((item) => item.id !== variantId);
  renderLocalSaleItems();
}

function renderLocalSaleItems() {
  const container = document.querySelector('[data-sale-items]');
  if (!localSaleItems.length) {
    container.innerHTML = '<p class="empty-state empty-state--spacious">Busque um produto acima e clique em Adicionar.</p>';
    updateLocalSaleSummary();
    return;
  }
  container.innerHTML = `<div class="local-sale-items-head"><span>Produto</span><span>Quantidade</span><span>Unitário</span><span>Total</span><span></span></div>${localSaleItems.map((item) => {
    const label = localSaleVariantLabel(item);
    return `<div class="local-sale-item-row">
      <div class="local-sale-item-name"><strong>${escapeHtml(item.productName)}</strong>${label ? `<span>${escapeHtml(label)}</span>` : ''}</div>
      <div class="local-sale-quantity"><button type="button" data-quantity-minus="${escapeAttr(item.id)}" aria-label="Diminuir quantidade" ${item.quantity <= 1 ? 'disabled' : ''}>−</button><span>${escapeHtml(item.quantity)}</span><button type="button" data-quantity-plus="${escapeAttr(item.id)}" aria-label="Aumentar quantidade" ${item.quantity >= Number(item.stock) ? 'disabled' : ''}>+</button></div>
      <span data-label="Unitário">${formatPrice(item.price)}</span><strong data-label="Total">${formatPrice(Number(item.price) * item.quantity)}</strong>
      <button class="icon-btn icon-btn-danger" type="button" data-remove-item="${escapeAttr(item.id)}" aria-label="Remover ${escapeAttr(item.productName)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2m2 0l-1 14H7L6 6"/></svg></button>
    </div>`;
  }).join('')}`;
  container.querySelectorAll('[data-quantity-minus]').forEach((button) => button.addEventListener('click', () => changeLocalSaleQuantity(button.dataset.quantityMinus, -1)));
  container.querySelectorAll('[data-quantity-plus]').forEach((button) => button.addEventListener('click', () => changeLocalSaleQuantity(button.dataset.quantityPlus, 1)));
  container.querySelectorAll('[data-remove-item]').forEach((button) => button.addEventListener('click', () => removeLocalSaleItem(button.dataset.removeItem)));
  updateLocalSaleSummary();
}

function updateLocalSaleSummary() {
  const subtotal = localSaleSubtotal();
  const discount = parseLocalSaleDiscount();
  const invalidNumber = Number.isNaN(discount);
  const invalidTotal = !invalidNumber && subtotal > 0 && discount >= subtotal;
  const error = document.querySelector('[data-discount-error]');
  error.textContent = invalidTotal ? 'O desconto precisa ser menor que o total dos itens.' : (invalidNumber ? 'Informe um desconto válido.' : '');
  document.getElementById('sale-discount').setAttribute('aria-invalid', String(invalidNumber || invalidTotal));
  document.querySelector('[data-sale-subtotal]').textContent = formatPrice(subtotal);
  document.querySelector('[data-sale-discount-total]').textContent = `− ${formatPrice(Number.isFinite(discount) ? discount : 0)}`;
  document.querySelector('[data-sale-total]').textContent = formatPrice(Math.max(0, subtotal - (Number.isFinite(discount) ? discount : 0)));
  document.querySelector('[data-sale-total-mobile]').textContent = formatPrice(Math.max(0, subtotal - (Number.isFinite(discount) ? discount : 0)));
  document.querySelectorAll('[data-sale-submit], [data-sale-submit-mobile]').forEach((button) => {
    button.disabled = localSaleSubmitting || !localSaleItems.length || !localSalePaymentMethod || invalidNumber || invalidTotal;
  });
}

function resetLocalSaleForm() {
  localSaleItems = [];
  localSalePaymentMethod = '';
  document.getElementById('sale-customer').value = '';
  document.getElementById('sale-discount').value = '';
  document.querySelector('[data-store-credit-warning]').hidden = true;
  document.querySelectorAll('[data-payment-method]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  renderLocalSaleItems();
}

async function submitLocalSale() {
  if (localSaleSubmitting) return;
  const discount = parseLocalSaleDiscount();
  const customerName = document.getElementById('sale-customer').value.trim();
  const paymentLabel = LOCAL_SALE_PAYMENT_OPTIONS.find(([value]) => value === localSalePaymentMethod)?.[1] || '';
  const payload = {
    items: localSaleItems.map((item) => ({ variantId: item.id, quantity: item.quantity })),
    paymentMethod: localSalePaymentMethod,
  };
  if (customerName) payload.customerName = customerName;
  if (discount > 0) payload.discountAmount = discount;

  const buttons = document.querySelectorAll('[data-sale-submit], [data-sale-submit-mobile]');
  localSaleSubmitting = true;
  buttons.forEach((button) => { button.disabled = true; button.textContent = 'Registrando...'; });
  try {
    const order = await apiPost('/orders/admin/local-sales', payload);
    const total = Number(order.total);
    resetLocalSaleForm();
    const banner = document.querySelector('[data-sale-success]');
    banner.innerHTML = `<div><strong>Venda registrada: ${formatPrice(total)} em ${escapeHtml(paymentLabel)}</strong><span>Pedido #${escapeHtml(String(order.id).slice(0, 8))} · estoque atualizado · enviando ao Bling</span></div><button class="btn btn-secondary" type="button" data-new-local-sale>Nova venda</button>`;
    banner.hidden = false;
    banner.querySelector('[data-new-local-sale]').addEventListener('click', () => {
      banner.hidden = true;
      document.getElementById('local-sale-search').focus();
    });
    banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Venda registrada com sucesso', 'success');
  } catch (error) {
    showToast(error.message || 'Não foi possível registrar a venda', 'error');
  } finally {
    localSaleSubmitting = false;
    buttons.forEach((button) => { button.textContent = 'Registrar venda'; });
    updateLocalSaleSummary();
  }
}

function initLocalSalePage() {
  if (!requireAdmin()) return;
  renderLocalSalePayments();
  renderLocalSaleItems();
  const searchInput = document.getElementById('local-sale-search');
  searchInput.addEventListener('input', () => {
    clearTimeout(localSaleSearchTimer);
    const term = searchInput.value.trim();
    if (term.length < 2) {
      localSaleSearchController?.abort();
      renderLocalSaleSearchState('<p class="empty-state empty-state--spacious">Digite pelo menos 2 caracteres para buscar.</p>');
      return;
    }
    localSaleSearchTimer = setTimeout(() => searchLocalSaleProducts(term), 300);
  });
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    clearTimeout(localSaleSearchTimer);
    const term = searchInput.value.trim();
    if (term.length < 2) {
      localSaleSearchController?.abort();
      renderLocalSaleSearchState('<p class="empty-state empty-state--spacious">Digite pelo menos 2 caracteres para buscar.</p>');
      return;
    }
    searchLocalSaleProducts(term, true);
  });
  document.getElementById('sale-discount').addEventListener('input', updateLocalSaleSummary);
  document.querySelector('[data-sale-submit]').addEventListener('click', submitLocalSale);
  document.querySelector('[data-sale-submit-mobile]').addEventListener('click', submitLocalSale);
}

document.addEventListener('DOMContentLoaded', initLocalSalePage);
