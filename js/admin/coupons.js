let couponsCache = [];

function formatCouponPercent(percent) {
  return `${Number(percent).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function formatCouponDate(date) {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function setCouponFieldError(input, message) {
  const group = input.closest('.form-group');
  group.classList.toggle('has-error', Boolean(message));
  group.querySelector('.form-error').textContent = message || '';
}

function validateCouponForm(form) {
  const code = form.code.value.trim().toUpperCase();
  const rawDiscount = form.discountPercent.value.trim();
  const discountPercent = Number(rawDiscount);
  let valid = true;

  form.querySelectorAll('.form-group').forEach((group) => {
    group.classList.remove('has-error');
    const error = group.querySelector('.form-error');
    if (error) error.textContent = '';
  });

  if (!/^[A-Za-z0-9_-]{3,50}$/.test(code)) {
    setCouponFieldError(form.code, 'Use de 3 a 50 caracteres: letras, números, _ ou -');
    valid = false;
  }
  if (!rawDiscount || !Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90) {
    setCouponFieldError(form.discountPercent, 'Informe um desconto entre 1 e 90');
    valid = false;
  } else if (!/^\d+(?:[.,]\d{1,2})?$/.test(rawDiscount)) {
    setCouponFieldError(form.discountPercent, 'Use no máximo 2 casas decimais');
    valid = false;
  }

  return valid ? { code, discountPercent } : null;
}

function renderCouponsTable() {
  const tbody = document.querySelector('[data-coupons-tbody]');
  const subtitle = document.querySelector('[data-coupons-subtitle]');
  subtitle.textContent = `${couponsCache.length} cupom${couponsCache.length === 1 ? '' : 'ns'} cadastrado${couponsCache.length === 1 ? '' : 's'}`;

  if (!couponsCache.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Nenhum cupom cadastrado ainda.</div></td></tr>';
    return;
  }

  tbody.innerHTML = couponsCache.map((coupon) => {
    const id = escapeAttr(coupon.id);
    return `
      <tr>
        <td><strong>${escapeHtml(coupon.code)}</strong></td>
        <td>${formatCouponPercent(coupon.discountPercent)}</td>
        <td><span class="badge ${coupon.active ? 'badge-paid' : 'badge-cancelled'}">${coupon.active ? 'Ativo' : 'Inativo'}</span></td>
        <td>${formatCouponDate(coupon.createdAt)}</td>
        <td>
          <div class="admin-table-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-edit-coupon="${id}">Editar</button>
            <button class="btn btn-ghost btn-sm" type="button" data-toggle-coupon="${id}">${coupon.active ? 'Desativar' : 'Reativar'}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-edit-coupon]').forEach((button) => {
    button.addEventListener('click', () => openCouponModal(button.dataset.editCoupon));
  });
  tbody.querySelectorAll('[data-toggle-coupon]').forEach((button) => {
    button.addEventListener('click', () => toggleCoupon(button.dataset.toggleCoupon, button));
  });
}

function couponFormContent(coupon) {
  const content = document.createElement('form');
  content.addEventListener('submit', (event) => event.preventDefault());
  content.innerHTML = `
    <div class="form-group">
      <label for="coupon-code">Código</label>
      <input class="form-control" id="coupon-code" name="code" type="text" maxlength="50" value="${escapeAttr(coupon?.code || '')}" required />
      <p class="form-error"></p>
    </div>
    <div class="form-group">
      <label for="coupon-discount">Desconto %</label>
      <input class="form-control" id="coupon-discount" name="discountPercent" type="number" min="1" max="90" step="0.01" value="${coupon ? escapeAttr(coupon.discountPercent) : ''}" required />
      <p class="form-error"></p>
    </div>
    ${coupon ? `
      <div class="form-group coupon-active-field">
        <label><input name="active" type="checkbox" ${coupon.active ? 'checked' : ''} /> Ativo</label>
        <p class="form-error"></p>
      </div>
    ` : ''}
  `;
  content.code.addEventListener('input', () => {
    content.code.value = content.code.value.toUpperCase();
  });
  return content;
}

function openCouponModal(id = null) {
  const coupon = id ? couponsCache.find((item) => String(item.id) === String(id)) : null;
  if (id && !coupon) return;
  const form = couponFormContent(coupon);
  const modal = openModal({
    title: coupon ? 'Editar Cupom' : 'Novo Cupom',
    content: form,
    confirmLabel: coupon ? 'Salvar' : 'Criar',
    onConfirm: async () => {
      const values = validateCouponForm(form);
      if (!values) return;
      const confirmButton = modal.querySelector('[data-action="confirm"]');
      confirmButton.disabled = true;
      try {
        if (coupon) {
          await apiPut(`/coupons/${encodeURIComponent(coupon.id)}`, {
            ...values,
            active: form.active.checked,
          });
          showToast('Cupom atualizado com sucesso', 'success');
        } else {
          await apiPost('/coupons', values);
          showToast('Cupom criado com sucesso', 'success');
        }
        closeModal();
        await loadCoupons();
      } catch (error) {
        showToast(error.message || 'Não foi possível salvar o cupom', 'error');
      } finally {
        if (document.body.contains(confirmButton)) confirmButton.disabled = false;
      }
    },
  });
}

function confirmDeactivateCoupon(coupon, triggerButton) {
  const modal = openModal({
    title: 'Desativar cupom',
    content: `<p>O cupom <strong>${escapeHtml(coupon.code)}</strong> deixará de funcionar no checkout. Pedidos já feitos não são afetados.</p>`,
    confirmLabel: 'Desativar',
    onConfirm: async () => {
      const confirmButton = modal.querySelector('[data-action="confirm"]');
      confirmButton.disabled = true;
      triggerButton.disabled = true;
      try {
        await apiDelete(`/coupons/${encodeURIComponent(coupon.id)}`);
        closeModal();
        showToast('Cupom desativado com sucesso', 'success');
        await loadCoupons();
      } catch (error) {
        showToast(error.message || 'Não foi possível desativar o cupom', 'error');
      } finally {
        if (document.body.contains(confirmButton)) confirmButton.disabled = false;
        if (document.body.contains(triggerButton)) triggerButton.disabled = false;
      }
    },
  });
}

async function toggleCoupon(id, button) {
  const coupon = couponsCache.find((item) => String(item.id) === String(id));
  if (!coupon) return;
  if (coupon.active) {
    confirmDeactivateCoupon(coupon, button);
    return;
  }

  button.disabled = true;
  try {
    await apiPut(`/coupons/${encodeURIComponent(coupon.id)}`, {
      code: coupon.code,
      discountPercent: Number(coupon.discountPercent),
      active: true,
    });
    showToast('Cupom reativado com sucesso', 'success');
    await loadCoupons();
  } catch (error) {
    showToast(error.message || 'Não foi possível reativar o cupom', 'error');
  } finally {
    if (document.body.contains(button)) button.disabled = false;
  }
}

async function loadCoupons() {
  const newButton = document.querySelector('[data-new-coupon-btn]');
  newButton.disabled = true;
  document.querySelectorAll('[data-coupons-tbody] button').forEach((button) => {
    button.disabled = true;
  });
  try {
    const response = await apiGet('/coupons?page=0&size=100');
    couponsCache = response.content;
    renderCouponsTable();
  } catch (error) {
    document.querySelector('[data-coupons-tbody]').innerHTML = '<tr><td colspan="5"><div class="empty-state">Não foi possível carregar os cupons.</div></td></tr>';
    showToast(error.message || 'Erro ao carregar cupons', 'error');
  } finally {
    newButton.disabled = false;
  }
}

async function initCouponsPage() {
  if (!requireAdmin()) return;
  document.querySelector('[data-new-coupon-btn]').addEventListener('click', () => openCouponModal());
  await loadCoupons();
}

document.addEventListener('DOMContentLoaded', initCouponsPage);
