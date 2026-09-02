const DASHBOARD_ICONS = {
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.6 12.3L12.7 20a2 2 0 01-2.8 0l-7-7a2 2 0 010-2.8L10.8 2.5 20.6 3l.5 9.3z"/><circle cx="15.5" cy="7.5" r="1.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
};

function dashboardCard(icon, colorModifier, value, label, note, href) {
  const tag = href ? 'a' : 'div';
  const hrefAttr = href ? ` href="${href}"` : '';
  const clickableClass = href ? ' dashboard-card--clickable' : '';
  const iconClass = colorModifier ? ` dashboard-card-icon--${colorModifier}` : '';

  return `
    <${tag} class="dashboard-card${clickableClass} fade-in"${hrefAttr}>
      <span class="dashboard-card-icon${iconClass}">${DASHBOARD_ICONS[icon]}</span>
      <div>
        <div class="dashboard-card-value">${value}</div>
        <div class="dashboard-card-label">${label}</div>
        ${note ? `<div class="dashboard-card-note">${note}</div>` : ''}
      </div>
    </${tag}>
  `;
}

function renderRecentOrders(orders) {
  const tbody = document.querySelector('[data-recent-orders-tbody]');
  const recent = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Nenhum pedido encontrado nesta conta.</div></td></tr>';
    return;
  }

  tbody.innerHTML = recent
    .map(
      (order) => `
        <tr>
          <td>${order.id.slice(0, 8)}...</td>
          <td>${new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
          <td><span class="badge ${ADMIN_ORDER_STATUS_BADGE_CLASS[order.status] || ''}">${ADMIN_ORDER_STATUS_LABELS[order.status] || order.status}</span></td>
          <td>
            ${order.paymentStatus
              ? `<span class="badge ${PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] || ''}">${PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</span>`
              : '<span class="badge badge-pending">Não iniciado</span>'}
          </td>
          <td>${formatPrice(order.total)}</td>
        </tr>
      `
    )
    .join('');
}

function initDashboardAvatar() {
  const avatar = document.querySelector('[data-admin-avatar]');
  const user = getCurrentUser();
  if (!user || !avatar) return;
  const name = user.name || user.email || '';
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  avatar.textContent = initials || 'AD';
}

function initDashboardSearch() {
  const form = document.querySelector('[data-admin-search-form]');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('Busca no painel em breve', 'info');
  });
}

async function initDashboard() {
  if (!requireAdmin()) return;

  initDashboardAvatar();
  initDashboardSearch();

  const grid = document.querySelector('[data-dashboard-grid]');
  const recentOrdersTbody = document.querySelector('[data-recent-orders-tbody]');

  try {
    const [categories, productsResponse, ordersResponse] = await Promise.all([
      apiGet('/categories'),
      apiGet('/products?page=0&size=1&includeWithoutImage=true'),
      apiGet('/orders?page=0&size=1000'),
    ]);

    const orders = ordersResponse.content;
    const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
    const finishedCount = orders.filter((o) => o.status === 'DELIVERED').length;

    grid.innerHTML = [
      dashboardCard('box', null, productsResponse.totalElements, 'Total de Produtos', null, 'products.html'),
      dashboardCard('tag', 'info', categories.length, 'Total de Categorias', null, 'categories.html'),
      dashboardCard('clock', 'warning', pendingCount, 'Pedidos Pendentes', 'Só da conta admin'),
      dashboardCard('check', 'success', finishedCount, 'Pedidos Entregues', 'Só da conta admin'),
    ].join('');

    renderRecentOrders(orders);
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os dados do dashboard.</p>';
    recentOrdersTbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Não foi possível carregar os pedidos.</div></td></tr>';
    showToast(error.message || 'Erro ao carregar dashboard', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
