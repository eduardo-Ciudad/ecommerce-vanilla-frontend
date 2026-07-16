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
