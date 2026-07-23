const CONFIRM_RESULT_CONTENT = {
  success: {
    icon: ICONS.check,
    modifierClass: 'checkout-result-icon--success',
    title: 'Senha alterada com sucesso!',
  },
  error: {
    icon: ICONS.x,
    modifierClass: 'checkout-result-icon--error',
    title: 'Não foi possível confirmar',
  },
};

function getConfirmToken() {
  return new URLSearchParams(window.location.search).get('token');
}

function renderConfirmResult(type, message, showRetryLink) {
  const config = CONFIRM_RESULT_CONTENT[type];
  const actionButton = showRetryLink
    ? '<a class="btn btn-primary" href="esqueci-senha.html">Solicitar novo link</a>'
    : '<a class="btn btn-primary" href="auth.html">Ir para o login</a>';

  document.querySelector('[data-confirm-result]').innerHTML = `
    <div class="checkout-result-icon ${config.modifierClass}">${config.icon}</div>
    <h2>${config.title}</h2>
    <p>${escapeHtml(message)}</p>
    ${actionButton}
  `;
}

async function initConfirmPasswordChangePage() {
  const token = getConfirmToken();

  if (!token) {
    renderConfirmResult('error', 'Link de confirmação inválido ou ausente.', true);
    return;
  }

  try {
    const data = await apiGet(`/auth/confirm-password-change?token=${encodeURIComponent(token)}`);
    renderConfirmResult('success', data?.message || 'Sua senha foi alterada com sucesso.', false);
  } catch (error) {
    renderConfirmResult('error', error.message || 'Este link de confirmação é inválido ou já expirou.', true);
  }
}

document.addEventListener('DOMContentLoaded', initConfirmPasswordChangePage);
