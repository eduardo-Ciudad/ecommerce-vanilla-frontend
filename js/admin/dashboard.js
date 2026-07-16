const DASHBOARD_ICONS = {
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.6 12.3L12.7 20a2 2 0 01-2.8 0l-7-7a2 2 0 010-2.8L10.8 2.5 20.6 3l.5 9.3z"/><circle cx="15.5" cy="7.5" r="1.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
};

function dashboardCard(icon, value, label, note) {
  return `
    <div class="dashboard-card fade-in">
      <span class="dashboard-card-icon">${DASHBOARD_ICONS[icon]}</span>
      <div>
        <div class="dashboard-card-value">${value}</div>
        <div class="dashboard-card-label">${label}</div>
        ${note ? `<div class="dashboard-card-note">${note}</div>` : ''}
      </div>
    </div>
  `;
}

async function initDashboard() {
  if (!requireAdmin()) return;

  const grid = document.querySelector('[data-dashboard-grid]');

  try {
    const [categories, products, orders] = await Promise.all([
      apiGet('/categories'),
      apiGet('/products'),
      apiGet('/orders'),
    ]);

    const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
    const finishedCount = orders.filter((o) => o.status === 'DELIVERED').length;

    grid.innerHTML = [
      dashboardCard('box', products.length, 'Total de Produtos'),
      dashboardCard('tag', categories.length, 'Total de Categorias'),
      dashboardCard('clock', pendingCount, 'Pedidos Pendentes', 'Apenas pedidos da conta admin — a API não expõe listagem global'),
      dashboardCard('check', finishedCount, 'Pedidos Entregues', 'Apenas pedidos da conta admin — a API não expõe listagem global'),
    ].join('');
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os dados do dashboard.</p>';
    showToast(error.message || 'Erro ao carregar dashboard', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
