const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a20.6 20.6 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a20.6 20.6 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function wirePasswordToggles() {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const input = button.closest('.form-control-icon').querySelector('input');
    button.innerHTML = EYE_ICON;
    button.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      button.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
      button.setAttribute('aria-label', isHidden ? 'Ocultar senha' : 'Mostrar senha');
    });
  });
}

document.addEventListener('DOMContentLoaded', wirePasswordToggles);

async function login(email, password) {
  const data = await apiPost('/auth/login', { email, password });
  const user = saveSession(data);
  await syncGuestCartToServer();
  return user;
}

async function syncGuestCartToServer() {
  const items = getGuestCart();
  if (!items.length) return;

  const errors = [];
  let syncedCart = null;

  for (const item of items) {
    try {
      syncedCart = await apiPost('/cart/items', {
        variantId: item.variantId,
        quantity: item.quantity,
      });
    } catch (error) {
      errors.push(error);
    }
  }

  clearGuestCart();

  if (syncedCart) {
    setCartCount(
      syncedCart.items.reduce((total, item) => total + item.quantity, 0),
    );
  }

  if (errors.length) {
    showToast(
      `${errors.length} item(ns) do seu carrinho não puderam ser adicionados: ${errors[0].message || 'erro ao sincronizar'}`,
      'error',
    );
  }
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

  const guardedContent = document.querySelector('[data-admin-guarded]');
  if (guardedContent) {
    guardedContent.removeAttribute('hidden');
  }

  return true;
}

function isSafeRedirect(path) {
  return typeof path === 'string' && /^[a-zA-Z0-9/_-]+\.html([?#].*)?$/.test(path) && !path.startsWith('//');
}

function redirectAfterLogin(user) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');

  if (user.role === 'ADMIN') {
    window.location.href = 'admin/index.html';
    return;
  }
  const decoded = redirect ? decodeURIComponent(redirect) : null;
  window.location.href = decoded && isSafeRedirect(decoded) ? decoded : 'index.html';
}

function setFieldError(input, message) {
  const group = input.closest('.form-group');
  group.classList.toggle('has-error', !!message);
  group.querySelector('.form-error').textContent = message || '';
}

function clearFormErrors(form) {
  form.querySelectorAll('.form-group').forEach((group) => {
    group.classList.remove('has-error');
    group.querySelector('.form-error').textContent = '';
  });
}

function setFormLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = loading;
  button.querySelector('.btn-label').innerHTML = loading
    ? '<span class="spinner"></span>'
    : form.dataset.form === 'login'
      ? 'Entrar'
      : 'Criar Conta';
}

function switchAuthTab(tabName) {
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.auth-form').forEach((form) => {
    form.classList.toggle('is-active', form.dataset.form === tabName);
  });
}

function initAuthPage() {
  const loginForm = document.querySelector('[data-form="login"]');
  const registerForm = document.querySelector('[data-form="register"]');
  if (!loginForm || !registerForm) return;

  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'register') switchAuthTab('register');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(loginForm);

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    let hasError = false;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(loginForm.email, 'Informe um email válido');
      hasError = true;
    }
    if (!password) {
      setFieldError(loginForm.password, 'Informe sua senha');
      hasError = true;
    }
    if (hasError) return;

    setFormLoading(loginForm, true);
    try {
      const user = await login(email, password);
      showToast('Login realizado com sucesso!', 'success');
      redirectAfterLogin(user);
    } catch (error) {
      showToast(error.message || 'Não foi possível entrar', 'error');
    } finally {
      setFormLoading(loginForm, false);
    }
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(registerForm);

    const name = registerForm.name.value.trim();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value;
    const confirmPassword = registerForm.confirmPassword.value;
    let hasError = false;

    if (!name) {
      setFieldError(registerForm.name, 'Informe seu nome');
      hasError = true;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(registerForm.email, 'Informe um email válido');
      hasError = true;
    }
    if (password.length < 6) {
      setFieldError(registerForm.password, 'A senha deve ter no mínimo 6 caracteres');
      hasError = true;
    }
    if (confirmPassword !== password) {
      setFieldError(registerForm.confirmPassword, 'As senhas não coincidem');
      hasError = true;
    }
    if (hasError) return;

    setFormLoading(registerForm, true);
    try {
      const data = await apiPost('/auth/register', { name, email, password });
      registerForm.innerHTML = '<div class="auth-success"><p>Cadastro realizado! Enviamos um link de verificação para <strong>' + escapeHtml(email) + '</strong>. Verifique sua caixa de entrada para ativar sua conta.</p></div>';
    } catch (error) {
      showToast(error.message || 'Não foi possível criar a conta', 'error');
    } finally {
      setFormLoading(registerForm, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', initAuthPage);

function initAdminShell() {
  const sidebar = document.querySelector('[data-admin-sidebar]');
  if (!sidebar) return;

  const toggle = document.querySelector('[data-admin-menu-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
  }

  const logoutBtn = document.querySelector('[data-admin-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  sidebar.querySelectorAll('.admin-nav a').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === currentPage);
  });
}

document.addEventListener('DOMContentLoaded', initAdminShell);
