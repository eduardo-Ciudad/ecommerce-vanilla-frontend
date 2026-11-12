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
  constructor(message, status = null, code = 'API_ERROR', data = null) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.data = data;
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

async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    if (typeof data.error === 'string') return { message: data.error, data };
    const fieldMessages = Object.values(data).filter((v) => typeof v === 'string');
    if (fieldMessages.length) return { message: fieldMessages.join(' '), data };
    return { message: `Erro ${response.status} ao comunicar com o servidor`, data };
  } catch (error) {
    logAppError('api.error_response.parse', error, {
      code: 'API_ERROR_BODY_PARSE_FAILED',
      responseStatus: response.status,
    });
  }
  return { message: `Erro ${response.status} ao comunicar com o servidor`, data: null };
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

  if (method === 'GET' && path === '/shipping/free-shipping') {
    const isValid = data
      && typeof data === 'object'
      && Number.isFinite(Number(data.threshold))
      && Array.isArray(data.methods);
    if (!isValid) {
      throw new ApiContractError(endpoint, 'era esperada uma regra de frete grátis válida');
    }
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
        if (typeof data.refreshToken === 'string') {
          setRefreshToken(data.refreshToken);
        }
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
      const errorResponse = await parseErrorResponse(response);
      throw new ApiError(errorResponse.message, response.status, 'API_ERROR', errorResponse.data);
    }

    return await parseSuccessResponse(response, endpoint, config.method);
  } finally {
    requestContext.cleanup();
  }
}

function resolveRootPath() {
  if (window.GABIKIDS_ROOT_PATH) return window.GABIKIDS_ROOT_PATH;
  return window.location.pathname.includes('/admin/') ? '../' : '';
}

async function apiGet(endpoint, options = {}) {
  return apiFetch(endpoint, { ...options, method: 'GET' });
}

let freeShippingRulePromise = null;

function getFreeShippingRule() {
  if (!freeShippingRulePromise) {
    freeShippingRulePromise = apiGet('/shipping/free-shipping')
      .then((rule) => ({
        threshold: Number(rule.threshold),
        methods: rule.methods.map((method) => String(method)),
      }))
      .catch(() => null);
  }
  return freeShippingRulePromise;
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
      const errorResponse = await parseErrorResponse(response);
      throw new ApiError(errorResponse.message, response.status, 'API_ERROR', errorResponse.data);
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

function escapeAttr(str) {
  return escapeHtml(str)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeVariantValue(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

const VARIANT_COLOR_SWATCHES = {
  amarelo: '#F4D35E',
  azul: '#3264A8',
  'azul claro': '#8EC5E8',
  'azul bebe': '#A9D6F5',
  'azul marinho': '#1D3557',
  marinho: '#1D3557',
  bege: '#D8C3A5',
  branco: '#FFFFFF',
  'off white': '#F7F3E8',
  offwhite: '#F7F3E8',
  cinza: '#9B9B9B',
  'cinza mescla': '#A7A7A7',
  mescla: '#A7A7A7',
  chumbo: '#4A4A4A',
  caqui: '#B7A477',
  coral: '#F27D72',
  creme: '#FFF0C7',
  goiaba: '#E97A72',
  jeans: '#4F7396',
  laranja: '#F5851F',
  lilas: '#B89ACD',
  marrom: '#795548',
  mostarda: '#D4A017',
  pink: '#E83E8C',
  preto: '#1A1A1A',
  rosa: '#E9A6B8',
  'rosa claro': '#F5C8D3',
  'rosa bebe': '#F4C2C2',
  'rosa pink': '#E83E8C',
  roxo: '#76448A',
  salmao: '#FA8072',
  verde: '#4F8A5B',
  'verde agua': '#7FCDBB',
  'verde militar': '#596B3D',
  'verde limao': '#A5CE3A',
  vermelho: '#E63B2E',
  vinho: '#722F37',
};

function variantColorSwatchMarkup(color) {
  const normalized = normalizeVariantValue(color);
  const fallbackName = normalized.split(/\s+/)[0];
  const background = VARIANT_COLOR_SWATCHES[normalized]
    || VARIANT_COLOR_SWATCHES[fallbackName]
    || '#C9C1B3';
  return `<span class="color-swatch" style="background:${background}" aria-hidden="true"></span>`;
}

function productCardColors(product) {
  const colors = [];
  const seenColors = new Set();

  for (const variant of product?.variants || []) {
    const color = String(variant?.color ?? '').trim();
    const normalizedColor = normalizeVariantValue(color);

    if (!color || Number(variant?.stock) <= 0 || seenColors.has(normalizedColor)) continue;

    seenColors.add(normalizedColor);
    colors.push(color);
  }

  return colors;
}

function productCardColorsMarkup(product) {
  const colors = productCardColors(product);
  if (!colors.length) return '';

  const visibleColors = colors.slice(0, 3);
  const swatches = visibleColors.map((color) => (
    `<span class="product-card-color" title="${escapeAttr(color)}">${variantColorSwatchMarkup(color)}</span>`
  ));

  if (colors.length > 3) {
    swatches.push(`<span class="product-card-colors-more">+${colors.length - 3}</span>`);
  }

  return `<div class="product-card-colors" role="img" aria-label="${colors.length} ${colors.length === 1 ? 'cor disponível' : 'cores disponíveis'}">${swatches.join('')}</div>`;
}

function variantDescription(item) {
  const parts = [];
  if (item?.size) parts.push(`Tamanho: ${item.size}`);
  if (item?.color) parts.push(`Cor: ${item.color}`);
  return parts.join(' · ');
}

function variantShortLabel(item) {
  return [item?.size, item?.color].filter(Boolean).join(' · ');
}

function compareVariantSizes(a, b) {
  const sizeA = normalizeVariantValue(a?.size ?? a);
  const sizeB = normalizeVariantValue(b?.size ?? b);
  const letterOrder = ['pp', 'p', 'm', 'g', 'gg', 'xg', 'xgg', 'eg', 'egg'];

  function sortKey(size) {
    if (size === 'rn') return [0, 0];

    const babyLetter = size.match(/^(p|m|g)\s*bebe$/);
    if (babyLetter) return [1, ['p', 'm', 'g'].indexOf(babyLetter[1])];

    const months = size.match(/^(\d+(?:[.,]\d+)?)\s*(?:mes|meses)$/);
    if (months) return [1, Number(months[1].replace(',', '.')) + 3];

    const letterIndex = letterOrder.indexOf(size);
    if (letterIndex !== -1) return [2, letterIndex];

    if (/^\d+(?:[.,]\d+)?$/.test(size)) {
      return [3, Number(size.replace(',', '.'))];
    }

    return [4, 0];
  }

  const keyA = sortKey(sizeA);
  const keyB = sortKey(sizeB);
  return keyA[0] - keyB[0]
    || keyA[1] - keyB[1]
    || sizeA.localeCompare(sizeB, 'pt-BR', { numeric: true });
}

function formatPrice(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPaymentDeadline(paymentDeadline) {
  if (!paymentDeadline) return '';

  const deadline = new Date(paymentDeadline);
  if (Number.isNaN(deadline.getTime())) return '';

  return deadline.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

function blingStatusDetails(status) {
  if (status === 'SENT') return { label: 'Enviado', badgeClass: 'badge-paid' };
  if (status === 'PENDING' || status === 'PROCESSING') {
    return { label: 'Enviando', badgeClass: 'badge-pending' };
  }
  if (status === 'FAILED') return { label: 'Falhou', badgeClass: 'badge-cancelled' };
  return { label: 'Não enviado', badgeClass: 'badge-inactive' };
}

function renderBlingStatusBadge(bling) {
  const details = blingStatusDetails(bling?.status ?? null);
  const title = bling?.status === 'FAILED' && bling.error
    ? ` title="${escapeAttr(bling.error)}"`
    : '';
  return `<span class="badge ${details.badgeClass}"${title}>${details.label}</span>`;
}

const PAYMENT_METHOD_LABELS = {
  pix: 'Pix',
  credit_card: 'Cartão de crédito',
  cash: 'Dinheiro',
  local_pix: 'Pix',
  card_machine: 'Maquininha',
  payment_link: 'Link de pagamento',
  store_credit: 'Fiado',
};

function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || method || '—';
}

function renderChannelBadge(channel) {
  return channel === 'LOCAL'
    ? '<span class="badge badge-channel-local">Loja</span>'
    : '<span class="badge badge-channel-site">Site</span>';
}

const PAYMENT_STATUS_LABELS = {
  approved: 'Pago',
  pending: 'Aguardando pagamento',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  in_process: 'Processando pagamento',
};

const PAYMENT_STATUS_BADGE_CLASS = {
  approved: 'badge-paid',
  pending: 'badge-pending',
  rejected: 'badge-cancelled',
  cancelled: 'badge-cancelled',
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
  const LOW_STOCK_THRESHOLD = 2;
  
  if (product.createdAt) {
    const ageDays = (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays <= NEW_WINDOW_DAYS) {
      return '<span class="product-card-badge">Novidade</span>';
    }
  }

  const stock = totalVariantStock(product);
  if (stock > 0 && stock <= LOW_STOCK_THRESHOLD) {
    return '<span class="product-card-badge product-card-badge--stock">Últimas unidades</span>';
  }

  return '';
}

function isTemporaryBlingImageUrl(imageUrl) {
  if (!imageUrl) return false;

  try {
    const url = new URL(imageUrl, window.location.href);
    const hostLooksLikeBling = /bling/i.test(url.hostname);
    const hasExpiration = ['expires', 'expiration', 'x-amz-expires', 'x-amz-signature', 'signature', 'token']
      .some((name) => url.searchParams.has(name));
    return hostLooksLikeBling || hasExpiration;
  } catch {
    return true;
  }
}

function productCardSecondaryImageUrl(product) {
  const imageUrl = product?.images?.[1]?.url;
  return imageUrl && !isTemporaryBlingImageUrl(imageUrl) ? imageUrl : '';
}

const productCardProductRegistry = new Map();
const PRODUCT_VIEW_TRANSITION_STORAGE_KEY = 'gabiKidsProductViewTransition';

function productCardQuickAddMarkup(product, productUrl) {
  if (typeof getQuickAddOptions !== 'function') return '';
  const options = getQuickAddOptions(product, compareVariantSizes);
  if (options.type === 'none') return '';
  if (options.type === 'choose') {
    return `
      <div class="product-card-quick-add">
        <a class="product-card-quick-choose" href="${productUrl}">Escolher cor e tamanho</a>
      </div>`;
  }
  const visibleSizes = options.sizes.slice(0, 5);
  const wideRemaining = options.sizes.length - visibleSizes.length;
  const narrowRemaining = options.sizes.length - Math.min(4, options.sizes.length);
  return `
    <div class="product-card-quick-add">
      <span>Adicionar rápido</span>
      <div class="product-card-quick-sizes">
        ${visibleSizes.map((option, index) => `
          <button class="product-card-quick-size${index === 4 ? ' product-card-quick-size--fifth' : ''}" type="button" data-quick-variant="${escapeAttr(option.variantId)}" aria-label="Adicionar tamanho ${escapeAttr(option.size)}">
            ${escapeHtml(option.size)}
          </button>`).join('')}
        ${wideRemaining > 0 ? `<a class="product-card-quick-more product-card-quick-more--wide" href="${productUrl}" aria-label="Ver mais ${wideRemaining} tamanhos">+${wideRemaining}</a>` : ''}
        ${narrowRemaining > 0 ? `<a class="product-card-quick-more product-card-quick-more--narrow" href="${productUrl}" aria-label="Ver mais ${narrowRemaining} tamanhos">+${narrowRemaining}</a>` : ''}
      </div>
    </div>`;
}

function buildProductCard(product, rootPath = '') {
  const price = lowestVariantPrice(product);
  const priceLabel = price === null ? 'Indisponível' : formatPrice(price);
  const installmentLabel = price !== null ? 'em até 6x no cartão' : '';
  const imageContent = product.imageUrl
    ? `<img class="product-card-image-primary" src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.name)}" loading="lazy" decoding="async" />`
    : productImagePlaceholder();
  const secondaryImageUrl = productCardSecondaryImageUrl(product);
  const isWishlisted = typeof isProductWishlisted === 'function' && isProductWishlisted(product.id);
  const productUrl = `${rootPath}product.html?id=${encodeURIComponent(product.id)}`;
  productCardProductRegistry.set(String(product.id), product);

  return `
    <article class="product-card fade-in" data-product-id="${escapeAttr(product.id)}">
      <div class="product-card-image-wrap"${secondaryImageUrl ? ` data-secondary-image-url="${escapeAttr(secondaryImageUrl)}"` : ''}>
        <a href="${productUrl}" class="product-card-image">
          ${productCardBadge(product)}
          ${imageContent}
        </a>
        <button class="product-card-wishlist" type="button" aria-label="${isWishlisted ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}" aria-pressed="${isWishlisted}">
          <span class="ms${isWishlisted ? ' is-filled' : ''}" aria-hidden="true">favorite</span>
        </button>
        ${productCardQuickAddMarkup(product, productUrl)}
      </div>
      <div class="product-card-body">
        <span class="product-card-category">${escapeHtml(product.categoryName || '')}</span>
        <a href="${productUrl}">
          <h3 class="product-card-name">${escapeHtml(product.name)}</h3>
        </a>
        <div class="product-card-price-row">
          <span class="product-card-price">${priceLabel}</span>
          ${productCardColorsMarkup(product)}
        </div>
        ${installmentLabel ? `<span class="product-card-installment">${installmentLabel}</span>` : ''}
      </div>
    </article>
  `;
}

function loadProductCardSecondaryImage(imageWrap) {
  const imageUrl = imageWrap.dataset.secondaryImageUrl;
  if (!imageUrl || imageWrap.dataset.secondaryImageLoaded) return;

  imageWrap.dataset.secondaryImageLoaded = 'true';
  const image = document.createElement('img');
  image.className = 'product-card-image-secondary';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.alt = '';
  image.addEventListener('error', () => image.remove(), { once: true });
  image.addEventListener('load', () => {
    requestAnimationFrame(() => image.classList.add('is-ready'));
  }, { once: true });
  image.src = imageUrl;
  imageWrap.querySelector('.product-card-image')?.append(image);
}

function syncProductCardWishlist(productId, isWishlisted, { animate = false } = {}) {
  document.querySelectorAll(`.product-card[data-product-id="${CSS.escape(String(productId))}"] .product-card-wishlist`)
    .forEach((button) => {
      const icon = button.querySelector('.ms');
      button.setAttribute('aria-pressed', String(isWishlisted));
      button.setAttribute('aria-label', isWishlisted ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
      icon?.classList.toggle('is-filled', isWishlisted);
      if (isWishlisted && animate) {
        button.classList.remove('is-added');
        void button.offsetWidth;
        button.classList.add('is-added');
      }
    });
}

document.addEventListener('pointerenter', (event) => {
  const imageWrap = event.target.closest?.('.product-card-image-wrap');
  if (imageWrap && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    loadProductCardSecondaryImage(imageWrap);
  }
}, true);

document.addEventListener('click', (event) => {
  const productLink = event.target.closest?.('.product-card-image, .product-card-body a');
  if (productLink && event.button === 0
    && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    const card = productLink.closest('.product-card');
    const primaryImage = card?.querySelector('.product-card-image-primary');
    if (card && primaryImage) {
      document.querySelectorAll('[data-product-main-image], [style]').forEach((element) => {
        if (element.matches('[data-product-main-image]')) {
          element.style.viewTransitionName = 'none';
        } else if (element.style.viewTransitionName === 'product-hero') {
          element.style.viewTransitionName = '';
        }
      });
      primaryImage.style.viewTransitionName = 'product-hero';
      try {
        sessionStorage.setItem(PRODUCT_VIEW_TRANSITION_STORAGE_KEY, JSON.stringify({
          productId: String(card.dataset.productId),
          imageUrl: primaryImage.currentSrc || primaryImage.src,
        }));
      } catch {
        primaryImage.style.viewTransitionName = '';
      }
    }
  }

  const quickButton = event.target.closest?.('[data-quick-variant]');
  if (quickButton) {
    event.preventDefault();
    event.stopPropagation();
    const card = quickButton.closest('.product-card');
    const product = productCardProductRegistry.get(String(card?.dataset.productId));
    const variant = product?.variants?.find((item) => String(item.id) === quickButton.dataset.quickVariant);
    if (!product || !variant || quickButton.disabled || typeof cartService === 'undefined') return;
    quickButton.disabled = true;
    cartService.addItem(product, variant, 1)
      .then((items) => {
        cartService.syncCartBadge(items);
        runAddToCartFeedback(quickButton, product.imageUrl);
      })
      .catch((error) => {
        showToast(error.message || 'Não foi possível adicionar ao carrinho', 'error');
      })
      .finally(() => { quickButton.disabled = false; });
    return;
  }

  const button = event.target.closest?.('.product-card-wishlist');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  const productId = button.closest('.product-card')?.dataset.productId;
  if (!productId || typeof toggleWishlistProduct !== 'function') return;
  const isWishlisted = toggleWishlistProduct(productId);
  syncProductCardWishlist(productId, isWishlisted, { animate: isWishlisted });
});

window.addEventListener('pageshow', (event) => {
  document.querySelectorAll('.product-card-image-primary').forEach((image) => {
    image.style.viewTransitionName = '';
  });
  if (event.persisted) {
    try { sessionStorage.removeItem(PRODUCT_VIEW_TRANSITION_STORAGE_KEY); } catch { /* noop */ }
  }
});

document.addEventListener('wishlist-changed', (event) => {
  const { productId, isWishlisted } = event.detail || {};
  if (productId) syncProductCardWishlist(productId, isWishlisted);
});

document.addEventListener('animationend', (event) => {
  if (event.target.matches?.('.product-card-wishlist.is-added')) {
    event.target.classList.remove('is-added');
  }
});
