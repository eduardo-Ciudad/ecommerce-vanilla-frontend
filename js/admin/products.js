let productsCache = [];
let productCategoriesCache = [];
let currentProductsPage = 0;
let totalProductsPages = 1;
let currentProductsSearch = '';

const ADMIN_PRODUCTS_PAGE_SIZE = 20;

function adminProductSkus(product) {
  const skus = Array.isArray(product.variants)
    ? product.variants.map((variant) => String(variant.sku || '').trim()).filter(Boolean)
    : [];

  if (!skus.length) return '—';
  if (skus.length === 1) return escapeHtml(skus[0]);
  return `<span title="${escapeAttr(skus.join(', '))}">${escapeHtml(skus[0])} e mais ${skus.length - 1}</span>`;
}

function productDetailUrl(productId) {
  return `produto.html?id=${encodeURIComponent(productId)}`;
}

function renderProductsTable() {
  const tbody = document.querySelector('[data-products-tbody]');

  if (!productsCache.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Nenhum produto cadastrado.</div></td></tr>';
    return;
  }

  tbody.innerHTML = productsCache.map((product) => {
    const price = lowestVariantPrice(product);
    const stock = totalVariantStock(product);
    const stockClass = stock > 0 && stock <= 5 ? 'admin-product-stock--low' : '';
    const detailUrl = productDetailUrl(product.id);

    return `
      <tr class="fade-in admin-product-row" data-product-href="${escapeAttr(detailUrl)}">
        <td>
          <div class="admin-product-list-identity">
            <div class="admin-product-thumb">
              ${product.imageUrl
                ? `<img src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.name)}" />`
                : productImagePlaceholder()}
            </div>
            <div>
              <a class="admin-product-name-link" href="${escapeAttr(detailUrl)}">${escapeHtml(product.name)}</a>
              <div class="admin-product-name-sku">SKU: ${adminProductSkus(product)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(product.categoryName || '-')}</td>
        <td>${price === null ? '—' : formatPrice(price)}</td>
        <td class="${stockClass}">${stock} un.</td>
        <td><span class="badge ${product.active ? 'badge-active' : 'badge-inactive'}">${product.active ? 'Ativo' : 'Inativo'}</span></td>
        <td><a class="admin-product-open-link" href="${escapeAttr(detailUrl)}">Abrir</a></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-product-href]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (event.target.closest('a, button, input, select, textarea, label')) return;
      if (window.getSelection()?.toString()) return;
      window.location.href = row.dataset.productHref;
    });
  });
}

function renderProductsPagination() {
  const wrapper = document.querySelector('[data-products-pagination]');
  if (!wrapper) return;

  if (totalProductsPages <= 1) {
    wrapper.innerHTML = '';
    return;
  }

  wrapper.innerHTML = `
    <button class="btn btn-secondary" type="button" data-products-prev ${currentProductsPage <= 0 ? 'disabled' : ''}>Anterior</button>
    <span class="admin-pagination-label">Página ${currentProductsPage + 1} de ${totalProductsPages}</span>
    <button class="btn btn-secondary" type="button" data-products-next ${currentProductsPage + 1 >= totalProductsPages ? 'disabled' : ''}>Próxima</button>
  `;

  wrapper.querySelector('[data-products-prev]').addEventListener('click', () => loadProducts(currentProductsPage - 1));
  wrapper.querySelector('[data-products-next]').addEventListener('click', () => loadProducts(currentProductsPage + 1));
}

async function loadProducts(page = currentProductsPage) {
  const tbody = document.querySelector('[data-products-tbody]');
  try {
    const query = currentProductsSearch.trim()
      ? `&q=${encodeURIComponent(currentProductsSearch.trim())}`
      : '';
    const response = await apiGet(`/products?page=${page}&size=${ADMIN_PRODUCTS_PAGE_SIZE}&includeWithoutImage=true&includeOutOfStock=true${query}`);
    productsCache = response.content;
    currentProductsPage = response.page;
    totalProductsPages = response.totalPages;
    const subtitle = document.querySelector('[data-products-subtitle]');
    if (subtitle) {
      subtitle.textContent = `${response.totalElements} produto${response.totalElements === 1 ? '' : 's'} cadastrado${response.totalElements === 1 ? '' : 's'}`;
    }
    renderProductsTable();
    renderProductsPagination();
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">Não foi possível carregar os produtos.</div></td></tr>';
    showToast(error.message || 'Erro ao carregar produtos', 'error');
  }
}

async function initProductsPage() {
  if (!requireAdmin()) return;

  document.querySelector('[data-new-product-btn]').addEventListener('click', () => {
    openProductModal(null, productCategoriesCache, async (productId, change) => {
      if (change.created) window.location.href = productDetailUrl(productId);
    });
  });

  const searchInput = document.querySelector('[data-products-search]');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentProductsSearch = searchInput.value;
      loadProducts(0);
    }, 400);
  });

  try {
    productCategoriesCache = await apiGet('/categories');
  } catch (error) {
    logAppError('admin.products.categories.load', error);
    productCategoriesCache = [];
    showToast(
      'Não foi possível carregar as categorias. O cadastro e a edição de produtos podem ficar indisponíveis.',
      'warning',
    );
  }

  await loadProducts();
}

document.addEventListener('DOMContentLoaded', initProductsPage);
