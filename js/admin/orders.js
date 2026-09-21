function formatAdminOrderAddress(order) {
  if (!order.recipientStreet) return '—';
  const complement = order.recipientComplement ? `, ${escapeHtml(order.recipientComplement)}` : '';
  return `${escapeHtml(order.recipientStreet)}, ${escapeHtml(order.recipientNumber)}${complement} — ${escapeHtml(order.recipientNeighborhood)}, ${escapeHtml(order.recipientCity)}/${escapeHtml(order.recipientState)} — CEP ${escapeHtml(order.recipientCep)}`;
}

function formatAdminOrderShipping(order) {
  if (!order.shippingMethod) return '—';
  return `${escapeHtml(order.shippingMethod)} (até ${applyHandlingDays(order.shippingDeadlineDays)} dias) — ${formatPrice(order.shippingPrice)}`;
}

function renderOrderItemsList(items) {
  return items
    .map(
      (item) => `
        <div class="variant-manage-row">
          <span>${escapeHtml(item.productName)} (${escapeHtml(item.size)})</span>
          <span>${item.quantity}x ${formatPrice(item.unitPrice)}</span>
        </div>
      `
    )
    .join('');
}

function renderOrderDetailsContent(order) {
  const paymentStatus = order.paymentStatus
    ? `<span class="badge ${PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] || ''}">${PAYMENT_STATUS_LABELS[order.paymentStatus] || escapeHtml(order.paymentStatus)}</span>`
    : '<span class="badge badge-pending">Não iniciado</span>';

  return `
    <p><strong>ID:</strong> ${escapeHtml(order.id)}</p>
    <p><strong>Data de criação:</strong> ${new Date(order.createdAt).toLocaleString('pt-BR')}</p>
    <p><strong>Destinatário:</strong> ${escapeHtml(order.recipientName)}</p>
    <p>
      <strong>Status:</strong>
      <span class="badge ${ADMIN_ORDER_STATUS_BADGE_CLASS[order.status] || ''}">${ADMIN_ORDER_STATUS_LABELS[order.status] || escapeHtml(order.status)}</span>
    </p>
    <p><strong>Pagamento:</strong> ${paymentStatus}</p>
    <h4 class="modal-subtitle">Itens</h4>
    ${renderOrderItemsList(order.items)}
    <h4 class="modal-subtitle">Entrega</h4>
    <p>${formatAdminOrderAddress(order)}</p>
    <p>${formatAdminOrderShipping(order)}</p>
    <p><strong>Total do pedido: ${formatPrice(order.total)}</strong></p>
  `;
}

function renderOrderIdCell(orderId, expanded = false) {
  if (!expanded) {
    return `<button type="button" class="id-toggle" data-id-toggle="${orderId}">${orderId.slice(0, 8)}...</button>`;
  }

  return `
    <div class="order-id-cell">
      <span class="id-full">${orderId}</span>
      <button type="button" class="icon-btn" data-copy-id="${orderId}" title="Copiar ID completo" aria-label="Copiar ID completo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>
      <button type="button" class="id-toggle" data-id-toggle="${orderId}" title="Recolher">▲</button>
    </div>
  `;
}

function attachOrderIdCellListeners(cell, orderId, expanded) {
  cell.querySelector('[data-id-toggle]').addEventListener('click', () => {
    cell.innerHTML = renderOrderIdCell(orderId, !expanded);
    attachOrderIdCellListeners(cell, orderId, !expanded);
  });

  const copyButton = cell.querySelector('[data-copy-id]');
  if (copyButton) {
    copyButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      try {
        await navigator.clipboard.writeText(orderId);
        showToast('ID copiado!', 'success');
      } catch {
        showToast('Não foi possível copiar o ID', 'error');
      }
    });
  }
}

function renderAdminOrdersTable(orders) {
  const tbody = document.querySelector('[data-admin-orders-tbody]');

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state">Nenhum pedido encontrado nesta conta.</div></td></tr>';
    return;
  }

  tbody.innerHTML = orders
    .map(
      (order) => `
        <tr>
          <td>${renderOrderIdCell(order.id, false)}</td>
          <td>${new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
          <td><span class="badge ${ADMIN_ORDER_STATUS_BADGE_CLASS[order.status] || ''}">${ADMIN_ORDER_STATUS_LABELS[order.status] || escapeHtml(order.status)}</span></td>
          <td>
            ${order.paymentStatus
              ? `<span class="badge ${PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] || ''}">${PAYMENT_STATUS_LABELS[order.paymentStatus] || escapeHtml(order.paymentStatus)}</span>`
              : '<span class="badge badge-pending">Não iniciado</span>'}
          </td>
          <td>${formatPrice(order.total)}</td>
          <td>${order.items.length}</td>
          <td>${formatAdminOrderAddress(order)}</td>
          <td>${formatAdminOrderShipping(order)}</td>
          <td>
            <button class="icon-btn" type="button" data-view-order="${order.id}" title="Ver detalhes do pedido" aria-label="Ver detalhes do pedido">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('[data-id-toggle]').forEach((button) => {
    const cell = button.closest('td');
    attachOrderIdCellListeners(cell, button.dataset.idToggle, false);
  });

  tbody.querySelectorAll('[data-view-order]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const order = orders.find((o) => o.id === btn.dataset.viewOrder);
      openModal({ title: 'Detalhes do Pedido', content: renderOrderDetailsContent(order), showFooter: false });
    });
  });
}

async function loadAdminOrders() {
  const tbody = document.querySelector('[data-admin-orders-tbody]');
  try {
const response = await apiGet('/orders/admin?page=0&size=1000');    const orders = response.content;
    renderAdminOrdersTable(orders);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state">Não foi possível carregar os pedidos.</div></td></tr>';
    showToast(error.message || 'Erro ao carregar pedidos', 'error');
  }
}

function initUpdateStatusForm() {
  const form = document.querySelector('[data-update-status-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const orderId = document.getElementById('order-id-input').value.trim();
    const status = document.getElementById('order-status-select').value;
    const button = form.querySelector('button[type="submit"]');

    button.disabled = true;
    const originalText = button.textContent;
    button.innerHTML = '<span class="spinner"></span>';

    try {
      await apiPut(`/orders/${orderId}/status`, status);
      showToast('Status do pedido atualizado com sucesso', 'success');
      form.reset();
      await loadAdminOrders();
    } catch (error) {
      showToast(error.message || 'Não foi possível atualizar o status', 'error');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

async function initAdminOrdersPage() {
  if (!requireAdmin()) return;
  initUpdateStatusForm();
  await loadAdminOrders();
}

document.addEventListener('DOMContentLoaded', initAdminOrdersPage);
