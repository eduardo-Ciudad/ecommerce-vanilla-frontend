const CATEGORY_ICONS = {
  shirt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.47a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.47a2 2 0 00-1.34-2.23z"/></svg>',
  footprints: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 11-4 0z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 104 0z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>',
  baby: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M15 12h.01"/><path d="M19.38 6.81A9 9 0 0120.8 10.2a2 2 0 010 3.6 9 9 0 01-17.6 0 2 2 0 010-3.6A9 9 0 0112 3c2 0 3.5 1.1 3.5 2.5S14.6 8 13.5 8c-.8 0-1.5-.4-1.5-1"/><path d="M9 12h.01"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12.59 2.59A2 2 0 0011.17 2H4a2 2 0 00-2 2v7.17a2 2 0 00.59 1.42l8.7 8.7a2.43 2.43 0 003.42 0l6.58-6.58a2.43 2.43 0 000-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
};

function categoryIcon(name) {
  const lower = (name || '').toLowerCase();

  if (/tênis|tenis|calçado|calcado|sapato|sandália|sandalia/.test(lower)) return CATEGORY_ICONS.footprints;
  if (/bebê|bebe|infantil|baby/.test(lower)) return CATEGORY_ICONS.baby;
  if (/cal[cç]a/.test(lower)) return CATEGORY_ICONS.tag;
  if (/camiseta|blusa|blusinha|vestido|jaqueta|casaco|moletom|camisa|regata/.test(lower)) return CATEGORY_ICONS.shirt;

  return CATEGORY_ICONS.tag;
}

async function renderHomeCategories() {
  const grid = document.querySelector('[data-category-grid]');
  try {
    const categories = await apiGet('/categories');
    if (!categories.length) {
      grid.innerHTML = '<p class="empty-state">Nenhuma categoria cadastrada ainda.</p>';
      return;
    }
    grid.innerHTML = categories
      .map((category, index) => `
        <a class="category-card cat-color-${index % 4} fade-in" href="shop.html?category=${category.id}">
          <span class="category-card-icon">${categoryIcon(category.name)}</span>
          <span class="category-card-name">${escapeHtml(category.name)}</span>
        </a>
      `)
      .join('');
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar as categorias.</p>';
  }
}

async function renderBestSellers() {
  const grid = document.querySelector('[data-product-grid]');
  try {
    const products = await apiGet('/products');
    if (!products.length) {
      grid.innerHTML = '<p class="empty-state">Nenhum produto disponível no momento.</p>';
      return;
    }
    grid.innerHTML = products.slice(0, 8).map((product) => buildProductCard(product)).join('');
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos.</p>';
  }
}

function initNewsletterForm() {
  const form = document.querySelector('[data-newsletter-form]');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('Inscrição realizada com sucesso!', 'success');
    form.reset();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderHomeCategories();
  renderBestSellers();
  initNewsletterForm();
});
