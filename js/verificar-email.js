const VERIFY_EMAIL_RESULT_CONTENT = {
  success: {
    icon: ICONS.check,
    modifierClass: 'auth-card-icon--success',
    title: 'Email verificado!',
  },
  error: {
    icon: ICONS.x,
    modifierClass: 'auth-card-icon--error',
    title: 'Link expirado',
  },
};

function getVerifyEmailToken() {
  return new URLSearchParams(window.location.search).get('token');
}

function renderVerifyEmailResult(type, message, actionButton) {
  const config = VERIFY_EMAIL_RESULT_CONTENT[type];

  document.getElementById('verify-email-root').innerHTML = `
    <div class="auth-card-icon auth-card-icon--lg ${config.modifierClass}">${config.icon}</div>
    <h1>${config.title}</h1>
    <p class="auth-card-subtitle">${escapeHtml(message)}</p>
    ${actionButton}
  `;
}

function verificationResendActions() {
  const sessionEmail = getCurrentUser()?.email?.trim();
  const emailField = sessionEmail ? '' : `
    <div class="form-group">
      <label for="verification-resend-email">Email</label>
      <input
        class="form-control"
        type="email"
        id="verification-resend-email"
        name="email"
        placeholder="seu@email.com"
        required
        autocomplete="email"
      />
      <p class="form-error"></p>
    </div>
  `;

  return `
    <form data-verification-resend-form novalidate>
      ${emailField}
      <button class="btn btn-primary" type="submit">Reenviar link de verificação</button>
    </form>
    <a class="auth-back-link" href="auth.html?tab=register">Voltar para o cadastro</a>
  `;
}

function wireVerifyPageResend() {
  const form = document.querySelector('[data-verification-resend-form]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const input = form.querySelector('input[name="email"]');
    const email = getCurrentUser()?.email?.trim() || input?.value.trim() || '';
    if (input) {
      setFieldError(input, '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError(input, 'Informe um email válido');
        return;
      }
    }

    const button = form.querySelector('button[type="submit"]');
    startButtonCooldown(button, { readyLabel: 'Reenviar link de verificação' });

    try {
      const data = await apiPost('/auth/resend-verification', { email });
      showToast(data.message, 'success');
    } catch (error) {
      logAppError('verify_email.resend', error);
      showToast('Não foi possível reenviar o email de verificação. Tente novamente.', 'error');
    }
  });
}

function renderVerifyEmailError(message) {
  renderVerifyEmailResult('error', message, verificationResendActions());
  wireVerifyPageResend();
}

async function initVerifyEmailPage() {
  const token = getVerifyEmailToken();

  if (!token) {
    renderVerifyEmailError('Link inválido');
    return;
  }

  try {
    const data = await apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'GET' });
    saveSession(data);
    renderVerifyEmailResult('success', 'Email verificado com sucesso!', '<a class="btn btn-primary" href="index.html">Ir para a loja</a>');
  } catch (error) {
    renderVerifyEmailError(error.message || 'Este link de verificação é inválido ou já expirou.');
  }
}

document.addEventListener('DOMContentLoaded', initVerifyEmailPage);
