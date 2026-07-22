const ORDER_STATUS_LABELS = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

const ORDER_STATUS_BADGE_CLASS = {
  PENDING: 'badge-pending',
  PAID: 'badge-paid',
  SHIPPED: 'badge-shipped',
  DELIVERED: 'badge-delivered',
  CANCELLED: 'badge-cancelled',
};

function formatOrderDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function renderEmptyOrders() {
  document.querySelector('[data-orders-root]').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${ICONS.package}</div>
      <p>Você ainda não fez nenhum pedido.</p>
      <a class="btn btn-primary" href="shop.html">Ir às compras</a>
    </div>
  `;
}

function renderOrderItem(item) {
  return `
    <li class="order-item-row">
      <span>${escapeHtml(item.productName)} (${escapeHtml(item.size)})</span>
      <span>${item.quantity}x ${formatPrice(item.unitPrice)}</span>
    </li>
  `;
}

function renderOrderCard(order) {
  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
  const badgeClass = ORDER_STATUS_BADGE_CLASS[order.status] || '';

  const paymentBadge = order.paymentStatus
    ? `<span class="badge ${PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] || ''}">${PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</span>`
    : '';

  // Fica fora do <button> do acordeão: um <a> não pode ser aninhado dentro de um
  // elemento interativo sem quebrar o toggle e a navegação do link.
  const payNowRow = order.status === 'PENDING' && !order.paymentStatus
    ? `<div class="order-card-pay-row"><a href="checkout.html?orderId=${order.id}" class="btn btn-primary btn-sm">Pagar agora</a></div>`
    : '';

  return `
    <li class="order-card fade-in" data-order-id="${order.id}">
      <button class="order-card-header" type="button" data-order-toggle>
        <div class="order-card-main">
          <span class="order-card-number">Pedido #${order.id.slice(0, 8)}</span>
          <span class="order-card-date">${formatOrderDate(order.createdAt)}</span>
        </div>
        <div class="order-card-badges">
          <span class="badge ${badgeClass}">${statusLabel}</span>
          ${paymentBadge}
        </div>
        <span class="order-card-total">${formatPrice(order.total)}</span>
        <svg class="order-card-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      ${payNowRow}
      <ul class="order-item-list" data-order-items>
        ${order.items.map(renderOrderItem).join('')}
      </ul>
    </li>
  `;
}

function wireOrderAccordions() {
  document.querySelectorAll('[data-order-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.order-card').classList.toggle('is-open');
    });
  });
}

async function initOrdersPage() {
  if (!requireAuth()) return;

  const root = document.querySelector('[data-orders-root]');
  try {
    const orders = await apiGet('/orders');
    if (!orders.length) {
      renderEmptyOrders();
      return;
    }

    const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    root.innerHTML = `<ul class="orders-list stagger-fade">${sorted.map(renderOrderCard).join('')}</ul>`;
    wireOrderAccordions();
  } catch (error) {
    root.innerHTML = '<p class="empty-state">Não foi possível carregar seus pedidos.</p>';
    showToast(error.message || 'Erro ao carregar pedidos', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initOrdersPage);
