const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  CART_COUNT: 'cartCount',
};

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
    ? { id: claims.id, email: claims.sub, name: claims.name, role: claims.role }
    : null;

  if (user) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }
  return user;
}

function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

function getRefreshToken() {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

function setAccessToken(token) {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
}

function getCurrentUser() {
  const raw = localStorage.getItem(STORAGE_KEYS.USER);
  return raw ? JSON.parse(raw) : null;
}

function isAuthenticated() {
  return !!getAccessToken();
}

function isAdmin() {
  const user = getCurrentUser();
  return !!user && user.role === 'ADMIN';
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.CART_COUNT);
}

function getCartCount() {
  return Number(localStorage.getItem(STORAGE_KEYS.CART_COUNT) || 0);
}

function setCartCount(count) {
  localStorage.setItem(STORAGE_KEYS.CART_COUNT, String(count));
  document.dispatchEvent(new CustomEvent('cart-count-changed', { detail: count }));
}
