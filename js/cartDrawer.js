let cartDrawerLastTrigger = null;
let cartDrawerItems = [];
let cartDrawerFreeShippingRule = null;
let cartDrawerShouldAnimateItems = false;

function cartDrawerRootPath(path) {
  return `${resolveRootPath()}${path}`;
}

function cartDrawerMarkup() {
  return `
    <div class="cart-drawer" data-cart-drawer hidden>
      <button class="cart-drawer-overlay" type="button" data-cart-drawer-overlay aria-label="Fechar sacola"></button>
      <aside class="cart-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" tabindex="-1">
        <header class="cart-drawer-header">
          <h2 id="cart-drawer-title">Sua sacola</h2>
          <button class="cart-drawer-close" type="button" data-cart-drawer-close aria-label="Fechar sacola">
            <span class="ms" aria-hidden="true">close</span>
          </button>
        </header>
        <div class="cart-drawer-content" data-cart-drawer-content></div>
        <footer class="cart-drawer-footer" data-cart-drawer-footer hidden>
          <div class="cart-drawer-shipping" data-cart-drawer-shipping hidden>
            <p data-cart-drawer-shipping-message></p>
            <div class="cart-drawer-shipping-track" role="progressbar" aria-label="Progresso para frete grátis" aria-valuemin="0" aria-valuemax="100">
              <span data-cart-drawer-shipping-bar></span>
            </div>
          </div>
          <div class="cart-drawer-subtotal"><span>Subtotal</span><strong data-cart-drawer-subtotal></strong></div>
          <a class="btn btn-primary btn-block" href="${cartDrawerRootPath('cart.html')}">Finalizar compra</a>
          <button class="btn btn-secondary btn-block" type="button" data-cart-drawer-continue>Continuar comprando</button>
        </footer>
      </aside>
    </div>
  `;
}

function cartDrawerItemMarkup(item, index) {
  const details = [
    item.color ? `Cor: ${item.color}` : '',
    item.size ? `Tam. ${item.size}` : '',
  ].filter(Boolean).join(' · ');
  const image = item.imageUrl
    ? `<img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.productName)}">`
    : productImagePlaceholder();
  return `
    <li class="cart-drawer-item" data-drawer-item="${escapeAttr(item.itemId)}" style="--item-index:${index}">
      <div class="cart-drawer-item-image">${image}</div>
      <div class="cart-drawer-item-info">
        <strong>${escapeHtml(item.productName)}</strong>
        ${details ? `<span>${escapeHtml(details)}</span>` : ''}
        <div class="cart-drawer-item-bottom">
          <div class="cart-drawer-quantity" aria-label="Quantidade de ${escapeAttr(item.productName)}">
            <button type="button" data-drawer-decrease aria-label="Diminuir quantidade"><span class="ms" aria-hidden="true">remove</span></button>
            <span data-drawer-quantity>${item.quantity}</span>
            <button type="button" data-drawer-increase aria-label="Aumentar quantidade"><span class="ms" aria-hidden="true">add</span></button>
          </div>
          <strong class="cart-drawer-item-price">${formatPrice(item.price * item.quantity)}</strong>
        </div>
      </div>
      <button class="cart-drawer-remove" type="button" data-drawer-remove aria-label="Remover ${escapeAttr(item.productName)}">
        <span class="ms" aria-hidden="true">delete</span>
      </button>
    </li>
  `;
}

function updateCartDrawerShipping(subtotal) {
  const container = document.querySelector('[data-cart-drawer-shipping]');
  const progress = getFreeShippingProgress(subtotal, cartDrawerFreeShippingRule?.threshold);
  if (!container || !progress.available) {
    if (container) container.hidden = true;
    return;
  }
  container.hidden = false;
  container.querySelector('[data-cart-drawer-shipping-message]').textContent = progress.remaining > 0
    ? `Faltam ${formatPrice(progress.remaining)} para o frete grátis`
    : 'Você ganhou frete grátis!';
  container.querySelector('[data-cart-drawer-shipping-bar]').style.width = `${progress.percentage}%`;
  container.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(Math.round(progress.percentage)));
}

function finishCartDrawerItemEntrance(list) {
  const items = [...list.querySelectorAll('.cart-drawer-item')];
  const lastItem = items[items.length - 1];
  if (!lastItem) {
    list.classList.remove('is-entering');
    return;
  }
  lastItem.addEventListener('animationend', () => {
    list.classList.remove('is-entering');
  }, { once: true });
}

function renderCartDrawerItems(items) {
  cartDrawerItems = items;
  const content = document.querySelector('[data-cart-drawer-content]');
  const footer = document.querySelector('[data-cart-drawer-footer]');
  if (!content || !footer) return;

  if (!items.length) {
    content.innerHTML = `
      <div class="cart-drawer-empty">
        <span class="ms" aria-hidden="true">shopping_bag</span>
        <p>Sua sacola está vazia.</p>
        <a class="btn btn-primary" href="${cartDrawerRootPath('shop.html')}">Ver a loja</a>
      </div>`;
    footer.hidden = true;
    return;
  }

  const shouldAnimate = cartDrawerShouldAnimateItems;
  cartDrawerShouldAnimateItems = false;
  content.innerHTML = `<ul class="cart-drawer-items${shouldAnimate ? ' is-entering' : ''}">${items.map(cartDrawerItemMarkup).join('')}</ul>`;
  if (shouldAnimate) finishCartDrawerItemEntrance(content.querySelector('.cart-drawer-items'));
  footer.hidden = false;
  const subtotal = cartService.getSubtotal(items);
  footer.querySelector('[data-cart-drawer-subtotal]').textContent = formatPrice(subtotal);
  updateCartDrawerShipping(subtotal);
  wireCartDrawerItemEvents();
}

async function refreshCartDrawer() {
  const content = document.querySelector('[data-cart-drawer-content]');
  content.innerHTML = '<div class="cart-drawer-loading"><span class="spinner"></span><span>Carregando sua sacola...</span></div>';
  try {
    const items = await cartService.getItems();
    cartService.syncCartBadge(items);
    renderCartDrawerItems(items);
  } catch (error) {
    content.innerHTML = '<p class="empty-state empty-state--inline">Não foi possível carregar sua sacola.</p>';
    showToast(error.message || 'Não foi possível carregar o carrinho', 'error');
  }
}

function focusableDrawerElements() {
  return [...document.querySelectorAll('[data-cart-drawer] a[href], [data-cart-drawer] button:not(:disabled), [data-cart-drawer] [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.closest('[hidden]'));
}

function handleCartDrawerKeydown(event) {
  if (event.key === 'Escape') {
    closeCartDrawer();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = focusableDrawerElements();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function openCartDrawer(trigger = document.activeElement) {
  const drawer = document.querySelector('[data-cart-drawer]');
  if (!drawer) return;
  cartDrawerLastTrigger = trigger instanceof HTMLElement ? trigger : null;
  drawer.hidden = false;
  document.body.classList.add('cart-drawer-open');
  requestAnimationFrame(() => drawer.classList.add('is-open'));
  document.addEventListener('keydown', handleCartDrawerKeydown);
  drawer.querySelector('[data-cart-drawer-close]').focus();
  cartDrawerShouldAnimateItems = true;
  await refreshCartDrawer();
}

function cartDrawerSpringDurationMs() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--spring-dur').trim();
  const duration = Number.parseFloat(value);
  if (!Number.isFinite(duration)) return 460;
  return value.endsWith('s') && !value.endsWith('ms') ? duration * 1000 : duration;
}

function closeCartDrawer() {
  const drawer = document.querySelector('[data-cart-drawer]');
  if (!drawer || drawer.hidden) return;
  drawer.classList.remove('is-open');
  document.body.classList.remove('cart-drawer-open');
  document.removeEventListener('keydown', handleCartDrawerKeydown);
  let didFinish = false;
  let safetyTimeout;
  const finish = () => {
    if (didFinish) return;
    didFinish = true;
    clearTimeout(safetyTimeout);
    drawer.hidden = true;
    cartDrawerLastTrigger?.focus?.();
  };
  safetyTimeout = setTimeout(finish, cartDrawerSpringDurationMs() + 50);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
  else {
    const panel = drawer.querySelector('.cart-drawer-panel');
    const handlePanelTransitionEnd = (event) => {
      if (event.target !== panel || event.propertyName !== 'transform') return;
      panel.removeEventListener('transitionend', handlePanelTransitionEnd);
      finish();
    };
    panel.addEventListener('transitionend', handlePanelTransitionEnd);
  }
}

function findDrawerItem(itemId) {
  return cartDrawerItems.find((item) => String(item.itemId) === String(itemId));
}

function wireCartDrawerItemEvents() {
  document.querySelectorAll('[data-drawer-item]').forEach((row) => {
    const item = findDrawerItem(row.dataset.drawerItem);
    if (!item) return;
    const buttons = row.querySelectorAll('button');
    const changeQuantity = async (quantity) => {
      if (quantity < 1) return;
      buttons.forEach((button) => { button.disabled = true; });
      try {
        const items = await cartService.updateQuantity(item, quantity);
        cartService.syncCartBadge(items);
        renderCartDrawerItems(items);
      } catch (error) {
        showToast(error.message || 'Não foi possível atualizar a quantidade', 'error');
        buttons.forEach((button) => { button.disabled = false; });
      }
    };
    row.querySelector('[data-drawer-decrease]').addEventListener('click', () => changeQuantity(item.quantity - 1));
    row.querySelector('[data-drawer-increase]').addEventListener('click', () => changeQuantity(item.quantity + 1));
    row.querySelector('[data-drawer-remove]').addEventListener('click', async () => {
      buttons.forEach((button) => { button.disabled = true; });
      row.classList.add('is-removing');
      try {
        const removePromise = cartService.removeItem(item);
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          await new Promise((resolve) => setTimeout(resolve, 220));
        }
        const items = await removePromise;
        cartService.syncCartBadge(items);
        renderCartDrawerItems(items);
      } catch (error) {
        row.classList.remove('is-removing');
        buttons.forEach((button) => { button.disabled = false; });
        showToast(error.message || 'Não foi possível remover o item', 'error');
      }
    });
  });
}

function popCartHeaderBadge() {
  const badge = document.querySelector('[data-cart-badge]');
  const icon = document.querySelector('[data-cart-trigger] .ms');
  badge?.classList.remove('is-popping');
  void badge?.offsetWidth;
  badge?.classList.add('is-popping');
  fillCartIconTemporarily(icon);
}

function fillCartIconTemporarily(icon = document.querySelector('[data-cart-trigger] .ms')) {
  icon?.classList.add('is-filled');
  setTimeout(() => icon?.classList.remove('is-filled'), 1600);
}

function flyToCart(source, imageUrl) {
  const target = document.querySelector('[data-cart-trigger]');
  if (!source || !imageUrl || !target || target.getClientRects().length === 0) return false;
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const startX = from.left + from.width / 2 - 18;
  const startY = from.top + from.height / 2 - 18;
  const deltaX = to.left + to.width / 2 - 18 - startX;
  const deltaY = to.top + to.height / 2 - 18 - startY;
  const outer = document.createElement('span');
  const inner = document.createElement('span');
  outer.className = 'cart-fly-x';
  inner.className = 'cart-fly-y';
  inner.innerHTML = `<img src="${escapeAttr(imageUrl)}" alt="">`;
  outer.style.left = `${startX}px`;
  outer.style.top = `${startY}px`;
  outer.append(inner);
  document.body.append(outer);
  outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${deltaX}px)` }], { duration: 560, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
  const animation = inner.animate([
    { transform: 'translateY(0) scale(.6)', opacity: 1, offset: 0 },
    { transform: `translateY(${deltaY * .15}px) scale(1.1)`, opacity: 1, offset: .15 },
    { transform: `translateY(${deltaY}px) scale(.4)`, opacity: 0, offset: 1 },
  ], { duration: 560, easing: 'cubic-bezier(0,.55,.45,1)', fill: 'forwards' });
  animation.onfinish = () => outer.remove();
  return true;
}

function runAddToCartFeedback(source, imageUrl) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const didFly = !reducedMotion && flyToCart(source, imageUrl);
  const arrivalDelay = didFly ? 560 : 0;
  setTimeout(() => {
    if (!reducedMotion) popCartHeaderBadge();
    else fillCartIconTemporarily();
    setTimeout(() => openCartDrawer(source), 80);
  }, arrivalDelay);
}

function initCartDrawer() {
  document.body.insertAdjacentHTML('beforeend', cartDrawerMarkup());
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-cart-trigger]');
    const drawer = document.querySelector('[data-cart-drawer]');
    if (!trigger || !drawer || event.button !== 0
      || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openCartDrawer(trigger);
  });
  document.querySelector('[data-cart-drawer-close]').addEventListener('click', closeCartDrawer);
  document.querySelector('[data-cart-drawer-overlay]').addEventListener('click', closeCartDrawer);
  document.querySelector('[data-cart-drawer-continue]').addEventListener('click', closeCartDrawer);
  getFreeShippingRule().then((rule) => {
    cartDrawerFreeShippingRule = rule;
    if (rule && cartDrawerItems.length) {
      updateCartDrawerShipping(cartService.getSubtotal(cartDrawerItems));
    }
  });
}

document.addEventListener('DOMContentLoaded', initCartDrawer);
