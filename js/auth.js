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
      await register(name, email, password);
      showToast('Conta criada! Agora é só entrar.', 'success');
      registerForm.reset();
      switchAuthTab('login');
      document.getElementById('login-email').value = email;
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
