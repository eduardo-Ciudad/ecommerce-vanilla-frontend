const API_BASE = 'http://localhost:8080';
//const API_BASE = 'https://gabikids.duckdns.org';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function parseErrorMessage(response) {
  try {
    const data = await response.json();
    if (typeof data.error === 'string') return data.error;
    const fieldMessages = Object.values(data).filter((v) => typeof v === 'string');
    if (fieldMessages.length) return fieldMessages.join(' ');
  } catch {
    /* corpo sem JSON */
  }
  return `Erro ${response.status} ao comunicar com o servidor`;
}

let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const data = await response.json();
        setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function apiFetch(endpoint, options = {}) {
  const token = getAccessToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
      response = await fetch(`${API_BASE}${endpoint}`, config);
    } else {
      clearSession();
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${resolveRootPath()}auth.html?redirect=${redirect}`;
      return null;
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function resolveRootPath() {
  return window.location.pathname.includes('/admin/') ? '../' : '';
}

async function apiGet(endpoint) {
  return apiFetch(endpoint, { method: 'GET' });
}

async function apiPost(endpoint, body) {
  return apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
}

async function apiPut(endpoint, body) {
  return apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(body) });
}

async function apiDelete(endpoint) {
  return apiFetch(endpoint, { method: 'DELETE' });
}

async function apiUploadFile(endpoint, file) {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const config = {
    method: 'POST',
    headers: {},
    body: formData,
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Não setar Content-Type — o browser seta automaticamente com boundary
  let response = await fetch(`${API_BASE}${endpoint}`, config);

  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
      response = await fetch(`${API_BASE}${endpoint}`, config);
    }
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPrice(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function lowestVariantPrice(product) {
  if (!product.variants || !product.variants.length) return null;
  return Math.min(...product.variants.map((v) => Number(v.price)));
}

const PAYMENT_STATUS_LABELS = {
  approved: 'Pago',
  pending: 'Aguardando pagamento',
  rejected: 'Pagamento recusado',
  in_process: 'Processando pagamento',
};

const PAYMENT_STATUS_BADGE_CLASS = {
  approved: 'badge-paid',
  pending: 'badge-pending',
  rejected: 'badge-cancelled',
  in_process: 'badge-pending',
};

function productImagePlaceholder() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>';
}

function totalVariantStock(product) {
  if (!product.variants || !product.variants.length) return 0;
  return product.variants.reduce((total, v) => total + Number(v.stock || 0), 0);
}

function productCardBadge(product) {
  const NEW_WINDOW_DAYS = 14;
  const LOW_STOCK_THRESHOLD = 5;

  if (product.createdAt) {
    const ageDays = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= NEW_WINDOW_DAYS) {
      return '<span class="product-card-badge">Novo</span>';
    }
  }

  const stock = totalVariantStock(product);
  if (stock > 0 && stock <= LOW_STOCK_THRESHOLD) {
    return '<span class="product-card-badge product-card-badge--stock">Últimas un.</span>';
  }

  return '';
}

function buildProductCard(product, rootPath = '') {
  const price = lowestVariantPrice(product);
  const priceLabel = price === null ? 'Indisponível' : `A partir de ${formatPrice(price)}`;
  const installmentLabel = price !== null ? `ou 3x de ${formatPrice(price / 3)}` : '';
  const imageContent = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" loading="lazy" />`
    : productImagePlaceholder();

  return `
    <article class="product-card fade-in">
      <a href="${rootPath}product.html?id=${product.id}" class="product-card-image">
        ${productCardBadge(product)}
        <span class="product-card-wishlist" aria-hidden="true">${ICONS.heart}</span>
        ${imageContent}
      </a>
      <div class="product-card-body">
        <span class="product-card-category">${escapeHtml(product.categoryName || '')}</span>
        <a href="${rootPath}product.html?id=${product.id}">
          <h3 class="product-card-name">${escapeHtml(product.name)}</h3>
        </a>
        <span class="product-card-price">${priceLabel}</span>
        ${installmentLabel ? `<span class="product-card-installment">${installmentLabel}</span>` : ''}
      </div>
    </article>
  `;
}
