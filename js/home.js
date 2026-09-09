const HOME_CATEGORY_PREVIEW_COUNT = 6;
const HOME_PRODUCT_PREVIEW_COUNT = 8;
const HOME_EDITORIAL_COUNT = 4;

const CATEGORY_FALLBACK_COLORS = ['#D8F2F5', '#FFF3C9', '#E8F4C8'];

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

async function renderHomeCategories() {
  const grid = document.querySelector('[data-category-grid]');
  try {
    const categories = await loadCategories();
    const subcategories = categories.filter((category) => category.parentId);

    if (!subcategories.length) {
      grid.innerHTML = '<p class="empty-state">Nenhuma categoria cadastrada ainda.</p>';
      return;
    }

    const withImageFirst = [...subcategories].sort((a, b) => {
      const aHasImage = a.imageUrl ? 0 : 1;
      const bHasImage = b.imageUrl ? 0 : 1;
      if (aHasImage !== bHasImage) return aHasImage - bHasImage;
      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });

    grid.innerHTML = withImageFirst
      .slice(0, HOME_CATEGORY_PREVIEW_COUNT)
      .map((category, index) => {
        const fallback = CATEGORY_FALLBACK_COLORS[index % CATEGORY_FALLBACK_COLORS.length];
        const media = category.imageUrl
          ? `<img class="photo-card-img" src="${escapeHtml(category.imageUrl)}" alt="${escapeHtml(category.name)}" loading="lazy" />`
          : `<span class="photo-card-fallback" style="background:${fallback}" aria-hidden="true"></span>`;
        return `
          <a class="photo-card photo-card--sm fade-in" href="shop.html?category=${category.id}">
            ${media}
            <span class="photo-card-overlay" aria-hidden="true"></span>
            <span class="photo-card-caption">
              <span class="photo-card-name">${escapeHtml(category.name)}</span>
              <span class="photo-card-link">conferir ›</span>
            </span>
          </a>
        `;
      })
      .join('');
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar as categorias.</p>';
  }
}

function renderEditorial(products) {
  const root = document.querySelector('[data-editorial]');
  if (!root) return;

  const curated = products.slice(0, HOME_EDITORIAL_COUNT);
  if (!curated.length) {
    root.closest('.editorial')?.remove();
    return;
  }

  const feature = curated[0];
  const featureMedia = feature.imageUrl
    ? `<img src="${escapeHtml(feature.imageUrl)}" alt="${escapeHtml(feature.name)}" loading="lazy" />`
    : productImagePlaceholder();

  const list = curated
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
        <div class="editorial-eyebrow">Looks da estação</div>
        <h2 class="editorial-title">Combina bem</h2>
        <p class="editorial-text">Peças da coleção que funcionam juntas — do café da manhã à hora de dormir.</p>
      </div>
      <a class="editorial-feature-media" href="product.html?id=${feature.id}">
        ${featureMedia}
        <span class="editorial-feature-cta">Confira →</span>
      </a>
    </div>
    <div class="editorial-list">${list}</div>
  `;
}

async function renderBestSellers() {
  const grid = document.querySelector('[data-product-grid]');
  try {
    const response = await apiGet(`/products?page=0&size=${HOME_PRODUCT_PREVIEW_COUNT}`);
    const products = response.content;
    if (!products.length) {
      grid.innerHTML = '<p class="empty-state">Nenhum produto disponível no momento.</p>';
      document.querySelector('.editorial')?.remove();
      return;
    }
    grid.innerHTML = products.map((product) => buildProductCard(product)).join('');
    renderEditorial(products);
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos.</p>';
    document.querySelector('.editorial')?.remove();
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
  renderHomeCategories();
  renderBestSellers();
  initNewsletterForm();
});
