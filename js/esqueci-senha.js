const FORGOT_PASSWORD_RESEND_SECONDS = 60;

function renderForgotPasswordSent(email) {
  const root = document.querySelector('[data-forgot-root]');
  root.innerHTML = `
    <div class="auth-card-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    </div>
    <h1>Verifique seu email</h1>
    <p class="auth-card-subtitle" style="margin-bottom: 4px">Enviamos um link de redefinição para:</p>
    <p class="auth-resend-email">${escapeHtml(email)}</p>
    <div class="auth-resend-info">
      <p>Não recebeu? Verifique sua caixa de spam ou solicite um novo link em instantes.</p>
    </div>
    <div class="auth-resend-actions">
      <button type="button" class="btn btn-secondary" data-resend-button disabled></button>
      <a class="auth-back-link" href="auth.html">&larr; Voltar para o login</a>
    </div>
  `;

  wireResend(email);
}

function wireResend(email) {
  const button = document.querySelector('[data-resend-button]');
  let secondsLeft = FORGOT_PASSWORD_RESEND_SECONDS;
  let timer = null;

  function tick() {
    if (secondsLeft <= 0) {
      clearInterval(timer);
      button.disabled = false;
      button.textContent = 'Reenviar link';
      return;
    }
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    button.textContent = `Reenviar em ${minutes}:${seconds}`;
    secondsLeft -= 1;
  }

  tick();
  timer = setInterval(tick, 1000);

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await apiPost('/auth/forgot-password', { email });
      showToast('Link reenviado!', 'success');
    } catch (error) {
      showToast(error.message || 'Não foi possível reenviar o link', 'error');
    }
    secondsLeft = FORGOT_PASSWORD_RESEND_SECONDS;
    tick();
    timer = setInterval(tick, 1000);
  });
}

function initForgotPasswordPage() {
  const form = document.querySelector('[data-form="forgot-password"]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(form.email, 'Informe um email válido');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('.btn-label').innerHTML = '<span class="spinner"></span>';

    try {
      await apiPost('/auth/forgot-password', { email });
      renderForgotPasswordSent(email);
    } catch (error) {
      showToast(error.message || 'Não foi possível enviar o link de redefinição', 'error');
      button.disabled = false;
      button.querySelector('.btn-label').textContent = 'Enviar Link';
    }
  });
}

document.addEventListener('DOMContentLoaded', initForgotPasswordPage);
