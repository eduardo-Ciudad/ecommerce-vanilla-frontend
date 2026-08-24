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

async function initVerifyEmailPage() {
  const token = getVerifyEmailToken();

  if (!token) {
    renderVerifyEmailResult('error', 'Link inválido', '<a class="btn btn-primary" href="auth.html?tab=register">Voltar para o cadastro</a>');
    return;
  }

  try {
    const data = await apiFetch(`/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'GET' });
    saveSession(data);
    renderVerifyEmailResult('success', 'Email verificado com sucesso!', '<a class="btn btn-primary" href="index.html">Ir para a loja</a>');
  } catch (error) {
    renderVerifyEmailResult('error', error.message || 'Este link de verificação é inválido ou já expirou.', '<a class="btn btn-primary" href="auth.html?tab=register">Voltar para o cadastro</a>');
  }
}

document.addEventListener('DOMContentLoaded', initVerifyEmailPage);
