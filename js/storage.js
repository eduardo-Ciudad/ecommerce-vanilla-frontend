const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  CART_COUNT: 'cartCount',
};

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage indisponivel: a sessao continua sendo tratada como ausente.
  }
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function saveSession({ accessToken, refreshToken }) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);

  const claims = decodeJwt(accessToken);
  const user = claims
    ? { id: claims.id, email: claims.sub, name: claims.name, role: claims.role, emailVerified: claims.emailVerified }
    : null;

  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
  return user;
}

function getAccessToken() {
  return readStorage(STORAGE_KEYS.ACCESS_TOKEN);
}

function getRefreshToken() {
  return readStorage(STORAGE_KEYS.REFRESH_TOKEN);
}

function setAccessToken(token) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
}

function getCurrentUser() {
  const raw = readStorage(STORAGE_KEYS.USER);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    clearAuthenticationData();
    return null;
  }
}

function isAuthenticated() {
  return !!getAccessToken() && !!getCurrentUser();
}

function isAdmin() {
  const user = getCurrentUser();
  return !!user && user.role === 'ADMIN';
}

function clearAuthenticationData() {
  [STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.REFRESH_TOKEN, STORAGE_KEYS.USER].forEach(removeStorage);
}

function clearSession() {
  clearAuthenticationData();
  removeStorage(STORAGE_KEYS.CART_COUNT);
}

function getCartCount() {
  return Number(localStorage.getItem(STORAGE_KEYS.CART_COUNT) || 0);
}

function setCartCount(count) {
  localStorage.setItem(STORAGE_KEYS.CART_COUNT, String(count));
  document.dispatchEvent(new CustomEvent('cart-count-changed', { detail: count }));
}
