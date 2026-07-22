let allProducts = [];
let allCategories = [];

function getShopParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    categoryId: params.get('category') || '',
    query: (params.get('q') || '').trim().toLowerCase(),
  };
}

function setShopParams({ categoryId, query }) {
  const params = new URLSearchParams();
  if (categoryId) params.set('category', categoryId);
  if (query) params.set('q', query);
  const search = params.toString();
  history.replaceState(null, '', `shop.html${search ? `?${search}` : ''}`);
}

function renderCategoryFilterList() {
  const list = document.querySelector('[data-category-filter-list]');
  const { categoryId } = getShopParams();

  const allItem = `
    <li>
      <label class="category-filter-item">
        <input type="radio" name="category-filter" value="" ${!categoryId ? 'checked' : ''} />
        Todas as categorias
      </label>
    </li>
  `;

  const items = allCategories
    .map(
      (category) => `
        <li>
          <label class="category-filter-item">
            <input type="radio" name="category-filter" value="${category.id}" ${categoryId === category.id ? 'checked' : ''} />
            ${escapeHtml(category.name)}
          </label>
        </li>
      `
    )
    .join('');

  list.innerHTML = allItem + items;

  list.querySelectorAll('input[name="category-filter"]').forEach((input) => {
    input.addEventListener('change', () => {
      setShopParams({ categoryId: input.value, query: getShopParams().query });
      renderFilteredProducts();
      updateBreadcrumb();
      document.querySelector('[data-filter-panel]').classList.remove('is-open');
    });
  });
}

function updateBreadcrumb() {
  const { categoryId } = getShopParams();
  const breadcrumb = document.querySelector('[data-breadcrumb-current]');
  if (!categoryId) {
    breadcrumb.textContent = 'Loja';
    return;
  }
  const category = allCategories.find((c) => c.id === categoryId);
  breadcrumb.textContent = category ? category.name : 'Loja';
}

function renderFilteredProducts() {
  const grid = document.querySelector('[data-product-grid]');
  const { categoryId, query } = getShopParams();

  const filtered = allProducts.filter((product) => {
    const matchesCategory = !categoryId || product.categoryId === categoryId;
    const matchesQuery = !query || product.name.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state empty-state--full-row">
        <div class="empty-state-icon">${ICONS.search}</div>
        <p>Nenhum produto encontrado.</p>
        <a class="btn btn-primary" href="shop.html">Ver todos os produtos</a>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((product) => buildProductCard(product)).join('');
}

function initFilterToggle() {
  const toggle = document.querySelector('[data-filter-toggle]');
  const panel = document.querySelector('[data-filter-panel]');
  toggle.addEventListener('click', () => panel.classList.toggle('is-open'));
}

async function initShopPage() {
  const grid = document.querySelector('[data-product-grid]');
  initFilterToggle();

  try {
    const [categories, products] = await Promise.all([apiGet('/categories'), apiGet('/products')]);
    allCategories = categories;
    allProducts = products;

    renderCategoryFilterList();
    updateBreadcrumb();
    renderFilteredProducts();
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos.</p>';
    showToast(error.message || 'Erro ao carregar a loja', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initShopPage);
