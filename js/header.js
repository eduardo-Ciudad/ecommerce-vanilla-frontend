const HEADER_CATEGORY_PREVIEW_COUNT = 6;

const ICONS = {
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 01-8 0"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  shoppingCart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 002 1.58h9.78a2 2 0 001.95-1.57l1.65-7.43H5.12"/></svg>',
  package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 21.73a2 2 0 002 0l7-4A2 2 0 0021 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="M7.5 4.27l9 5.15"/></svg>',
  frown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  creditCard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  smartphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
};

function headerLink(path) {
  return `${resolveRootPath()}${path}`;
}

function initFooterTrustStrip() {
  const footer = document.querySelector('.site-footer');
  if (!footer || footer.querySelector('.footer-trust-strip')) return;

  const trustStrip = document.createElement('section');
  trustStrip.className = 'footer-trust-strip';
  trustStrip.setAttribute('aria-label', 'Segurança da loja');
  trustStrip.innerHTML = `
    <div class="footer-trust-strip-inner">
      <div class="footer-trust-badge">
        <span class="footer-trust-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 018 0v3" />
            <path d="M12 14v3" />
          </svg>
        </span>
        <span class="footer-trust-copy">
          <strong>Site seguro</strong>
          <small>Protegido por certificado SSL</small>
        </span>
      </div>
      <div class="footer-trust-badge">
        <span class="footer-trust-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21.5s7.5-3.7 7.5-10.2V5.2L12 2.5 4.5 5.2v6.1C4.5 17.8 12 21.5 12 21.5z" />
            <path d="M9 11.7l2.2 2.2 4-4.2" />
          </svg>
        </span>
        <span class="footer-trust-copy">
          <strong>Pagamento seguro</strong>
          <small>Processado via Mercado Pago</small>
        </span>
      </div>
    </div>
  `;

  footer.prepend(trustStrip);
}

function buildHeaderMarkup() {
  const user = getCurrentUser();
  const cartCount = getCartCount();
  const showVerificationWarning = user && !user.emailVerified;

  const userMenu = user
    ? `
      <div class="user-menu" data-user-menu>
        <button class="user-menu-trigger" data-user-trigger aria-label="Minha conta">
          ${ICONS.user}
          <span class="user-menu-name">${escapeHtml(user.name || user.email)}</span>
        </button>
        <div class="user-menu-dropdown">
          <a href="${headerLink('orders.html')}">Meus Pedidos</a>
          <a href="${headerLink('enderecos.html')}">Meus Endereços</a>
          <button data-action="logout">Sair</button>
        </div>
      </div>
    `
    : `
      <a class="header-link-entrar" href="${headerLink('auth.html')}">Entrar</a>
      <a class="header-btn-cadastrar" href="${headerLink('auth.html')}?tab=register">Cadastrar</a>
      <a
        class="header-icon-btn header-mobile-only"
        href="${headerLink('auth.html')}"
        aria-label="Minha conta"
        hidden
      >
        ${ICONS.user}
      </a>
    `;

  const adminLink = user && user.role === 'ADMIN'
    ? `<a class="header-icon-btn" href="${headerLink('admin/index.html')}" aria-label="Painel admin">${ICONS.gear}</a>`
    : '';

  return `
    <div class="topbar"><span>Frete Grátis em compras acima de R$ 199 · Troca fácil em 30 dias</span></div>
    ${showVerificationWarning ? `<div class="topbar topbar--warning">Seu email ainda não foi verificado. <a href="${headerLink('auth.html')}">Reenviar verificação</a></div>` : ''}
    <header class="site-header" data-site-header>
      <div class="header-main">
        <a class="header-logo" href="${headerLink('index.html')}">
          <img class="header-logo-icon" src="${headerLink('assets/logo-tree.png')}" alt="" />
          <span class="header-logo-text">Gabi<span class="header-logo-accent">Kids</span></span>
        </a>
        <button
          class="header-menu-trigger"
          type="button"
          data-mobile-menu-trigger
          aria-label="Abrir menu de navegação"
          aria-controls="header-mobile-menu"
          aria-expanded="false"
        >
          ${ICONS.menu}
        </button>
        <nav class="navbar-links">
          <a href="${headerLink('shop.html')}">Loja</a>
          <div class="categories-dropdown" data-categories-dropdown>
            <button class="categories-dropdown-trigger" type="button" data-categories-trigger>
              Categorias
              ${ICONS.chevronDown}
            </button>
            <div class="categories-dropdown-menu" data-category-list></div>
          </div>
        </nav>
        <form class="header-search" data-search-form>
          ${ICONS.search}
          <input class="form-control" type="search" name="q" placeholder="Buscar produtos..." aria-label="Buscar produtos" />
        </form>
        <div class="header-actions">
          <button
            class="header-icon-btn header-mobile-only"
            type="button"
            data-mobile-search-trigger
            aria-label="Abrir busca"
            aria-expanded="false"
            hidden
          >
            ${ICONS.search}
          </button>
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
          <input type="search" name="q" placeholder="Buscar produtos..." aria-label="Buscar produtos" class="form-control" />
        </form>
      </div>
      <nav
        class="header-mobile-menu"
        id="header-mobile-menu"
        data-mobile-menu
        aria-label="Navegação principal"
      >
        <a class="header-mobile-menu-link" href="${headerLink('shop.html')}">Loja</a>
        <div class="header-mobile-categories">
          <span class="header-mobile-menu-title">Categorias</span>
          <div class="header-mobile-category-list" data-category-list></div>
        </div>
      </nav>
    </header>
  `;
}

async function loadHeaderCategories() {
  const lists = document.querySelectorAll('[data-category-list]');
  if (!lists.length) return;
  try {
    const categories = await apiGet('/categories');
    const items = categories
      .slice(0, HEADER_CATEGORY_PREVIEW_COUNT)
      .map((c) => `<a href="${headerLink('shop.html')}?category=${c.id}">${escapeHtml(c.name)}</a>`)
      .join('');
    const seeAllItem = categories.length > HEADER_CATEGORY_PREVIEW_COUNT
      ? `<a class="categories-dropdown-see-all" href="${headerLink('shop.html')}">Ver todas as categorias</a>`
      : '';
    lists.forEach((list) => {
      list.innerHTML = items + seeAllItem;
    });
  } catch (error) {
    logAppError('header.categories.load', error);
    lists.forEach((list) => {
      list.innerHTML = '';
    });
  }
}

function wireCategoriesDropdown() {
  const dropdown = document.querySelector('[data-categories-dropdown]');
  if (!dropdown) return;
  const trigger = dropdown.querySelector('[data-categories-trigger]');
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdown.classList.toggle('is-open');
  });
  document.addEventListener('click', () => dropdown.classList.remove('is-open'));
}

function wireMobileMenu() {
  const menu = document.querySelector('[data-mobile-menu]');
  const trigger = document.querySelector('[data-mobile-menu-trigger]');
  if (!menu || !trigger) return;

  const closeMenu = ({ returnFocus = false } = {}) => {
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Abrir menu de navegação');
    if (returnFocus) trigger.focus();
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = menu.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
    trigger.setAttribute(
      'aria-label',
      isOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'
    );
  });

  menu.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('click', () => closeMenu());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      closeMenu({ returnFocus: true });
    }
  });
}

function wireMobileSearch() {
  const siteHeader = document.querySelector('[data-site-header]');
  const trigger = document.querySelector('[data-mobile-search-trigger]');
  const search = document.querySelector('.header-mobile-search');
  const input = search?.querySelector('input');
  if (!siteHeader || !trigger || !search || !input) return;

  const closeSearch = ({ returnFocus = false } = {}) => {
    siteHeader.classList.remove('is-search-open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', 'Abrir busca');
    if (returnFocus) trigger.focus();
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = siteHeader.classList.toggle('is-search-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
    trigger.setAttribute('aria-label', isOpen ? 'Fechar busca' : 'Abrir busca');
    if (isOpen) input.focus();
  });

  search.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => closeSearch());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && siteHeader.classList.contains('is-search-open')) {
      closeSearch({ returnFocus: true });
    }
  });
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

  const syncHeaderOffset = () => {
    document.body.style.setProperty('--site-header-height', `${root.offsetHeight}px`);
  };

  syncHeaderOffset();
  if ('ResizeObserver' in window) {
    const headerResizeObserver = new ResizeObserver(syncHeaderOffset);
    headerResizeObserver.observe(root);
  } else {
    window.addEventListener('resize', syncHeaderOffset);
  }

  loadHeaderCategories();
  wireCategoriesDropdown();
  wireMobileMenu();
  wireMobileSearch();

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

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initFooterTrustStrip();
});
