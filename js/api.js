const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:8080'
  : 'https://gabikids.duckdns.org';
const DEFAULT_API_TIMEOUT_MS = 15000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 60000;
const HANDLING_DAYS = 2; // dias úteis para embalar e postar nos Correios

function applyHandlingDays(days) {
  if (Array.isArray(days)) return days.map(applyHandlingDays);
  if (days === null || days === undefined || days === '') return days;

  if (typeof days === 'string') {
    const range = days.match(/^(\s*)(\d+(?:[.,]\d+)?)(\s+(?:a|até|-)\s+)(\d+(?:[.,]\d+)?)(\s*)$/i);
    if (range) {
      const min = Number(range[2].replace(',', '.'));
      const max = Number(range[4].replace(',', '.'));
      if (!Number.isFinite(min) || !Number.isFinite(max)) return days;
      return `${range[1]}${min + HANDLING_DAYS}${range[3]}${max + HANDLING_DAYS}${range[5]}`;
    }
  }

  const numericDays = Number(days);
  return Number.isFinite(numericDays) ? numericDays + HANDLING_DAYS : days;
}

function logAppError(context, error, details = {}) {
  const {
    code: fallbackCode = 'UNEXPECTED_ERROR',
    ...metadata
  } = details;

  console.error(`[${context}]`, {
    timestamp: new Date().toISOString(),
    code: error?.code || fallbackCode,
    message: error?.message || String(error || 'Erro desconhecido'),
    status: error?.status ?? null,
    details: metadata,
    error: error || null,
  });
}

class ApiError extends Error {
  constructor(message, status = null, code = 'API_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
  }
}

class ApiTimeoutError extends ApiError {
  constructor(timeoutMs) {
    super(
      `A comunicação com o servidor excedeu o limite de ${Math.ceil(timeoutMs / 1000)} segundos`,
      null,
      'API_TIMEOUT',
    );
    this.timeoutMs = timeoutMs;
  }
}

class ApiAbortError extends ApiError {
  constructor() {
    super('A comunicação com o servidor foi cancelada', null, 'API_ABORTED');
  }
}

class ApiContractError extends ApiError {
  constructor(endpoint, message) {
    super(`Resposta inválida da API em ${endpoint}: ${message}`, null, 'API_INVALID_RESPONSE');
    this.endpoint = endpoint;
  }
}

async function parseErrorMessage(response) {
  try {
    const data = await response.json();
    if (typeof data.error === 'string') return data.error;
    const fieldMessages = Object.values(data).filter((v) => typeof v === 'string');
    if (fieldMessages.length) return fieldMessages.join(' ');
  } catch (error) {
    logAppError('api.error_response.parse', error, {
      code: 'API_ERROR_BODY_PARSE_FAILED',
      responseStatus: response.status,
    });
  }
  return `Erro ${response.status} ao comunicar com o servidor`;
}

function createRequestContext(timeoutMs, externalSignal) {
  const controller = new AbortController();
  const context = {
    controller,
    signal: controller.signal,
    timeoutMs,
    timedOut: false,
  };

  const timeoutId = setTimeout(() => {
    context.timedOut = true;
    controller.abort();
  }, timeoutMs);

  const handleExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      handleExternalAbort();
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
    }
  }

  context.cleanup = () => {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', handleExternalAbort);
  };

  return context;
}

function requestAbortError(context) {
  return context.timedOut
    ? new ApiTimeoutError(context.timeoutMs)
    : new ApiAbortError();
}

async function fetchWithContext(url, config, context) {
  if (context.signal.aborted) {
    throw requestAbortError(context);
  }

  try {
    return await fetch(url, { ...config, signal: context.signal });
  } catch (error) {
    if (context.signal.aborted) {
      throw requestAbortError(context);
    }
    throw error;
  }
}

function waitForSharedPromise(promise, context) {
  if (context.signal.aborted) {
    return Promise.reject(requestAbortError(context));
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => reject(requestAbortError(context));

    context.signal.addEventListener('abort', handleAbort, { once: true });

    promise.then(
      (value) => {
        context.signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      (error) => {
        context.signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
}

function responsePath(endpoint) {
  return endpoint.split('?')[0];
}

function validateArrayResponse(data, endpoint) {
  if (!Array.isArray(data)) {
    throw new ApiContractError(endpoint, 'era esperado um array');
  }
}

function validateCartResponse(data, endpoint) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw new ApiContractError(endpoint, 'era esperado um carrinho com o campo "items" em formato de array');
  }
}

function validateOrderResponse(data, endpoint) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw new ApiContractError(endpoint, 'era esperado um pedido com o campo "items" em formato de array');
  }
}

function validateProductsPageResponse(data, endpoint) {
  const isValid =
    data &&
    typeof data === 'object' &&
    Array.isArray(data.content) &&
    typeof data.page === 'number' &&
    typeof data.totalPages === 'number' &&
    typeof data.totalElements === 'number';

  if (!isValid) {
    throw new ApiContractError(
      endpoint,
      'era esperada uma página com "content", "page", "totalPages" e "totalElements"',
    );
  }
}

function validateOrdersPageResponse(data, endpoint) {
  validateProductsPageResponse(data, endpoint);
  data.content.forEach((order) => validateOrderResponse(order, endpoint));
}

function validateApiResponse(endpoint, method, data) {
  const path = responsePath(endpoint);

  if (method === 'GET' && path === '/products') {
    validateProductsPageResponse(data, endpoint);
    return data;
  }

  if (method === 'GET' && path === '/orders') {
    validateOrdersPageResponse(data, endpoint);
    return data;
  }

  if (method === 'POST' && path === '/orders') {
    validateOrderResponse(data, endpoint);
    return data;
  }

  if (
    method === 'GET' &&
    ['/categories', '/addresses', '/shipping/calculate'].includes(path)
  ) {
    validateArrayResponse(data, endpoint);
    return data;
  }

  if (
    (method === 'GET' && path === '/cart') ||
    (method === 'POST' && path === '/cart/items') ||
    (method === 'PUT' && /^\/cart\/items\/[^/]+$/.test(path))
  ) {
    validateCartResponse(data, endpoint);
  }

  return data;
}

async function parseSuccessResponse(response, endpoint, method) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return validateApiResponse(endpoint, method, null);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiContractError(endpoint, 'o corpo não contém JSON válido');
  }

  return validateApiResponse(endpoint, method, data);
}

let refreshPromise = null;

async function refreshAccessToken(requestContext) {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshContext = createRequestContext(DEFAULT_API_TIMEOUT_MS);

      try {
        const response = await fetchWithContext(
          `${API_BASE}/auth/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          },
          refreshContext,
        );

        if (!response.ok) return false;

        let data;
        try {
          data = await response.json();
        } catch (error) {
          logAppError('api.auth.refresh_response.parse', error, {
            code: 'API_REFRESH_INVALID_RESPONSE',
            responseStatus: response.status,
          });
          return false;
        }

        if (!data || typeof data.accessToken !== 'string') return false;

        setAccessToken(data.accessToken);
        return true;
      } catch (error) {
        if (error instanceof ApiTimeoutError || error instanceof ApiAbortError) {
          throw error;
        }

        logAppError('api.auth.refresh', error, {
          code: 'API_REFRESH_FAILED',
        });
        return false;
      } finally {
        refreshContext.cleanup();
      }
    })().finally(() => {
        refreshPromise = null;
    });
  }

  return waitForSharedPromise(refreshPromise, requestContext);
}

function handleFailedRefresh() {
  clearSession();
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `${resolveRootPath()}auth.html?redirect=${redirect}`;
}

async function apiFetch(endpoint, options = {}) {
  const token = getAccessToken();
  const {
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    signal,
    ...fetchOptions
  } = options;
  const requestContext = createRequestContext(timeoutMs, signal);

  const config = {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    let response = await fetchWithContext(`${API_BASE}${endpoint}`, config, requestContext);

    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken(requestContext);
      if (refreshed) {
        config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
        response = await fetchWithContext(`${API_BASE}${endpoint}`, config, requestContext);
      } else {
        handleFailedRefresh();
        return null;
      }
    }

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new ApiError(message, response.status);
    }

    return await parseSuccessResponse(response, endpoint, config.method);
  } finally {
    requestContext.cleanup();
  }
}

function resolveRootPath() {
  return window.location.pathname.includes('/admin/') ? '../' : '';
}

async function apiGet(endpoint, options = {}) {
  return apiFetch(endpoint, { ...options, method: 'GET' });
}

async function apiPost(endpoint, body, options = {}) {
  return apiFetch(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
}

async function apiPut(endpoint, body, options = {}) {
  return apiFetch(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
}

async function apiDelete(endpoint, options = {}) {
  return apiFetch(endpoint, { ...options, method: 'DELETE' });
}

async function apiUploadFile(endpoint, file, options = {}) {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append('file', file);
  const {
    timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS,
    signal,
  } = options;
  const requestContext = createRequestContext(timeoutMs, signal);

  const config = {
    method: 'POST',
    headers: {},
    body: formData,
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Não setar Content-Type — o browser seta automaticamente com boundary
  try {
    let response = await fetchWithContext(`${API_BASE}${endpoint}`, config, requestContext);

    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken(requestContext);
      if (refreshed) {
        config.headers['Authorization'] = `Bearer ${getAccessToken()}`;
        response = await fetchWithContext(`${API_BASE}${endpoint}`, config, requestContext);
      } else {
        handleFailedRefresh();
        return null;
      }
    }

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new ApiError(message, response.status);
    }

    return await parseSuccessResponse(response, endpoint, config.method);
  } finally {
    requestContext.cleanup();
  }
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

const ADMIN_ORDER_STATUS_LABELS = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

const ADMIN_ORDER_STATUS_BADGE_CLASS = {
  PENDING: 'badge-pending',
  PAID: 'badge-paid',
  SHIPPED: 'badge-shipped',
  DELIVERED: 'badge-delivered',
  CANCELLED: 'badge-cancelled',
};

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
  const priceLabel = price === null ? 'Indisponível' : formatPrice(price);
  const installmentLabel = price !== null ? `ou 3x de ${formatPrice(price / 3)}` : '';
  const imageContent = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
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
