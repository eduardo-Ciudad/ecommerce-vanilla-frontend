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
      const data = await apiPost('/auth/forgot-password', { email });
      showToast(
        data?.message || 'Se este email estiver cadastrado, você receberá um link de redefinição em instantes.',
        'success'
      );
      form.reset();
    } catch (error) {
      showToast(error.message || 'Não foi possível enviar o link de redefinição', 'error');
    } finally {
      button.disabled = false;
      button.querySelector('.btn-label').textContent = 'Enviar link de redefinição';
    }
  });
}

document.addEventListener('DOMContentLoaded', initForgotPasswordPage);
