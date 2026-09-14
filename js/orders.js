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

const ORDER_TIMELINE_STEPS = ['Pedido feito', 'Pagamento confirmado', 'Enviado', 'Entregue'];
const ORDER_TIMELINE_CURRENT_STEP = { PENDING: 1, PAID: 2, SHIPPED: 3 };

function renderOrderTimeline(order) {
  if (order.status === 'CANCELLED') return '';

  const allStepsDone = order.status === 'DELIVERED';
  const currentStep = ORDER_TIMELINE_CURRENT_STEP[order.status];
  const steps = ORDER_TIMELINE_STEPS.map((label, index) => {
    const isDone = allStepsDone || index < currentStep;
    const isCurrent = !allStepsDone && index === currentStep;
    const stateClass = isDone ? 'is-done' : isCurrent ? 'is-current' : 'is-pending';
    const stateLabel = isDone ? 'concluído' : isCurrent ? 'em andamento' : 'pendente';
    const connector = index < ORDER_TIMELINE_STEPS.length - 1
      ? `<li class="order-timeline-connector${allStepsDone || index + 1 < currentStep ? ' is-done' : ''}" aria-hidden="true"></li>`
      : '';

    return `
      <li class="order-timeline-step ${stateClass}" aria-label="${label}: ${stateLabel}">
        <span class="order-timeline-marker" aria-hidden="true">${isDone ? ICONS.check : ''}</span>
        <span class="order-timeline-label">${label}</span>
      </li>
      ${connector}
    `;
  }).join('');

  return `<ol class="order-timeline" aria-label="Acompanhamento do pedido">${steps}</ol>`;
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
    ? `
      <div class="order-card-pay-row">
        <a href="checkout.html?orderId=${order.id}" class="btn btn-primary btn-sm">Pagar agora</a>
        <button type="button" class="btn btn-ghost btn-sm" data-order-cancel>Cancelar pedido</button>
      </div>
    `
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
      <div class="order-item-list" data-order-items>
        ${renderOrderTimeline(order)}
        <ul class="order-products-list">
          ${order.items.map(renderOrderItem).join('')}
        </ul>
      </div>
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

function wireOrderCancellation() {
  document.querySelectorAll('[data-order-cancel]').forEach((button) => {
    button.addEventListener('click', () => {
      const orderId = button.closest('[data-order-id]').dataset.orderId;
      const modal = openModal({
        title: 'Cancelar pedido?',
        content: 'O estoque dos itens será devolvido e essa ação não pode ser desfeita.',
        confirmLabel: 'Sim, cancelar pedido',
        cancelLabel: 'Voltar',
        onConfirm: async () => {
          const confirmButton = modal.querySelector('[data-action="confirm"]');
          confirmButton.disabled = true;

          try {
            await apiPut(`/orders/${orderId}/cancel`, {});
            closeModal();
            showToast('Pedido cancelado com sucesso', 'success');
          } catch (error) {
            showToast(error.message || 'Não foi possível cancelar o pedido', 'error');
          } finally {
            try {
              await loadAndRenderOrders();
            } catch (error) {
              showToast(error.message || 'Não foi possível atualizar os pedidos', 'error');
            }
            if (document.body.contains(confirmButton)) confirmButton.disabled = false;
          }
        },
      });
    });
  });
}

async function loadAndRenderOrders() {
  const root = document.querySelector('[data-orders-root]');
  const response = await apiGet('/orders?page=0&size=1000');
  const orders = response.content;

  if (!orders.length) {
    renderEmptyOrders();
    return;
  }

  const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  root.innerHTML = `<ul class="orders-list stagger-fade">${sorted.map(renderOrderCard).join('')}</ul>`;
  wireOrderAccordions();
  wireOrderCancellation();
}

function initChangePasswordForm() {
  const form = document.querySelector('[data-form="change-password"]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    let hasError = false;

    if (!currentPassword) {
      setFieldError(form.currentPassword, 'Informe sua senha atual');
      hasError = true;
    }
    if (newPassword.length < 6) {
      setFieldError(form.newPassword, 'A nova senha deve ter no mínimo 6 caracteres');
      hasError = true;
    }
    if (hasError) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('.btn-label').innerHTML = '<span class="spinner"></span>';

    try {
      const data = await apiPost('/auth/change-password', { currentPassword, newPassword });
      showToast(
        data?.message || 'Enviamos um email para confirmar a alteração de senha. Ela só será trocada após a confirmação.',
        'success'
      );
      form.reset();
    } catch (error) {
      showToast(error.message || 'Não foi possível iniciar a alteração de senha', 'error');
    } finally {
      button.disabled = false;
      button.querySelector('.btn-label').textContent = 'Alterar senha';
    }
  });
}

async function initOrdersPage() {
  if (!requireAuth()) return;

  initChangePasswordForm();

  try {
    await loadAndRenderOrders();
  } catch (error) {
    const root = document.querySelector('[data-orders-root]');
    root.innerHTML = '<p class="empty-state">Não foi possível carregar seus pedidos.</p>';
    showToast(error.message || 'Erro ao carregar pedidos', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initOrdersPage);
