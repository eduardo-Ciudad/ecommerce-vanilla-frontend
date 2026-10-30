const DASHBOARD_ICONS = {
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h.01M17 15h.01"/><circle cx="12" cy="12" r="2.5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10.3 3.8L2.6 17a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.8a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
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
        <div class="dashboard-card-value">${escapeHtml(value)}</div>
        <div class="dashboard-card-label">${escapeHtml(label)}</div>
        ${note ? `<div class="dashboard-card-note">${escapeHtml(note)}</div>` : ''}
      </div>
    </${tag}>
  `;
}

function renderDashboardAttention(stats) {
  const container = document.querySelector('[data-dashboard-attention]');
  const items = [
    { value: stats.orders.blingFailed, text: 'pedidos com falha no envio ao Bling', tone: 'error', href: 'orders.html' },
    { value: stats.products.variantsOutOfStock, text: 'variantes sem estoque', tone: 'warning', href: 'products.html' },
    { value: stats.products.activeWithoutImage, text: 'produtos ativos sem imagem', tone: 'warning', href: 'products.html' },
    { value: stats.products.variantsWithoutGtin, text: 'variantes sem GTIN (Merchant Center)', tone: 'info', href: 'products.html' },
    { value: stats.products.inactive, text: 'produtos inativos', tone: 'info', href: 'products.html' },
  ].filter((item) => Number(item.value) > 0);

  if (!items.length) {
    container.innerHTML = `<span class="dashboard-attention-empty">${DASHBOARD_ICONS.check} Nenhum ponto de atenção</span>`;
    return;
  }
  container.innerHTML = items.map((item) => `
    <a class="dashboard-attention-item dashboard-attention-item--${item.tone}" href="${item.href}">
      ${DASHBOARD_ICONS.warning}<span>${escapeHtml(item.value)} ${item.text}</span>
    </a>
  `).join('');
}

function formatDashboardDate(date) {
  const [, month, day] = String(date).split('-');
  return `${day}/${month}`;
}

function renderSalesChart(dailySales) {
  const chart = document.querySelector('[data-dashboard-chart]');
  const total = document.querySelector('[data-dashboard-sales-total]');
  const sales = Array.isArray(dailySales) ? dailySales : [];
  const totalRevenue = sales.reduce((sum, day) => sum + Number(day.revenue || 0), 0);
  total.textContent = formatPrice(totalRevenue);
  if (!sales.length || sales.every((day) => Number(day.revenue) === 0)) {
    chart.innerHTML = '<div class="empty-state">Nenhuma venda nos últimos 30 dias</div>';
    return;
  }
  const width = 900;
  const height = 230;
  const chartHeight = 180;
  const maxRevenue = Math.max(...sales.map((day) => Number(day.revenue || 0)));
  const slotWidth = width / sales.length;
  const barWidth = Math.max(4, slotWidth - 8);
  const bars = sales.map((day, index) => {
    const revenue = Number(day.revenue || 0);
    const siteRevenue = Number(day.site?.revenue || 0);
    const localRevenue = Number(day.local?.revenue || 0);
    const siteHeight = siteRevenue > 0 ? Math.max(2, (siteRevenue / maxRevenue) * chartHeight) : 0;
    const localHeight = localRevenue > 0 ? Math.max(2, (localRevenue / maxRevenue) * chartHeight) : 0;
    const x = index * slotWidth + (slotWidth - barWidth) / 2;
    const dateLabel = formatDashboardDate(day.date);
    const title = `${dateLabel} — Site: ${formatPrice(siteRevenue)} — Loja física: ${formatPrice(localRevenue)}`;
    const xLabel = index % 5 === 0 || index === sales.length - 1
      ? `<text class="dashboard-chart-label" x="${x + barWidth / 2}" y="${height - 8}" text-anchor="middle">${escapeHtml(dateLabel)}</text>`
      : '';
    if (!revenue) return `<rect x="${x}" y="${chartHeight - 2}" width="${barWidth}" height="2" rx="2" fill="var(--color-border)"><title>${escapeHtml(title)}</title></rect>${xLabel}`;
    return `<rect x="${x}" y="${chartHeight - siteHeight}" width="${barWidth}" height="${siteHeight}" fill="var(--color-primary-dark)"><title>${escapeHtml(title)}</title></rect><rect x="${x}" y="${chartHeight - siteHeight - localHeight}" width="${barWidth}" height="${localHeight}" rx="2" fill="var(--color-accent-orange)"><title>${escapeHtml(title)}</title></rect>${xLabel}`;
  }).join('');
  chart.innerHTML = `<div class="dashboard-chart-legend"><span><i class="dashboard-chart-legend-site"></i>Site</span><span><i class="dashboard-chart-legend-local"></i>Loja física</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de vendas dos últimos 30 dias" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

function renderChannelSummary(orders) {
  const container = document.querySelector('[data-dashboard-channel]');
  const site = orders.site || {};
  const local = orders.local || {};
  const siteRevenue = Number(site.revenueThisMonth || 0);
  const localRevenue = Number(local.revenueThisMonth || 0);
  const revenueTotal = siteRevenue + localRevenue;
  const sitePercent = revenueTotal ? Math.round((siteRevenue / revenueTotal) * 100) : 0;
  const localPercent = revenueTotal ? 100 - sitePercent : 0;
  container.innerHTML = `<h2 id="dashboard-channel-title">Por canal no mês</h2><div class="dashboard-channel-bar" role="img" aria-label="Site ${escapeAttr(sitePercent)}%, loja física ${escapeAttr(localPercent)}%"><span class="dashboard-channel-bar-site" style="width:${escapeAttr(sitePercent)}%"></span><span class="dashboard-channel-bar-local" style="width:${escapeAttr(localPercent)}%"></span></div><div class="dashboard-channel-grid"><div class="dashboard-channel-block dashboard-channel-site"><h3>Site · ${escapeHtml(sitePercent)}%</h3><div class="dashboard-channel-metrics"><div><span>Receita</span><strong>${formatPrice(siteRevenue)}</strong></div><div><span>Pedidos</span><strong>${escapeHtml(site.paidThisMonth || 0)}</strong></div><div><span>Ticket médio</span><strong>${formatPrice(site.averageTicketThisMonth || 0)}</strong></div></div></div><div class="dashboard-channel-block dashboard-channel-local"><h3>Loja física · ${escapeHtml(localPercent)}%</h3><div class="dashboard-channel-metrics"><div><span>Receita</span><strong>${formatPrice(localRevenue)}</strong></div><div><span>Pedidos</span><strong>${escapeHtml(local.paidThisMonth || 0)}</strong></div><div><span>Ticket médio</span><strong>${formatPrice(local.averageTicketThisMonth || 0)}</strong></div></div></div></div>`;
}

function dashboardBlingCell(order) {
  if (order.bling?.status == null && ['PENDING', 'CANCELLED'].includes(order.status)) return '—';
  return renderBlingStatusBadge(order.bling);
}

function renderRecentOrders(orders) {
  const tbody = document.querySelector('[data-recent-orders-tbody]');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Nenhum pedido encontrado.</div></td></tr>';
    return;
  }

  tbody.innerHTML = orders.map((order) => `
    <tr class="dashboard-recent-order" tabindex="0" data-orders-href="orders.html">
      <td>${escapeHtml(String(order.id).slice(0, 8))}...</td>
      <td>${escapeHtml(new Date(order.createdAt).toLocaleDateString('pt-BR'))}</td>
      <td><span class="badge ${ADMIN_ORDER_STATUS_BADGE_CLASS[order.status] || ''}">${ADMIN_ORDER_STATUS_LABELS[order.status] || escapeHtml(order.status)}</span></td>
      <td>${renderChannelBadge(order.channel)}</td>
      <td>${order.channel === 'LOCAL'
        ? `<div class="admin-payment-cell"><span class="admin-payment-method">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</span><span class="badge badge-paid">Pago</span></div>`
        : order.paymentStatus
        ? `<span class="badge ${PAYMENT_STATUS_BADGE_CLASS[order.paymentStatus] || ''}">${PAYMENT_STATUS_LABELS[order.paymentStatus] || escapeHtml(order.paymentStatus)}</span>`
        : '<span class="badge badge-pending">Não iniciado</span>'}</td>
      <td>${dashboardBlingCell(order)}</td>
      <td>${formatPrice(order.total)}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-orders-href]').forEach((row) => {
    const openOrders = () => { window.location.href = row.dataset.ordersHref; };
    row.addEventListener('click', openOrders);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOrders();
      }
    });
  });
}

function initDashboardAvatar() {
  const avatar = document.querySelector('[data-admin-avatar]');
  const user = getCurrentUser();
  if (!user || !avatar) return;
  const name = user.name || user.email || '';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
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
  const attention = document.querySelector('[data-dashboard-attention]');
  const chart = document.querySelector('[data-dashboard-chart]');
  const recentOrdersTbody = document.querySelector('[data-recent-orders-tbody]');
  try {
    const [stats, ordersResponse] = await Promise.all([
      apiGet('/admin/stats'),
      apiGet('/orders/admin?page=0&size=5&sort=createdAt,desc'),
    ]);
    const paidLabel = `${stats.orders.paidThisMonth} ${stats.orders.paidThisMonth === 1 ? 'pedido pago' : 'pedidos pagos'}`;
    grid.innerHTML = [
      dashboardCard('money', null, formatPrice(stats.orders.revenueThisMonth), 'Faturamento do mês', paidLabel),
      dashboardCard('chart', 'info', formatPrice(stats.orders.averageTicketThisMonth), 'Ticket médio do mês'),
      dashboardCard('clock', 'warning', stats.orders.pending, 'Pedidos pendentes', null, 'orders.html'),
      dashboardCard('box', 'success', stats.products.active, 'Produtos ativos', `${stats.products.variants} variantes`, 'products.html'),
    ].join('');
    renderDashboardAttention(stats);
    renderChannelSummary(stats.orders);
    renderSalesChart(stats.dailySales);
    renderRecentOrders(ordersResponse.content || []);
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os dados do dashboard.</p>';
    attention.innerHTML = '';
    chart.innerHTML = '<div class="empty-state">Não foi possível carregar o gráfico de vendas.</div>';
    document.querySelector('[data-dashboard-channel]').innerHTML = '<div class="empty-state">Não foi possível carregar os dados por canal.</div>';
    recentOrdersTbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Não foi possível carregar os pedidos.</div></td></tr>';
    showToast(error.message || 'Erro ao carregar dashboard', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
