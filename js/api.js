const API_BASE = 'http://localhost:8080';

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

function productImagePlaceholder() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>';
}

function buildProductCard(product, rootPath = '') {
  const price = lowestVariantPrice(product);
  const priceLabel = price === null ? 'Indisponível' : `A partir de ${formatPrice(price)}`;
  return `
    <article class="product-card fade-in">
      <a href="${rootPath}product.html?id=${product.id}" class="product-card-image">${productImagePlaceholder()}</a>
      <div class="product-card-body">
        <span class="product-card-category">${escapeHtml(product.categoryName || '')}</span>
        <h3 class="product-card-name">${escapeHtml(product.name)}</h3>
        <span class="product-card-price">${priceLabel}</span>
        <div class="product-card-link">
          <a class="btn btn-secondary btn-sm btn-block" href="${rootPath}product.html?id=${product.id}">Ver detalhes</a>
        </div>
      </div>
    </article>
  `;
}
