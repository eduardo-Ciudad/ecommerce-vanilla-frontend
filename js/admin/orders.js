const ADMIN_ORDER_STATUS_LABELS = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

const ADMIN_ORDER_STATUS_BADGE_CLASS = {
  PENDING: 'badge-pending',
  PAID: 'badge-paid',
  SHIPPED: 'badge-shipped',
  DELIVERED: 'badge-delivered',
  CANCELLED: 'badge-cancelled',
};

function renderAdminOrdersTable(orders) {
  const tbody = document.querySelector('[data-admin-orders-tbody]');

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Nenhum pedido encontrado nesta conta.</div></td></tr>';
    return;
  }

  tbody.innerHTML = orders
    .map(
      (order) => `
        <tr>
          <td>${order.id.slice(0, 8)}...</td>
          <td>${new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
          <td><span class="badge ${ADMIN_ORDER_STATUS_BADGE_CLASS[order.status] || ''}">${ADMIN_ORDER_STATUS_LABELS[order.status] || order.status}</span></td>
          <td>${formatPrice(order.total)}</td>
          <td>${order.items.length}</td>
        </tr>
      `
    )
    .join('');
}

async function loadAdminOrders() {
  const tbody = document.querySelector('[data-admin-orders-tbody]');
  try {
    const orders = await apiGet('/orders');
    renderAdminOrdersTable(orders);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Não foi possível carregar os pedidos.</div></td></tr>';
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
