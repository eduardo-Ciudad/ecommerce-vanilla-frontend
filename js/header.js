const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2 3h2l2.4 12.2a2 2 0 002 1.8h8.6a2 2 0 002-1.7L21 8H6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
};

function headerLink(path) {
  return `${resolveRootPath()}${path}`;
}

function buildHeaderMarkup() {
  const user = getCurrentUser();
  const cartCount = getCartCount();

  const userMenu = user
    ? `
      <div class="user-menu" data-user-menu>
        <button class="user-menu-trigger" data-user-trigger>
          ${ICONS.user}
          <span class="user-menu-name">${escapeHtml(user.name || user.email)}</span>
        </button>
        <div class="user-menu-dropdown">
          <a href="${headerLink('orders.html')}">Meus Pedidos</a>
          <button data-action="logout">Sair</button>
        </div>
      </div>
    `
    : `<a class="header-icon-btn" href="${headerLink('auth.html')}" aria-label="Entrar">${ICONS.user}</a>`;

  const adminLink = user && user.role === 'ADMIN'
    ? `<a class="header-icon-btn" href="${headerLink('admin/index.html')}" aria-label="Painel admin">${ICONS.gear}</a>`
    : '';

  return `
    <div class="topbar">Frete grátis para compras acima de R$ 199</div>
    <header class="site-header" data-site-header>
      <div class="header-main">
        <a class="header-logo" href="${headerLink('index.html')}"><span>Mini</span>Moda</a>
        <form class="header-search" data-search-form>
          ${ICONS.search}
          <input type="search" name="q" placeholder="Buscar produtos..." aria-label="Buscar produtos" />
        </form>
        <div class="header-actions">
          ${adminLink}
          ${userMenu}
          <a class="header-icon-btn" href="${headerLink('cart.html')}" aria-label="Carrinho">
            ${ICONS.cart}
            <span class="cart-badge" data-cart-badge${cartCount ? '' : ' hidden'}>${cartCount}</span>
          </a>
        </div>
      </div>
      <div class="header-mobile-search">
        <form data-search-form-mobile>
          ${ICONS.search}
          <input type="search" name="q" placeholder="Buscar produtos..." aria-label="Buscar produtos" class="form-control" style="padding-left:2.5rem" />
        </form>
      </div>
      <nav class="header-category-nav">
        <div class="header-category-list" data-category-list></div>
      </nav>
    </header>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function loadHeaderCategories() {
  const list = document.querySelector('[data-category-list]');
  if (!list) return;
  try {
    const categories = await apiGet('/categories');
    list.innerHTML = categories
      .map((c) => `<a href="${headerLink('shop.html')}?category=${c.id}">${escapeHtml(c.name)}</a>`)
      .join('');
  } catch {
    list.innerHTML = '';
  }
}

function wireHeaderSearch(form) {
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const term = new FormData(form).get('q')?.toString().trim();
    const url = new URL(headerLink('shop.html'), window.location.href);
    if (term) url.searchParams.set('q', term);
    window.location.href = url.pathname + url.search;
  });
}

function initHeader() {
  const root = document.getElementById('header-root');
  if (!root) return;

  root.innerHTML = buildHeaderMarkup();
  loadHeaderCategories();

  wireHeaderSearch(document.querySelector('[data-search-form]'));
  wireHeaderSearch(document.querySelector('[data-search-form-mobile]'));

  const userMenu = document.querySelector('[data-user-menu]');
  if (userMenu) {
    const trigger = userMenu.querySelector('[data-user-trigger]');
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      userMenu.classList.toggle('is-open');
    });
    document.addEventListener('click', () => userMenu.classList.remove('is-open'));
    userMenu.querySelector('[data-action="logout"]').addEventListener('click', logout);
  }

  const siteHeader = document.querySelector('[data-site-header]');
  window.addEventListener('scroll', () => {
    siteHeader.classList.toggle('is-stuck', window.scrollY > 4);
  });

  document.addEventListener('cart-count-changed', (event) => {
    const badge = document.querySelector('[data-cart-badge]');
    if (!badge) return;
    badge.textContent = event.detail;
    badge.hidden = !event.detail;
  });
}

document.addEventListener('DOMContentLoaded', initHeader);
