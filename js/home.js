const HOME_PRODUCT_PREVIEW_COUNT = 8;
const HOME_EDITORIAL_PRODUCT_IDS = [
  'cced2d1c-3e1f-4cb0-8f9b-b4dae8beb596',
  '5c142349-6663-407d-b10d-43bcb2dc68db',
  '1fb65825-b47f-446e-b434-b1bb32687849',
];

function normalizeText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

let categoriesPromise = null;

function loadCategories() {
  if (!categoriesPromise) {
    categoriesPromise = apiGet('/categories').catch((error) => {
      categoriesPromise = null;
      throw error;
    });
  }
  return categoriesPromise;
}

async function renderVaralLinks() {
  const links = document.querySelectorAll('[data-varal-link]');
  if (!links.length) return;
  try {
    const categories = await loadCategories();
    links.forEach((link) => {
      const target = normalizeText(link.dataset.varalLink);
      const segment = categories.find(
        (category) => !category.parentId && normalizeText(category.name) === target,
      );
      if (segment) {
        link.href = `shop.html?category=${segment.id}`;
      }
    });
  } catch (error) {
    // Mantém o href padrão (shop.html) definido no HTML
  }
}

function renderEditorial(products) {
  const root = document.querySelector('[data-editorial]');
  if (!root) return;

  const list = products
    .map((product) => {
      const price = lowestVariantPrice(product);
      const priceLabel = price === null ? 'Indisponível' : formatPrice(price);
      const media = product.imageUrl
        ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
        : productImagePlaceholder();
      return `
        <a class="editorial-item" href="product.html?id=${product.id}">
          <span class="editorial-item-media">${media}</span>
          <span class="editorial-item-info">
            <span class="editorial-item-category">${escapeHtml(product.categoryName || '')}</span>
            <span class="editorial-item-name">${escapeHtml(product.name)}</span>
            <span class="editorial-item-price">${priceLabel}</span>
          </span>
        </a>
      `;
    })
    .join('');

  root.innerHTML = `
    <div class="editorial-feature">
      <div class="editorial-copy">
        <div class="editorial-eyebrow">Edição da estação</div>
        <h2 class="editorial-title">Looks de Verão</h2>
        <p class="editorial-text">Modelos leves e confortáveis para aproveitar os dias mais quentes.</p>
      </div>
      <a class="editorial-feature-media" href="shop.html" aria-label="Confira todos os produtos">
        <img src="img/card-verao.jpg" alt="Look infantil de verão" loading="lazy" />
        <span class="editorial-feature-cta">confira <span aria-hidden="true">→</span></span>
      </a>
    </div>
    <div class="editorial-list">${list}</div>
  `;
}

async function renderSummerEditorial() {
  const requests = HOME_EDITORIAL_PRODUCT_IDS.map((id) => apiGet(`/products/${id}`));
  const results = await Promise.allSettled(requests);
  const products = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  renderEditorial(products);
}

async function renderBestSellers() {
  const grid = document.querySelector('[data-product-grid]');
  try {
    const response = await apiGet(`/products?page=0&size=${HOME_PRODUCT_PREVIEW_COUNT}`);
    const products = response.content;
    if (!products.length) {
      grid.innerHTML = '<p class="empty-state">Nenhum produto disponível no momento.</p>';
      return;
    }
    grid.innerHTML = products.map((product) => buildProductCard(product)).join('');
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
  renderVaralLinks();
  renderBestSellers();
  renderSummerEditorial();
  initNewsletterForm();
});
