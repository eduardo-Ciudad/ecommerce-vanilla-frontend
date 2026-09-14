const SHOP_CATEGORY_PREVIEW_COUNT = 3;
const SHOP_PRODUCTS_PAGE_SIZE = 20;

let allProducts = []; // apenas os produtos já carregados via "Carregar mais", não o catálogo inteiro
let allCategories = [];
let categoriesExpanded = false;
let currentProductsPage = 0;
let totalProductsPages = 1;
let isLoadingMoreProducts = false;

function getShopParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    categoryId: params.get('category') || '',
    brand: params.get('brand') || '',
    sizeRange: params.get('sizeRange') || '',
    query: (params.get('q') || '').trim().toLowerCase(),
  };
}

function setShopParams({ categoryId, brand, sizeRange, query }) {
  const params = new URLSearchParams();
  if (categoryId) params.set('category', categoryId);
  if (brand) params.set('brand', brand);
  if (sizeRange) params.set('sizeRange', sizeRange);
  if (query) params.set('q', query);
  const search = params.toString();
  history.replaceState(null, '', `shop.html${search ? `?${search}` : ''}`);
}

function buildProductsUrl(categoryId, brand, sizeRange, query, page) {
  const categoryParam = categoryId ? `categoryId=${encodeURIComponent(categoryId)}&` : '';
  const brandParam = brand ? `brand=${encodeURIComponent(brand)}&` : '';
  const sizeRangeParam = sizeRange ? `sizeRange=${encodeURIComponent(sizeRange)}&` : '';
  const queryParam = query ? `q=${encodeURIComponent(query)}&` : '';
  return `/products?${categoryParam}${brandParam}${sizeRangeParam}${queryParam}page=${page}&size=${SHOP_PRODUCTS_PAGE_SIZE}`;
}

function renderProductsLoading() {
  const grid = document.querySelector('[data-product-grid]');
  const loadMoreWrapper = document.querySelector('[data-load-more-wrapper]');
  if (loadMoreWrapper) loadMoreWrapper.hidden = true;
  grid.innerHTML = Array.from(
    { length: 4 },
    () => '<div class="skeleton product-card-skeleton"></div>'
  ).join('');
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

  const visibleCategories = categoriesExpanded
    ? allCategories
    : allCategories.slice(0, SHOP_CATEGORY_PREVIEW_COUNT);

  const items = visibleCategories
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

  const toggleItem = !categoriesExpanded && allCategories.length > SHOP_CATEGORY_PREVIEW_COUNT
    ? `
      <li>
        <button type="button" class="category-filter-toggle" data-category-filter-toggle>Ver todas as categorias</button>
      </li>
    `
    : '';

  list.innerHTML = allItem + items + toggleItem;

  list.querySelectorAll('input[name="category-filter"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const { brand, sizeRange, query } = getShopParams();
      setShopParams({ categoryId: input.value, brand, sizeRange, query });
      currentProductsPage = 0;
      renderProductsLoading();

      try {
        const response = await apiGet(buildProductsUrl(input.value, brand, sizeRange, query, 0));
        allProducts = response.content;
        currentProductsPage = response.page;
        totalProductsPages = response.totalPages;
        renderFilteredProducts();
        updateLoadMoreButton();
      } catch (error) {
        document.querySelector('[data-product-grid]').innerHTML =
          '<p class="empty-state">Não foi possível carregar os produtos.</p>';
        showToast(error.message || 'Erro ao filtrar os produtos', 'error');
      }

      updateBreadcrumb();
      document.querySelector('[data-filter-panel]').classList.remove('is-open');
    });
  });

  const toggleButton = list.querySelector('[data-category-filter-toggle]');
  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      categoriesExpanded = true;
      renderCategoryFilterList();
    });
  }
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

  if (!allProducts.length) {
    grid.innerHTML = `
      <div class="empty-state empty-state--full-row">
        <div class="empty-state-icon">${ICONS.search}</div>
        <p>Nenhum produto encontrado.</p>
        <a class="btn btn-primary" href="shop.html">Ver todos os produtos</a>
      </div>
    `;
    return;
  }

  grid.innerHTML = allProducts.map((product) => buildProductCard(product)).join('');
}

function initFilterToggle() {
  const toggle = document.querySelector('[data-filter-toggle]');
  const panel = document.querySelector('[data-filter-panel]');
  toggle.addEventListener('click', () => panel.classList.toggle('is-open'));
}

function updateLoadMoreButton() {
  const wrapper = document.querySelector('[data-load-more-wrapper]');
  if (!wrapper) return;
  wrapper.hidden = currentProductsPage + 1 >= totalProductsPages;
}

async function loadMoreProducts() {
  if (isLoadingMoreProducts || currentProductsPage + 1 >= totalProductsPages) return;

  isLoadingMoreProducts = true;
  const loadMoreBtn = document.querySelector('[data-load-more-btn]');
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Carregando...';
  }

  try {
    const { categoryId, brand, sizeRange, query } = getShopParams();
    const response = await apiGet(
      buildProductsUrl(categoryId, brand, sizeRange, query, currentProductsPage + 1)
    );
    allProducts = allProducts.concat(response.content);
    currentProductsPage = response.page;
    totalProductsPages = response.totalPages;
    renderFilteredProducts();
    updateLoadMoreButton();
  } catch (error) {
    showToast(error.message || 'Não foi possível carregar mais produtos', 'error');
  } finally {
    isLoadingMoreProducts = false;
    if (loadMoreBtn) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Carregar mais produtos';
    }
  }
}

async function resolveBlingCategoryParam() {
  const params = new URLSearchParams(window.location.search);
  const blingCategoryId = params.get('blingCategory');
  if (!blingCategoryId) return;

  try {
    const category = await apiGet(`/categories/by-bling-id/${encodeURIComponent(blingCategoryId)}`);
    params.delete('blingCategory');
    params.set('category', category.id);
  } catch (error) {
    // Categoria ainda não sincronizada nesse ambiente — remove o parâmetro
    // inválido e segue sem filtro de categoria, em vez de quebrar a página.
    params.delete('blingCategory');
  }

  const newSearch = params.toString();
  const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
  window.history.replaceState(null, '', newUrl);
}

async function initShopPage() {
  await resolveBlingCategoryParam();
  const grid = document.querySelector('[data-product-grid]');
  const { categoryId, brand, sizeRange, query } = getShopParams();
  initFilterToggle();

  const loadMoreBtn = document.querySelector('[data-load-more-btn]');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreProducts);
  }

  try {
    const [categories, productsResponse] = await Promise.all([
      apiGet('/categories'),
      apiGet(buildProductsUrl(categoryId, brand, sizeRange, query, 0)),
    ]);
    allCategories = categories;
    applyShopSeo(categories);
    allProducts = productsResponse.content;
    currentProductsPage = productsResponse.page;
    totalProductsPages = productsResponse.totalPages;

    renderCategoryFilterList();
    updateBreadcrumb();
    renderFilteredProducts();
    updateLoadMoreButton();
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos.</p>';
    showToast(error.message || 'Erro ao carregar a loja', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initShopPage);
