async function login(email, password) {
  const data = await apiPost('/auth/login', { email, password });
  return saveSession(data);
}

async function register(name, email, password) {
  return apiPost('/auth/register', { name, email, password });
}

function logout() {
  clearSession();
  window.location.href = `${resolveRootPath()}index.html`;
}

function requireAuth() {
  if (!isAuthenticated()) {
    const redirect = encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
    window.location.href = `${resolveRootPath()}auth.html?redirect=${redirect}`;
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!isAuthenticated() || !isAdmin()) {
    window.location.href = `${resolveRootPath()}index.html`;
    return false;
  }
  return true;
}

function redirectAfterLogin(user) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');

  if (user.role === 'ADMIN') {
    window.location.href = 'admin/index.html';
    return;
  }
  window.location.href = redirect ? decodeURIComponent(redirect) : 'index.html';
}
