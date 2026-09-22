const SHOP_PRODUCTS_PAGE_SIZE = 20;
const SHOP_PARENT_CATEGORY_ORDER = [
  'bebe menina',
  'bebe menino',
  'bebe unissex',
  'meninas',
  'meninos',
];
const SHOP_SIZE_RANGES = [
  { value: 'rn-12-meses', label: 'RN - 12 meses' },
  { value: '01-03-anos', label: '01 - 03 anos' },
  { value: '04-10-anos', label: '04 - 10 anos' },
  { value: '10-18-anos', label: '10 - 18 anos' },
];
const SHOP_BRANDS = [
  { value: 'elian', label: 'Elian' },
  { value: 'brandili', label: 'Brandili' },
  { value: 'coloritta', label: 'Colorittá' },
  { value: 'fakini', label: 'Fakini' },
  { value: 'mundi', label: 'Mundi' },
  { value: 'malwee-kids', label: 'Malwee kids' },
];

let allProducts = []; // apenas os produtos já carregados via "Carregar mais", não o catálogo inteiro
let allCategories = [];
let shopColors = [];
let currentProductsPage = 0;
let totalProductsPages = 1;
let totalProductsElements = 0;
let isLoadingMoreProducts = false;
let productsRequestSequence = 0;
let categoryGroupsInitialized = false;
const openCategoryGroupIds = new Set();

function getShopParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    categoryId: params.get('category') || '',
    brand: params.get('brand') || '',
    sizeRange: params.get('sizeRange') || '',
    color: params.get('color') || '',
    query: (params.get('q') || '').trim().toLowerCase(),
  };
}

function setShopParams({ categoryId, brand, sizeRange, color, query }) {
  const params = new URLSearchParams();
  if (categoryId) params.set('category', categoryId);
  if (brand) params.set('brand', brand);
  if (sizeRange) params.set('sizeRange', sizeRange);
  if (color) params.set('color', color);
  if (query) params.set('q', query);
  const search = params.toString();
  history.replaceState(null, '', `shop.html${search ? `?${search}` : ''}`);
}

function buildProductsUrl(params, page) {
  const queryParams = new URLSearchParams();
  if (params.categoryId) queryParams.set('categoryId', params.categoryId);
  if (params.brand) queryParams.set('brand', params.brand);
  if (params.sizeRange) queryParams.set('sizeRange', params.sizeRange);
  if (params.color) queryParams.set('color', params.color);
  if (params.query) queryParams.set('q', params.query);
  queryParams.set('page', page);
  queryParams.set('size', SHOP_PRODUCTS_PAGE_SIZE);
  return `/products?${queryParams.toString()}`;
}

async function loadShopColors() {
  try {
    const colors = await apiGet('/products/colors');
    if (!Array.isArray(colors)) return [];
    return colors
      .filter((color) => String(color || '').trim())
      .map((color) => ({ value: String(color).trim(), label: String(color).trim() }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));
  } catch {
    return [];
  }
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

function normalizeCategoryName(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function normalizeCategoryWord(value) {
  const normalized = normalizeCategoryName(value).replace(/[^a-z0-9]/g, '');
  return normalized.length > 3 && normalized.endsWith('s')
    ? normalized.slice(0, -1)
    : normalized;
}

function childCategoryDisplayName(childName, parentName) {
  const words = (childName || '').trim().split(/\s+/).filter(Boolean);
  const parentWords = new Set(
    (parentName || '').trim().split(/\s+/).map(normalizeCategoryWord).filter(Boolean)
  );

  while (words.length > 1 && parentWords.has(normalizeCategoryWord(words[words.length - 1]))) {
    words.pop();
  }

  return words.join(' ') || childName;
}

function compareCategoryNames(left, right) {
  return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
}

function buildCategoryTree() {
  const categoriesById = new Map(allCategories.map((category) => [category.id, category]));
  const childrenByParentId = new Map();

  allCategories.forEach((category) => {
    if (!category.parentId || !categoriesById.has(category.parentId)) return;
    const children = childrenByParentId.get(category.parentId) || [];
    children.push(category);
    childrenByParentId.set(category.parentId, children);
  });

  const roots = allCategories
    .filter((category) => !category.parentId || !categoriesById.has(category.parentId))
    .sort((left, right) => {
      const leftOrder = SHOP_PARENT_CATEGORY_ORDER.indexOf(normalizeCategoryName(left.name));
      const rightOrder = SHOP_PARENT_CATEGORY_ORDER.indexOf(normalizeCategoryName(right.name));
      const leftRank = leftOrder === -1 ? SHOP_PARENT_CATEGORY_ORDER.length : leftOrder;
      const rightRank = rightOrder === -1 ? SHOP_PARENT_CATEGORY_ORDER.length : rightOrder;
      return leftRank - rightRank || compareCategoryNames(left, right);
    });

  return roots.map((root) => ({
    root,
    children: (childrenByParentId.get(root.id) || []).sort(compareCategoryNames),
  }));
}

function getActiveCategoryContext(categoryId) {
  if (!categoryId) return null;
  const category = allCategories.find((item) => item.id === categoryId);
  if (!category) return null;
  const parent = category.parentId
    ? allCategories.find((item) => item.id === category.parentId)
    : null;
  return { category, parent };
}

function initializeOpenCategoryGroup() {
  if (categoryGroupsInitialized) return;
  const { categoryId } = getShopParams();
  const context = getActiveCategoryContext(categoryId);
  if (context) openCategoryGroupIds.add(context.parent?.id || context.category.id);
  categoryGroupsInitialized = true;
}

function categoryRadioMarkup(category, label, categoryId) {
  return `
    <label class="category-filter-item">
      <input type="radio" name="category-filter" value="${escapeAttr(category.id)}"
        ${categoryId === category.id ? 'checked' : ''} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function renderCategoryFilterList() {
  const list = document.querySelector('[data-category-filter-list]');
  const { categoryId } = getShopParams();
  initializeOpenCategoryGroup();

  const allItem = `
    <li class="category-filter-all">
      <label class="category-filter-item">
        <input type="radio" name="category-filter" value="" ${!categoryId ? 'checked' : ''} />
        <span>Todas as categorias</span>
      </label>
    </li>
  `;

  const groups = buildCategoryTree().map(({ root, children }, index) => {
    const isOpen = openCategoryGroupIds.has(root.id);
    const panelId = `shop-category-group-${index}`;
    const childItems = children.map((child) => `
      <li>${categoryRadioMarkup(
        child,
        childCategoryDisplayName(child.name, root.name),
        categoryId
      )}</li>
    `).join('');

    return `
      <li class="shop-category-group">
        <button class="shop-category-group-toggle" type="button"
          aria-expanded="${isOpen}" aria-controls="${panelId}"
          data-category-group-toggle="${escapeHtml(root.id)}">
          <span>${escapeHtml(root.name)}</span>
          <svg class="shop-category-group-arrow" viewBox="0 0 24 24" width="18" height="18"
            fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <ul class="shop-category-children" id="${panelId}" ${isOpen ? '' : 'hidden'}>
          <li>${categoryRadioMarkup(root, `Ver tudo de ${root.name}`, categoryId)}</li>
          ${childItems}
        </ul>
      </li>
    `;
  }).join('');

  list.innerHTML = allItem + groups;

  list.querySelectorAll('[data-category-group-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const groupId = button.dataset.categoryGroupToggle;
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (openCategoryGroupIds.has(groupId)) {
        openCategoryGroupIds.delete(groupId);
      } else {
        openCategoryGroupIds.add(groupId);
      }
      const isOpen = openCategoryGroupIds.has(groupId);
      button.setAttribute('aria-expanded', String(isOpen));
      panel.hidden = !isOpen;
    });
  });

  list.querySelectorAll('input[name="category-filter"]').forEach((input) => {
    input.addEventListener('change', () => {
      applyShopFilters({ ...getShopParams(), categoryId: input.value });
    });
  });
}

function renderFilterOptions(selector, options, activeValue, paramKey, renderPrefix = () => '') {
  const container = document.querySelector(selector);
  container.innerHTML = options.map((option) => `
    <button class="shop-chip" type="button" aria-pressed="${activeValue === option.value}"
      data-filter-option="${paramKey}" data-filter-value="${escapeAttr(option.value)}">
      ${renderPrefix(option)}${escapeHtml(option.label)}
    </button>
  `).join('');

  container.querySelectorAll('[data-filter-option]').forEach((button) => {
    button.addEventListener('click', () => {
      const params = getShopParams();
      const key = button.dataset.filterOption;
      const value = button.dataset.filterValue;
      applyShopFilters({ ...params, [key]: params[key] === value ? '' : value });
    });
  });
}

function renderColorFilterOptions(activeColor) {
  const section = document.querySelector('[data-color-filter-section]');
  section.hidden = shopColors.length === 0;
  if (!shopColors.length) return;
  renderFilterOptions(
    '[data-color-filter-options]',
    shopColors,
    activeColor,
    'color',
    (option) => variantColorSwatchMarkup(option.value)
  );
}

function getFilterLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function getActiveFilterItems() {
  const { categoryId, brand, sizeRange, color, query } = getShopParams();
  const filters = [];
  const categoryContext = getActiveCategoryContext(categoryId);

  if (categoryContext) {
    const label = categoryContext.parent
      ? `${categoryContext.parent.name} · ${childCategoryDisplayName(
        categoryContext.category.name,
        categoryContext.parent.name
      )}`
      : categoryContext.category.name;
    filters.push({ key: 'categoryId', label });
  } else if (categoryId) {
    filters.push({ key: 'categoryId', label: 'Categoria' });
  }
  if (sizeRange) {
    filters.push({ key: 'sizeRange', label: getFilterLabel(SHOP_SIZE_RANGES, sizeRange) });
  }
  if (color) filters.push({ key: 'color', label: `Cor: ${getFilterLabel(shopColors, color)}` });
  if (brand) filters.push({ key: 'brand', label: getFilterLabel(SHOP_BRANDS, brand) });
  if (query) filters.push({ key: 'query', label: `Busca: ${query}` });

  return filters;
}

function renderActiveFilters() {
  const container = document.querySelector('[data-active-filters]');
  const filters = getActiveFilterItems();
  container.hidden = filters.length === 0;
  container.innerHTML = filters.length ? `
    <div class="shop-active-filter-list" aria-label="Filtros ativos">
      ${filters.map((filter) => `
        <button class="shop-active-filter-chip" type="button"
          data-remove-filter="${filter.key}"
          aria-label="Remover filtro ${escapeHtml(filter.label)}">
          <span>${escapeHtml(filter.label)}</span><span aria-hidden="true">×</span>
        </button>
      `).join('')}
    </div>
    <button class="shop-clear-filters shop-clear-filters--inline" type="button"
      data-clear-filters>Limpar filtros</button>
  ` : '';

  container.querySelectorAll('[data-remove-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      applyShopFilters({ ...getShopParams(), [button.dataset.removeFilter]: '' });
    });
  });
  container.querySelector('[data-clear-filters]')?.addEventListener('click', clearShopFilters);
}

function shopFocusIdentity(element) {
  if (!element?.closest('[data-filter-panel], [data-active-filters]')) return null;
  if (element.matches('input[name="category-filter"]')) {
    return { type: 'category', value: element.value };
  }
  if (element.matches('[data-filter-option]')) {
    return {
      type: 'option',
      option: element.dataset.filterOption,
      value: element.dataset.filterValue,
    };
  }
  if (element.matches('[data-category-group-toggle]')) {
    return { type: 'group', value: element.dataset.categoryGroupToggle };
  }
  if (element.matches('[data-remove-filter]')) {
    return { type: 'active', value: element.dataset.removeFilter };
  }
  if (element.matches('[data-clear-filters]')) {
    return {
      type: 'clear',
      scope: element.closest('[data-active-filters]') ? 'active' : 'panel',
    };
  }
  return null;
}

function findShopFocusTarget(identity) {
  if (identity.type === 'category') {
    return [...document.querySelectorAll('input[name="category-filter"]')]
      .find((element) => element.value === identity.value);
  }
  if (identity.type === 'option') {
    return [...document.querySelectorAll('[data-filter-option]')].find((element) => (
      element.dataset.filterOption === identity.option
      && element.dataset.filterValue === identity.value
    ));
  }
  if (identity.type === 'group') {
    return [...document.querySelectorAll('[data-category-group-toggle]')]
      .find((element) => element.dataset.categoryGroupToggle === identity.value);
  }
  if (identity.type === 'active') {
    return [...document.querySelectorAll('[data-remove-filter]')]
      .find((element) => element.dataset.removeFilter === identity.value);
  }
  const scope = identity.scope === 'active'
    ? document.querySelector('[data-active-filters]')
    : document.querySelector('[data-filter-panel]');
  return scope?.querySelector('[data-clear-filters]');
}

function focusShopFallback() {
  if (window.matchMedia('(max-width: 767px)').matches) {
    document.querySelector('[data-filter-toggle]').focus();
    return;
  }

  const panel = document.querySelector('[data-filter-panel]');
  let title = panel.querySelector('[data-filter-panel-title]');
  if (!title) {
    title = document.createElement('h2');
    title.className = 'visually-hidden';
    title.dataset.filterPanelTitle = '';
    title.textContent = 'Filtros';
    panel.prepend(title);
  }
  title.tabIndex = -1;
  title.focus();
}

function preserveFocus(renderFn) {
  const identity = shopFocusIdentity(document.activeElement);
  renderFn();
  if (!identity) return;

  const target = findShopFocusTarget(identity);
  if (target && !target.hidden && !target.closest('[hidden]')) {
    target.focus();
    return;
  }
  focusShopFallback();
}

function updateFilterControls() {
  const { brand, sizeRange, color } = getShopParams();
  preserveFocus(() => {
    renderCategoryFilterList();
    renderFilterOptions('[data-size-filter-options]', SHOP_SIZE_RANGES, sizeRange, 'sizeRange');
    renderColorFilterOptions(color);
    renderFilterOptions('[data-brand-filter-options]', SHOP_BRANDS, brand, 'brand');

    const activeCount = getActiveFilterItems().length;
    document.querySelector('.shop-filter-panel [data-clear-filters]').hidden = activeCount === 0;
    document.querySelector('[data-filter-toggle]').textContent = activeCount
      ? `Filtros (${activeCount})`
      : 'Filtros';
    renderActiveFilters();
  });
}

function clearShopFilters() {
  applyShopFilters({ categoryId: '', brand: '', sizeRange: '', color: '', query: '' });
}

async function applyShopFilters(nextParams) {
  const requestId = ++productsRequestSequence;
  setShopParams(nextParams);
  currentProductsPage = 0;
  renderProductsLoading();
  updateFilterControls();
  updateBreadcrumb();

  try {
    const response = await apiGet(buildProductsUrl(getShopParams(), 0));
    if (requestId !== productsRequestSequence) return;

    allProducts = response.content;
    currentProductsPage = response.page;
    totalProductsPages = response.totalPages;
    totalProductsElements = response.totalElements;
    updateFilterControls();
    renderFilteredProducts();
    updateLoadMoreButton();
    announceProductResults();
  } catch (error) {
    if (requestId !== productsRequestSequence) return;
    document.querySelector('[data-product-grid]').innerHTML =
      '<p class="empty-state empty-state--full-row">Não foi possível carregar os produtos.</p>';
    totalProductsPages = 1;
    currentProductsPage = 0;
    updateLoadMoreButton();
    showToast(error.message || 'Erro ao filtrar os produtos', 'error');
  }
}

function updateBreadcrumb() {
  const { categoryId } = getShopParams();
  const breadcrumb = document.querySelector('[data-breadcrumb-current]');
  if (!categoryId) {
    breadcrumb.textContent = 'Loja';
    return;
  }
  const category = allCategories.find((item) => item.id === categoryId);
  breadcrumb.textContent = category ? category.name : 'Loja';
}

function renderFilteredProducts() {
  const grid = document.querySelector('[data-product-grid]');

  if (!allProducts.length) {
    grid.innerHTML = `
      <div class="empty-state empty-state--full-row">
        <div class="empty-state-icon">${ICONS.search}</div>
        <p>Nenhum produto encontrado com esses filtros.</p>
        <button class="btn btn-primary" type="button" data-empty-clear-filters>
          Limpar filtros
        </button>
      </div>
    `;
    grid.querySelector('[data-empty-clear-filters]').addEventListener('click', clearShopFilters);
    return;
  }

  grid.innerHTML = allProducts.map((product) => buildProductCard(product)).join('');
}

function announceProductResults() {
  const announcement = document.querySelector('[data-results-announcement]');
  const suffix = totalProductsElements === 1 ? '' : 's';
  announcement.textContent = `${totalProductsElements} produto${suffix} encontrado${suffix}`;
}

function initFilterToggle() {
  const toggle = document.querySelector('[data-filter-toggle]');
  const panel = document.querySelector('[data-filter-panel]');
  toggle.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

function updateLoadMoreButton() {
  const wrapper = document.querySelector('[data-load-more-wrapper]');
  if (!wrapper) return;
  wrapper.hidden = currentProductsPage + 1 >= totalProductsPages;
}

async function loadMoreProducts() {
  if (isLoadingMoreProducts || currentProductsPage + 1 >= totalProductsPages) return;

  isLoadingMoreProducts = true;
  const requestId = ++productsRequestSequence;
  const loadMoreBtn = document.querySelector('[data-load-more-btn]');
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Carregando...';
  }

  try {
    const response = await apiGet(
      buildProductsUrl(getShopParams(), currentProductsPage + 1)
    );
    if (requestId !== productsRequestSequence) return;

    allProducts = allProducts.concat(response.content);
    currentProductsPage = response.page;
    totalProductsPages = response.totalPages;
    totalProductsElements = response.totalElements;
    renderFilteredProducts();
    updateLoadMoreButton();
  } catch (error) {
    if (requestId !== productsRequestSequence) return;
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
    // Categoria ainda não sincronizada nesse ambiente: remove o parâmetro
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
  const { categoryId } = getShopParams();
  initFilterToggle();

  const loadMoreBtn = document.querySelector('[data-load-more-btn]');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMoreProducts);
  document.querySelector('.shop-filter-panel [data-clear-filters]')
    .addEventListener('click', clearShopFilters);

  try {
    const [categories, productsResponse, colors] = await Promise.all([
      apiGet('/categories'),
      apiGet(buildProductsUrl(getShopParams(), 0)),
      loadShopColors(),
    ]);
    allCategories = categories;
    shopColors = colors;
    applyShopSeo(categories);
    allProducts = productsResponse.content;
    currentProductsPage = productsResponse.page;
    totalProductsPages = productsResponse.totalPages;
    totalProductsElements = productsResponse.totalElements;

    updateFilterControls();
    updateBreadcrumb();
    renderFilteredProducts();
    updateLoadMoreButton();
    announceProductResults();
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos.</p>';
    showToast(error.message || 'Erro ao carregar a loja', 'error');
  }
}

document.addEventListener('DOMContentLoaded', initShopPage);
