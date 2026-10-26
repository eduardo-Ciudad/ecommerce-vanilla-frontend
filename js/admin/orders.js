let adminOrders = [];

function canResendOrderToBling(order) {
  return order.bling?.status === 'FAILED'
    || (order.bling?.status == null && ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status));
}

function renderBlingResendButton(order) {
  if (!canResendOrderToBling(order)) return '';
  return `<button class="btn btn-ghost btn-sm bling-resend-btn" type="button" data-bling-resend="${escapeAttr(order.id)}">Reenviar</button>`;
}

function renderBlingTableCell(order) {
  if (order.bling?.status == null && ['PENDING', 'CANCELLED'].includes(order.status)) return '—';

  return `
    <div class="bling-status-cell">
      ${renderBlingStatusBadge(order.bling)}
      ${order.bling?.status === 'SENT' && order.bling.blingOrderId != null
        ? `<small>#${escapeHtml(order.bling.blingOrderId)}</small>`
        : ''}
      ${renderBlingResendButton(order)}
    </div>
  `;
}

function renderBlingDetails(bling) {
  if (!bling) return '';

  const syncedDate = bling.syncedAt ? new Date(bling.syncedAt) : null;
  const syncedAt = syncedDate && !Number.isNaN(syncedDate.getTime())
    ? syncedDate.toLocaleString('pt-BR')
    : '';

  return `
    <section class="admin-order-detail-section admin-order-detail-bling">
      <h4 class="admin-order-detail-section-title">Bling</h4>
      <dl class="admin-order-detail-data">
        <div><dt>Status</dt><dd>${renderBlingStatusBadge(bling)}</dd></div>
        ${bling.blingOrderId != null ? `<div><dt>Pedido no Bling</dt><dd>#${escapeHtml(bling.blingOrderId)}</dd></div>` : ''}
        <div><dt>Tentativas</dt><dd>${escapeHtml(bling.attempts ?? 0)}</dd></div>
        ${syncedAt ? `<div><dt>Data de envio</dt><dd>${escapeHtml(syncedAt)}</dd></div>` : ''}
        ${bling.error ? `<div><dt>Erro</dt><dd>${escapeHtml(bling.error)}</dd></div>` : ''}
      </dl>
    </section>
  `;
}

function formatAdminOrderAddress(order, multiline = false) {
  if (!order.recipientStreet) return '—';
  const complement = order.recipientComplement ? `, ${escapeHtml(order.recipientComplement)}` : '';
  const streetLine = `${escapeHtml(order.recipientStreet)}, ${escapeHtml(order.recipientNumber)}${complement} — ${escapeHtml(order.recipientNeighborhood)}`;
  const cityLine = `${escapeHtml(order.recipientCity)}/${escapeHtml(order.recipientState)} — CEP ${escapeHtml(order.recipientCep)}`;
  return multiline ? `${streetLine}<br>${cityLine}` : `${streetLine}, ${cityLine}`;
}

function formatAdminOrderShipping(order, includePrice = true) {
  if (!order.shippingMethod) return '—';
  const description = `${escapeHtml(order.shippingMethod)} (até ${applyHandlingDays(order.shippingDeadlineDays)} dias)`;
  return includePrice ? `${description} — ${formatPrice(order.shippingPrice)}` : description;
}

function renderOrderItemsList(items) {
  return items
    .map((item) => {
      const variantLabel = variantDescription(item);
      const codes = [
        item.sku ? `SKU: ${escapeHtml(item.sku)}` : '',
        item.gtin ? `EAN: ${escapeHtml(item.gtin)}` : '',
      ].filter(Boolean);
      const subtotal = Number(item.quantity) * Number(item.unitPrice);

      return `
        <div class="admin-order-detail-item">
          <div class="admin-order-detail-item-info">
            <span class="admin-order-detail-item-name">${escapeHtml(item.productName)}</span>
            ${variantLabel ? `<span class="admin-order-detail-item-variant">${escapeHtml(variantLabel)}</span>` : ''}
            ${codes.length ? `<span class="admin-order-detail-item-codes">${codes.join(' · ')}</span>` : ''}
          </div>
          <div class="admin-order-detail-item-price">
            <span>${escapeHtml(item.quantity)}x ${formatPrice(item.unitPrice)}</span>
            <strong>${formatPrice(subtotal)}</strong>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderOrderDetailsContent(order) {
  const itemCount = order.items.reduce((total, item) => total + Number(item.quantity), 0);
  const itemsSubtotal = order.items.reduce(
    (total, item) => total + Number(item.quantity) * Number(item.unitPrice),
    0
  );
  const discountAmount = Number(order.discountAmount);
  const paymentStatus = order.paymentStatus
    ? `<span class="badge ${PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] || ''}">${PAYMENT_STATUS_LABELS[order.paymentStatus] || escapeHtml(order.paymentStatus)}</span>`
    : '<span class="badge badge-pending">Não iniciado</span>';

  return `
    <div class="admin-order-detail-summary">
      <div class="admin-order-detail-heading">
        <div class="admin-order-detail-title-row">
          <strong>Pedido #${escapeHtml(order.id.slice(0, 8))}</strong>
          <button type="button" class="btn btn-ghost btn-sm admin-order-detail-copy" data-copy-order-detail-id>Copiar ID</button>
        </div>
        <span class="admin-order-detail-date">${new Date(order.createdAt).toLocaleString('pt-BR')}</span>
      </div>
      <div class="admin-order-detail-badges">
        <span class="badge ${ADMIN_ORDER_STATUS_BADGE_CLASS[order.status] || ''}">${ADMIN_ORDER_STATUS_LABELS[order.status] || escapeHtml(order.status)}</span>
        ${paymentStatus}
      </div>
    </div>

    <section class="admin-order-detail-section admin-order-detail-items">
      <h4 class="admin-order-detail-section-title">Itens (${itemCount})</h4>
      <div class="admin-order-detail-item-list">${renderOrderItemsList(order.items)}</div>
    </section>

    <div class="admin-order-detail-grid">
      <section class="admin-order-detail-section">
        <h4 class="admin-order-detail-section-title">Resumo</h4>
        <dl class="admin-order-detail-receipt">
          <div><dt>Subtotal dos itens</dt><dd>${formatPrice(itemsSubtotal)}</dd></div>
          ${discountAmount > 0 ? `<div><dt>Desconto (${escapeHtml(order.couponCode)})</dt><dd>− ${formatPrice(discountAmount)}</dd></div>` : ''}
          <div><dt>Frete <span>${formatAdminOrderShipping(order, false)}</span></dt><dd>${formatPrice(order.shippingPrice)}</dd></div>
          <div class="admin-order-detail-total"><dt>Total</dt><dd>${formatPrice(order.total)}</dd></div>
        </dl>
      </section>

      <section class="admin-order-detail-section">
        <h4 class="admin-order-detail-section-title">Entrega</h4>
        <div class="admin-order-detail-delivery">
          <div><span>Destinatário</span><strong>${escapeHtml(order.recipientName)}</strong></div>
          <div><span>Endereço</span><p>${formatAdminOrderAddress(order, true)}</p></div>
        </div>
      </section>
    </div>

    ${renderBlingDetails(order.bling)}
  `;
}

async function copyOrderId(orderId) {
  try {
    await navigator.clipboard.writeText(orderId);
    showToast('ID copiado!', 'success');
  } catch {
    showToast('Não foi possível copiar o ID', 'error');
  }
}

function renderOrderIdCell(orderId, expanded = false) {
  const escapedOrderId = escapeHtml(orderId);
  const orderIdAttr = escapeAttr(orderId);
  if (!expanded) {
    return `<button type="button" class="id-toggle" data-id-toggle="${orderIdAttr}">${escapeHtml(orderId.slice(0, 8))}...</button>`;
  }

  return `
    <div class="order-id-cell">
      <span class="id-full">${escapedOrderId}</span>
      <button type="button" class="icon-btn" data-copy-id="${orderIdAttr}" title="Copiar ID completo" aria-label="Copiar ID completo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>
      <button type="button" class="id-toggle" data-id-toggle="${orderIdAttr}" title="Recolher">▲</button>
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
      await copyOrderId(orderId);
    });
  }
}

function renderAdminOrdersTable(orders) {
  const tbody = document.querySelector('[data-admin-orders-tbody]');

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">Nenhum pedido encontrado nesta conta.</div></td></tr>';
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
          <td>${renderBlingTableCell(order)}</td>
          <td>${formatPrice(order.total)}</td>
          <td>${order.items.length}</td>
          <td>${formatAdminOrderAddress(order)}</td>
          <td>${formatAdminOrderShipping(order)}</td>
          <td>
            <button class="icon-btn" type="button" data-view-order="${escapeAttr(order.id)}" title="Ver detalhes do pedido" aria-label="Ver detalhes do pedido">
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
      const modal = openModal({
        title: 'Detalhes do Pedido',
        content: renderOrderDetailsContent(order),
        showFooter: false,
        size: 'wide',
      });
      modal.querySelector('[data-copy-order-detail-id]').addEventListener('click', () => copyOrderId(order.id));
    });
  });

  tbody.querySelectorAll('[data-bling-resend]').forEach((button) => {
    button.addEventListener('click', () => resendOrderToBling(button));
  });
}

async function resendOrderToBling(button) {
  const orderId = button.dataset.blingResend;
  const originalText = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>';

  try {
    const updatedOrder = await apiPost(`/orders/admin/${encodeURIComponent(orderId)}/bling/resend`);
    adminOrders = adminOrders.map((order) => (
      order.id === updatedOrder.id ? updatedOrder : order
    ));
    renderAdminOrdersTable(adminOrders);

    if (updatedOrder.bling?.status === 'SENT') {
      showToast('Pedido enviado ao Bling', 'success');
    } else if (updatedOrder.bling?.status === 'FAILED') {
      showToast(`Falha ao enviar ao Bling: ${updatedOrder.bling.error || 'Erro desconhecido'}`, 'error');
    }
  } catch (error) {
    showToast(error.message || 'Não foi possível reenviar o pedido ao Bling', 'error');
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function loadAdminOrders() {
  const tbody = document.querySelector('[data-admin-orders-tbody]');
  try {
    const response = await apiGet('/orders/admin?page=0&size=1000&sort=createdAt,desc');
    adminOrders = response.content;
    renderAdminOrdersTable(adminOrders);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">Não foi possível carregar os pedidos.</div></td></tr>';
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
