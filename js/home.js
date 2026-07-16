const CATEGORY_EMOJIS = ['👕', '👗', '🧢', '🩳', '🧦', '🧥', '👶', '🎀'];

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
          <span class="category-card-icon">${CATEGORY_EMOJIS[index % CATEGORY_EMOJIS.length]}</span>
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
