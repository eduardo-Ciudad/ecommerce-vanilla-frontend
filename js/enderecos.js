let currentAddresses = [];

function formatCep(cep) {
  const digits = String(cep || '').replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : cep;
}

function formatAddressLine(address) {
  const complement = address.complement ? `, ${address.complement}` : '';
  return `${address.street}, ${address.number}${complement} — ${address.neighborhood}, ${address.city}/${address.state} — CEP ${formatCep(address.cep)}`;
}

function renderEmptyAddresses() {
  document.getElementById('addresses-root').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${ICONS.package}</div>
      <p>Você ainda não cadastrou nenhum endereço.</p>
    </div>
  `;
}

function renderAddressCard(address) {
  const badge = address.isDefault ? '<span class="badge badge-active">Padrão</span>' : '';

  return `
    <li class="order-card fade-in" data-address-id="${address.id}">
      <div class="order-card-header">
        <div class="order-card-main">
          <span class="order-card-number">${escapeHtml(address.label)}</span>
          <span class="order-card-date">${escapeHtml(formatAddressLine(address))}</span>
        </div>
        <div class="order-card-badges">
          ${badge}
        </div>
      </div>
      <div class="order-card-pay-row" style="display:flex;gap:var(--space-sm);">
        <button class="btn btn-secondary btn-sm" type="button" data-edit-address>Editar</button>
        <button class="btn btn-ghost btn-sm" type="button" data-delete-address>Excluir</button>
      </div>
    </li>
  `;
}

function renderAddresses() {
  const root = document.getElementById('addresses-root');
  if (!currentAddresses.length) {
    renderEmptyAddresses();
    return;
  }
  root.innerHTML = `<ul class="orders-list stagger-fade">${currentAddresses.map(renderAddressCard).join('')}</ul>`;
  wireAddressCardEvents();
}

function wireAddressCardEvents() {
  document.querySelectorAll('[data-address-id]').forEach((card) => {
    const id = card.dataset.addressId;
    const address = currentAddresses.find((a) => a.id === id);
    card.querySelector('[data-edit-address]').addEventListener('click', () => openAddressModal(address));
    card.querySelector('[data-delete-address]').addEventListener('click', () => handleDeleteAddress(id));
  });
}

async function loadAddresses() {
  const root = document.getElementById('addresses-root');
  try {
    currentAddresses = await apiGet('/addresses');
    renderAddresses();
  } catch (error) {
    root.innerHTML = '<p class="empty-state">Não foi possível carregar seus endereços.</p>';
    showToast(error.message || 'Erro ao carregar endereços', 'error');
  }
}

function addressFormMarkup(address) {
  const a = address || {};
  return `
    <form data-form="address">
      <div class="form-group">
        <label for="address-label">Nome do endereço</label>
        <input class="form-control" id="address-label" name="label" placeholder="Casa, Trabalho..." value="${escapeHtml(a.label || '')}" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="address-cep">CEP</label>
        <input class="form-control" id="address-cep" name="cep" placeholder="00000-000" value="${escapeHtml(a.cep || '')}" maxlength="9" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="address-street">Rua</label>
        <input class="form-control" id="address-street" name="street" value="${escapeHtml(a.street || '')}" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="address-number">Número</label>
        <input class="form-control" id="address-number" name="number" value="${escapeHtml(a.number || '')}" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="address-complement">Complemento</label>
        <input class="form-control" id="address-complement" name="complement" value="${escapeHtml(a.complement || '')}" />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="address-neighborhood">Bairro</label>
        <input class="form-control" id="address-neighborhood" name="neighborhood" value="${escapeHtml(a.neighborhood || '')}" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="address-city">Cidade</label>
        <input class="form-control" id="address-city" name="city" value="${escapeHtml(a.city || '')}" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="address-state">Estado</label>
        <input class="form-control" id="address-state" name="state" placeholder="UF" maxlength="2" value="${escapeHtml(a.state || '')}" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group form-group--tight">
        <label>
          <input type="checkbox" name="isDefault" ${a.isDefault ? 'checked' : ''} /> Definir como padrão
        </label>
        <p class="form-error"></p>
      </div>
    </form>
  `;
}

function clearAddressFormErrors(form) {
  form.querySelectorAll('.form-group').forEach((group) => {
    group.classList.remove('has-error');
    const errorEl = group.querySelector('.form-error');
    if (errorEl) errorEl.textContent = '';
  });
}

async function handleCepLookup(modal) {
  const cepInput = modal.querySelector('[name="cep"]');
  const digits = cepInput.value.replace(/\D/g, '');
  if (digits.length !== 8) return;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await response.json();
    if (data.erro) return;
    modal.querySelector('[name="street"]').value = data.logradouro || '';
    modal.querySelector('[name="neighborhood"]').value = data.bairro || '';
    modal.querySelector('[name="city"]').value = data.localidade || '';
    modal.querySelector('[name="state"]').value = data.uf || '';
  } catch (error) {
    logAppError('addresses.cep_lookup', error, {
      code: 'VIACEP_LOOKUP_FAILED',
      provider: 'ViaCEP',
    });
  }
}

async function submitAddressForm(addressId) {
  const form = document.querySelector('.modal [data-form="address"]');
  clearAddressFormErrors(form);

  const body = {
    label: form.label.value.trim(),
    cep: form.cep.value.replace(/\D/g, ''),
    street: form.street.value.trim(),
    number: form.number.value.trim(),
    complement: form.complement.value.trim(),
    neighborhood: form.neighborhood.value.trim(),
    city: form.city.value.trim(),
    state: form.state.value.trim(),
    isDefault: form.isDefault.checked,
  };

  let hasError = false;
  if (!body.label) {
    setFieldError(form.label, 'Informe um nome para o endereço');
    hasError = true;
  }
  if (body.cep.length !== 8) {
    setFieldError(form.cep, 'Informe um CEP válido');
    hasError = true;
  }
  if (!body.street) {
    setFieldError(form.street, 'Informe a rua');
    hasError = true;
  }
  if (!body.number) {
    setFieldError(form.number, 'Informe o número');
    hasError = true;
  }
  if (!body.neighborhood) {
    setFieldError(form.neighborhood, 'Informe o bairro');
    hasError = true;
  }
  if (!body.city) {
    setFieldError(form.city, 'Informe a cidade');
    hasError = true;
  }
  if (!body.state) {
    setFieldError(form.state, 'Informe o estado');
    hasError = true;
  }
  if (hasError) return;

  try {
    if (addressId) {
      await apiPut(`/addresses/${addressId}`, body);
      showToast('Endereço atualizado com sucesso!', 'success');
    } else {
      await apiPost('/addresses', body);
      showToast('Endereço adicionado com sucesso!', 'success');
    }
    closeModal();
    loadAddresses();
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar o endereço', 'error');
  }
}

function openAddressModal(address) {
  const modal = openModal({
    title: address ? 'Editar endereço' : 'Adicionar endereço',
    content: addressFormMarkup(address),
    confirmLabel: 'Salvar',
    onConfirm: () => submitAddressForm(address?.id),
  });

  modal.querySelector('[name="cep"]').addEventListener('input', () => handleCepLookup(modal));
}

async function handleDeleteAddress(id) {
  if (!confirm('Tem certeza que deseja excluir este endereço?')) return;

  try {
    await apiDelete(`/addresses/${id}`);
    showToast('Endereço excluído com sucesso!', 'success');
    loadAddresses();
  } catch (error) {
    showToast(error.message || 'Não foi possível excluir o endereço', 'error');
  }
}

async function initAddressesPage() {
  if (!requireAuth()) return;

  document.querySelector('[data-add-address-btn]').addEventListener('click', () => openAddressModal(null));
  loadAddresses();
}

document.addEventListener('DOMContentLoaded', initAddressesPage);
