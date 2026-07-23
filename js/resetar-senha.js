function getResetToken() {
  return new URLSearchParams(window.location.search).get('token');
}

function renderInvalidResetTokenState() {
  document.querySelector('[data-reset-root]').innerHTML = `
    <div class="empty-state empty-state--inline">
      <div class="empty-state-icon">${ICONS.frown}</div>
      <p>Este link de redefinição é inválido ou já expirou.</p>
      <a class="btn btn-primary" href="esqueci-senha.html">Solicitar novo link</a>
    </div>
  `;
}

function initResetPasswordPage() {
  const token = getResetToken();
  if (!token) {
    renderInvalidResetTokenState();
    return;
  }

  const form = document.querySelector('[data-form="reset-password"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);

    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;
    let hasError = false;

    if (newPassword.length < 6) {
      setFieldError(form.newPassword, 'A senha deve ter no mínimo 6 caracteres');
      hasError = true;
    }
    if (confirmPassword !== newPassword) {
      setFieldError(form.confirmPassword, 'As senhas não coincidem');
      hasError = true;
    }
    if (hasError) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('.btn-label').innerHTML = '<span class="spinner"></span>';

    try {
      const data = await apiPost('/auth/reset-password', { token, newPassword });
      showToast(data?.message || 'Senha redefinida com sucesso!', 'success');
      form.reset();
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 2000);
    } catch (error) {
      if (error.status === 422) {
        showToast(error.message || 'Link inválido ou expirado', 'error');
        renderInvalidResetTokenState();
        return;
      }
      showToast(error.message || 'Não foi possível redefinir sua senha', 'error');
      button.disabled = false;
      button.querySelector('.btn-label').textContent = 'Redefinir senha';
    }
  });
}

document.addEventListener('DOMContentLoaded', initResetPasswordPage);
