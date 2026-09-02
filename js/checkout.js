const STATUS_DETAIL_MESSAGES = {
  accredited: 'Pagamento aprovado!',
  pending_contingency: 'Pagamento em processamento.',
  pending_review_manual: 'Pagamento em análise.',
  cc_rejected_bad_filled_card_number: 'Número do cartão incorreto.',
  cc_rejected_bad_filled_date: 'Data de validade incorreta.',
  cc_rejected_bad_filled_other: 'Dados do cartão incorretos.',
  cc_rejected_bad_filled_security_code: 'CVV incorreto.',
  cc_rejected_blacklist: 'Cartão não autorizado.',
  cc_rejected_call_for_authorize: 'Cartão requer autorização do banco.',
  cc_rejected_card_disabled: 'Cartão desabilitado.',
  cc_rejected_duplicated_payment: 'Pagamento duplicado.',
  cc_rejected_high_risk: 'Pagamento recusado por segurança.',
  cc_rejected_insufficient_amount: 'Saldo insuficiente.',
  cc_rejected_max_attempts: 'Limite de tentativas excedido.',
  cc_rejected_other_reason: 'Pagamento recusado.',
};

const PAYMENT_RESULT_CONTENT = {
  approved: {
    icon: ICONS.check,
    modifierClass: 'checkout-result-icon--success',
    title: 'Pagamento aprovado!',
    message: 'Seu pedido foi confirmado.',
  },
  rejected: {
    icon: ICONS.x,
    modifierClass: 'checkout-result-icon--error',
    title: 'Pagamento recusado',
    message: 'Não foi possível processar o pagamento.',
  },
  pending: {
    icon: ICONS.clock,
    modifierClass: 'checkout-result-icon--pending',
    title: 'Pagamento em processamento',
    message: 'Você receberá a confirmação em breve.',
  },
  in_process: {
    icon: ICONS.clock,
    modifierClass: 'checkout-result-icon--pending',
    title: 'Pagamento em processamento',
    message: 'Você receberá a confirmação em breve.',
  },
};

const PIX_POLL_DELAY_MS = 5000;
const PIX_POLL_MAX_DURATION_MS = 5 * 60 * 1000;
const PIX_POLL_MAX_CONSECUTIVE_FAILURES = 5;

let pixPollTimeout = null;
let pixPollAbortController = null;
let pixPollSession = 0;
let selectedAddressId = null;
let selectedShippingMethod = null;
let selectedShippingPrice = 0;

function getOrderId() {
  return new URLSearchParams(window.location.search).get('orderId');
}

function renderCheckoutError(message) {
  document.querySelector('[data-checkout-root]').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${ICONS.frown}</div>
      <p>${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="cart.html">Voltar ao carrinho</a>
    </div>
  `;
}

function checkoutItemRow(item) {
  return `
    <li class="checkout-summary-item">
      <span>${escapeHtml(item.productName)} (${escapeHtml(item.size)}) x${item.quantity}</span>
      <span>${formatPrice(item.unitPrice * item.quantity)}</span>
    </li>
  `;
}

function formatAddressSummary(address) {
  const complement = address.complement ? `, ${escapeHtml(address.complement)}` : '';
  return `${escapeHtml(address.street)}, ${escapeHtml(address.number)}${complement} — ${escapeHtml(address.neighborhood)}, ${escapeHtml(address.city)}/${escapeHtml(address.state)}`;
}

function addressRadioRow(address, isSelected) {
  return `
    <li class="checkout-summary-item">
      <label style="display:flex;align-items:center;gap:var(--space-sm);cursor:pointer;">
        <input type="radio" name="selectedAddress" value="${address.id}" ${isSelected ? 'checked' : ''} />
        <span>${escapeHtml(address.label)} — ${formatAddressSummary(address)}</span>
      </label>
    </li>
  `;
}

function shippingOptionRow(option, isSelected) {
  return `
    <li class="checkout-summary-item">
      <label style="display:flex;align-items:center;gap:var(--space-sm);cursor:pointer;">
        <input type="radio" name="selectedShipping" value="${escapeHtml(option.method)}" ${isSelected ? 'checked' : ''} />
        <span>${escapeHtml(option.methodLabel)} — até ${option.deadlineDays} dias úteis</span>
      </label>
      <span>${formatPrice(option.price)}</span>
    </li>
  `;
}

function addressInlineFormMarkup() {
  return `
    <form class="checkout-address-form" data-form="checkout-address">
      <div class="form-group">
        <label for="checkout-address-label">Nome do endereço</label>
        <input class="form-control" id="checkout-address-label" name="label" placeholder="Casa, Trabalho..." required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="checkout-address-cep">CEP</label>
        <input class="form-control" id="checkout-address-cep" name="cep" placeholder="00000-000" maxlength="9" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="checkout-address-street">Rua</label>
        <input class="form-control" id="checkout-address-street" name="street" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="checkout-address-number">Número</label>
        <input class="form-control" id="checkout-address-number" name="number" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="checkout-address-complement">Complemento</label>
        <input class="form-control" id="checkout-address-complement" name="complement" />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="checkout-address-neighborhood">Bairro</label>
        <input class="form-control" id="checkout-address-neighborhood" name="neighborhood" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="checkout-address-city">Cidade</label>
        <input class="form-control" id="checkout-address-city" name="city" required />
        <p class="form-error"></p>
      </div>
      <div class="form-group">
        <label for="checkout-address-state">Estado</label>
        <input class="form-control" id="checkout-address-state" name="state" placeholder="UF" maxlength="2" required />
        <p class="form-error"></p>
      </div>
      <button class="btn btn-primary" type="submit">
        <span class="btn-label">Salvar endereço</span>
      </button>
    </form>
  `;
}

function clearCheckoutAddressFormErrors(form) {
  form.querySelectorAll('.form-group').forEach((group) => {
    group.classList.remove('has-error');
    const errorEl = group.querySelector('.form-error');
    if (errorEl) errorEl.textContent = '';
  });
}

async function handleCheckoutCepLookup(form) {
  const digits = form.cep.value.replace(/\D/g, '');
  if (digits.length !== 8) return;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await response.json();
    if (data.erro) return;
    form.street.value = data.logradouro || '';
    form.neighborhood.value = data.bairro || '';
    form.city.value = data.localidade || '';
    form.state.value = data.uf || '';
  } catch (error) {
    logAppError('checkout.cep_lookup', error, {
      code: 'VIACEP_LOOKUP_FAILED',
      provider: 'ViaCEP',
    });
  }
}

function addressesWithSavedAddress(addresses, savedAddress) {
  return [
    ...addresses.filter(
      (address) => String(address.id) !== String(savedAddress.id),
    ),
    savedAddress,
  ];
}

async function refreshAddressesAfterSave(orderRef, addresses, savedAddress) {
  try {
    const updated = await apiGet('/addresses');
    renderAddressContent(orderRef, updated);
  } catch (error) {
    // O endereço foi salvo; mantém a UI utilizável com a resposta do POST.
    renderAddressContent(
      orderRef,
      addressesWithSavedAddress(addresses, savedAddress),
    );
    throw error;
  }
}

function wireAddressInlineForm(form, hasExistingAddresses, onSaved) {
  form.cep.addEventListener('input', () => handleCheckoutCepLookup(form));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearCheckoutAddressFormErrors(form);

    const body = {
      label: form.label.value.trim(),
      cep: form.cep.value.replace(/\D/g, ''),
      street: form.street.value.trim(),
      number: form.number.value.trim(),
      complement: form.complement.value.trim(),
      neighborhood: form.neighborhood.value.trim(),
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      isDefault: !hasExistingAddresses,
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

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('.btn-label').innerHTML = '<span class="spinner"></span>';

    try {
      let address;

      try {
        address = await apiPost('/addresses', body);
      } catch (error) {
        showToast(error.message || 'Não foi possível salvar o endereço', 'error');
        return;
      }

      showToast('Endereço adicionado com sucesso!', 'success');

      try {
        await onSaved(address);
      } catch (error) {
        logAppError('checkout.addresses.refresh', error);
        showToast(
          'O endereço foi salvo, mas a lista não pôde ser atualizada. Exibimos os dados salvos para você continuar.',
          'warning',
        );
      }
    } finally {
      button.disabled = false;
      button.querySelector('.btn-label').textContent = 'Salvar endereço';
    }
  });
}

function addressListMarkup(addresses) {
  return `<ul class="checkout-summary-items" data-address-list>${addresses.map((a, i) => addressRadioRow(a, a.isDefault || (!addresses.some((x) => x.isDefault) && i === 0))).join('')}</ul>`;
}

function renderAddressContent(orderRef, addresses) {
  const content = document.querySelector('[data-address-content]');

  if (!addresses.length) {
    content.innerHTML = `
      <p class="pix-intro">Cadastre um endereço de entrega para continuar.</p>
      ${addressInlineFormMarkup()}
    `;
    const form = content.querySelector('[data-form="checkout-address"]');
    wireAddressInlineForm(
      form,
      false,
      (address) => refreshAddressesAfterSave(orderRef, [], address),
    );
    return;
  }

  content.innerHTML = `
    ${addressListMarkup(addresses)}
    <button class="btn btn-ghost btn-sm" type="button" data-toggle-new-address>+ Adicionar novo endereço</button>
    <div data-new-address-form hidden></div>
    <div data-shipping-options></div>
  `;

  content.querySelector('[data-toggle-new-address]').addEventListener('click', () => {
    const container = content.querySelector('[data-new-address-form]');
    if (!container.hidden) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    container.hidden = false;
    container.innerHTML = addressInlineFormMarkup();
    const form = container.querySelector('[data-form="checkout-address"]');
    wireAddressInlineForm(
      form,
      true,
      (address) => refreshAddressesAfterSave(
        orderRef,
        addresses,
        address,
      ),
    );
  });

  wireAddressSelection(orderRef, addresses);
}

function togglePaymentSection(show) {
  const payment = document.querySelector('[data-checkout-payment]');
  if (payment) payment.hidden = !show;
  const continueBtn = document.querySelector('[data-continue-btn]');
  if (continueBtn) continueBtn.disabled = !show;
}

function updateCheckoutTotal(order) {
  const totalEl = document.querySelector('[data-checkout-total]');
  const shippingRow = document.querySelector('[data-shipping-row]');
  const shippingPriceEl = document.querySelector('[data-shipping-price]');
  if (!totalEl) return;

  if (selectedShippingMethod) {
    shippingRow.hidden = false;
    shippingPriceEl.textContent = formatPrice(selectedShippingPrice);
    totalEl.textContent = formatPrice(Number(order.total) + selectedShippingPrice);
  } else {
    shippingRow.hidden = true;
    totalEl.textContent = formatPrice(order.total);
  }
}

async function loadShippingOptions(order, cep) {
  const container = document.querySelector('[data-shipping-options]');

  selectedShippingMethod = null;
  selectedShippingPrice = 0;
  togglePaymentSection(false);
  updateCheckoutTotal(order);
  container.innerHTML = '<p class="pix-status"><span class="spinner"></span> Calculando frete...</p>';

  try {
    const options = await apiGet(`/shipping/calculate?cep=${encodeURIComponent(cep)}`);
    if (!options.length) {
      container.innerHTML = '<p class="empty-state empty-state--inline">Não foi possível calcular o frete para este CEP.</p>';
      return;
    }

    container.innerHTML = `<ul class="checkout-summary-items" data-shipping-list>${options.map((o, i) => shippingOptionRow(o, i === 0)).join('')}</ul>`;
    selectedShippingMethod = options[0].method;
    selectedShippingPrice = Number(options[0].price);
    updateCheckoutTotal(order);
    togglePaymentSection(true);

    container.querySelectorAll('[name="selectedShipping"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const option = options.find((o) => o.method === radio.value);
        selectedShippingMethod = option.method;
        selectedShippingPrice = Number(option.price);
        updateCheckoutTotal(order);
      });
    });
  } catch (error) {
    container.innerHTML = '<p class="empty-state empty-state--inline">Não foi possível calcular o frete para este CEP.</p>';
    showToast(error.message || 'Erro ao calcular frete', 'error');
  }
}

function wireAddressSelection(order, addresses) {
  const initiallySelected = addresses.find((a) => a.isDefault) || addresses[0];
  selectedAddressId = initiallySelected.id;

  document.querySelectorAll('[name="selectedAddress"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      selectedAddressId = radio.value;
      const address = addresses.find((a) => a.id === radio.value);
      loadShippingOptions(order, address.cep);
    });
  });

  loadShippingOptions(order, initiallySelected.cep);
}

function formatOrderDeliveryAddress(order) {
  const complement = order.recipientComplement
    ? `, ${escapeHtml(order.recipientComplement)}`
    : '';

  return `${escapeHtml(order.recipientStreet)}, ${escapeHtml(order.recipientNumber)}${complement} — ${escapeHtml(order.recipientNeighborhood)}, ${escapeHtml(order.recipientCity)}/${escapeHtml(order.recipientState)} — CEP ${escapeHtml(order.recipientCep)}`;
}

function renderCheckout(order) {
  const root = document.querySelector('[data-checkout-root]');
  root.innerHTML = `
    <div class="checkout-layout fade-in">
      <section class="checkout-summary">
        <h2>Resumo do Pedido</h2>
        <ul class="checkout-summary-items">
          ${order.items.map(checkoutItemRow).join('')}
        </ul>
        <div class="checkout-summary-item">
          <span>Frete — ${escapeHtml(order.shippingMethod)} (até ${order.shippingDeadlineDays} dias úteis)</span>
          <span>${formatPrice(order.shippingPrice)}</span>
        </div>
        <div class="checkout-summary-total">
          <span>Total</span>
          <span>${formatPrice(order.total)}</span>
        </div>
      </section>

      <section class="checkout-summary">
        <h2>Endereço de entrega</h2>
        <p class="pix-intro">${escapeHtml(order.recipientName)} — ${formatOrderDeliveryAddress(order)}</p>
      </section>

      <section class="checkout-payment" data-checkout-payment>
        <div class="payment-tabs">
          <button class="payment-tab is-active" type="button" data-payment-tab="card"><span class="payment-tab-icon">${ICONS.creditCard}</span> Cartão de Crédito</button>
          <button class="payment-tab" type="button" data-payment-tab="pix"><span class="payment-tab-icon">${ICONS.smartphone}</span> Pix</button>
        </div>

        <div class="payment-panel is-active" data-payment-panel="card">
          <div id="mp-card-form"></div>
        </div>

        <div class="payment-panel" data-payment-panel="pix">
          <div data-pix-content>
            <p class="pix-intro">Pague instantaneamente escaneando o QR Code ou copiando o código Pix.</p>
            <button class="btn btn-primary btn-block" type="button" data-pix-btn>Gerar Pix de ${formatPrice(order.total)}</button>
          </div>
        </div>
      </section>

      <section class="checkout-result" data-checkout-result hidden></section>
    </div>
  `;

  wirePaymentTabs();
  document.querySelector('[data-pix-btn]').addEventListener('click', () => handlePixPayment(order));
  initCardForm(order);
}

function cartItemsTotal(cart) {
  return cart.items.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
}

function cartItemRow(item) {
  return `
    <li class="checkout-summary-item">
      <span>${escapeHtml(item.productName)} (${escapeHtml(item.size)}) x${item.quantity}</span>
      <span>${formatPrice(item.price * item.quantity)}</span>
    </li>
  `;
}

function renderCheckoutFromCart(cart, addresses) {
  const root = document.querySelector('[data-checkout-root]');
  const pseudoOrder = { total: cartItemsTotal(cart) };

  root.innerHTML = `
    <div class="checkout-layout fade-in">
      <section class="checkout-summary">
        <h2>Resumo do Pedido</h2>
        <ul class="checkout-summary-items">
          ${cart.items.map(cartItemRow).join('')}
        </ul>
        <div class="checkout-summary-item" data-shipping-row hidden>
          <span>Frete</span>
          <span data-shipping-price></span>
        </div>
        <div class="checkout-summary-total">
          <span>Total</span>
          <span data-checkout-total>${formatPrice(pseudoOrder.total)}</span>
        </div>
      </section>

      <section class="checkout-summary" data-checkout-address>
        <h2>Endereço de entrega</h2>
        <div data-address-content></div>
      </section>

      <button class="btn btn-primary btn-block" type="button" data-continue-btn disabled>Continuar para pagamento</button>
    </div>
  `;

  renderAddressContent(pseudoOrder, addresses);
  document.querySelector('[data-continue-btn]').addEventListener('click', () => createOrderAndProceed());
}

async function createOrderAndProceed() {
  if (!selectedAddressId || !selectedShippingMethod) {
    showToast('Selecione um endereço e um frete para continuar', 'error');
    return;
  }

  const button = document.querySelector('[data-continue-btn]');
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>';

  try {
    const order = await apiPost('/orders', { addressId: selectedAddressId, shippingMethod: selectedShippingMethod });
    setCartCount(0);
    renderCheckout(order);
  } catch (error) {
    showToast(error.message || 'Não foi possível finalizar o pedido', 'error');
    button.disabled = false;
    button.textContent = 'Continuar para pagamento';
  }
}

function wirePaymentTabs() {
  document.querySelectorAll('[data-payment-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.paymentTab;
      document.querySelectorAll('[data-payment-tab]').forEach((t) => t.classList.toggle('is-active', t === tab));
      document.querySelectorAll('[data-payment-panel]').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.paymentPanel === target);
      });
    });
  });
}

class MercadoPagoInitializationError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = 'MercadoPagoInitializationError';
    this.code = code;
    this.cause = cause;
  }
}

function getMercadoPagoPublicKey() {
  if (typeof MP_PUBLIC_KEY === 'undefined') {
    throw new MercadoPagoInitializationError(
      'MP_CONFIG_MISSING',
      'config.js não definiu MP_PUBLIC_KEY',
    );
  }

  if (
    typeof MP_PUBLIC_KEY !== 'string'
    || !MP_PUBLIC_KEY.trim()
    || ['TEST-sua-chave-publica-aqui', 'YOUR_PUBLIC_KEY', 'REPLACE_ME'].includes(MP_PUBLIC_KEY)
  ) {
    throw new MercadoPagoInitializationError(
      'MP_CONFIG_INVALID',
      'MP_PUBLIC_KEY está vazia ou contém um valor de exemplo',
    );
  }

  return MP_PUBLIC_KEY;
}

function mercadoPagoBrickError(brickError) {
  const cause = typeof brickError?.cause === 'string'
    ? brickError.cause
    : 'unknown';
  const normalizedCause = cause
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

  return new MercadoPagoInitializationError(
    `MP_BRICK_${normalizedCause}`,
    brickError?.message || 'O CardPayment Brick reportou um erro',
    brickError,
  );
}

function logMercadoPagoError(error) {
  logAppError('checkout.mercado_pago', error, {
    code: 'MP_INITIALIZATION_FAILED',
    cause: error.cause || error,
  });
}

function showFatalCardFormError(error) {
  logMercadoPagoError(error);

  const container = document.getElementById('mp-card-form');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state empty-state--inline">
      Não foi possível disponibilizar o pagamento por cartão.
      Tente novamente ou escolha Pix.
    </div>
  `;
}

function handleCardBrickError(brickError) {
  const error = mercadoPagoBrickError(brickError);

  if (brickError?.type === 'critical') {
    showFatalCardFormError(error);
    return;
  }

  logMercadoPagoError(error);
  showToast(
    'O formulário de cartão encontrou uma instabilidade. Revise os dados e tente novamente.',
    'error',
  );
}

// O CardPayment Brick já renderiza seu próprio botão "Pagar" com o valor
// formatado, então não adicionamos um botão de submit manual abaixo dele.
async function initCardForm(order) {
  try {
    const publicKey = getMercadoPagoPublicKey();

    if (typeof MercadoPago === 'undefined') {
      throw new MercadoPagoInitializationError(
        'MP_SDK_UNAVAILABLE',
        'O SDK do Mercado Pago não foi carregado',
      );
    }

    let mp;
    try {
      mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
    } catch (error) {
      throw new MercadoPagoInitializationError(
        'MP_SDK_CONSTRUCTION_FAILED',
        'Falha ao construir o SDK do Mercado Pago',
        error,
      );
    }

    let bricksBuilder;
    try {
      bricksBuilder = mp.bricks();
    } catch (error) {
      throw new MercadoPagoInitializationError(
        'MP_BRICKS_BUILDER_FAILED',
        'Falha ao inicializar o Bricks Builder',
        error,
      );
    }

    try {
      await bricksBuilder.create('cardPayment', 'mp-card-form', {
        initialization: {
          amount: Number(order.total),
        },
        customization: {
          visual: {
            style: {
              theme: 'default',
            },
          },
          paymentMethods: {
            maxInstallments: 6,
          },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async (cardFormData) => {
            try {
              const result = await apiPost('/payments/process', {
                orderId: order.id,
                paymentMethod: 'credit_card',
                token: cardFormData.token,
                installments: cardFormData.installments,
                cardIssuerId: cardFormData.payment_method_id,
              });
              showPaymentResult(result);
            } catch (error) {
              showToast(error.message || 'Erro ao processar pagamento', 'error');
            }
          },
          onError: handleCardBrickError,
        },
      });
    } catch (error) {
      throw new MercadoPagoInitializationError(
        'MP_BRICK_CREATION_FAILED',
        'Falha ao criar o CardPayment Brick',
        error,
      );
    }
  } catch (error) {
    showFatalCardFormError(error);
  }
}

async function handlePixPayment(order) {
  const pixBtn = document.querySelector('[data-pix-btn]');
  pixBtn.disabled = true;
  pixBtn.innerHTML = '<span class="spinner"></span> Gerando Pix...';

  try {
    const result = await apiPost('/payments/process', {
      orderId: order.id,
      paymentMethod: 'pix',
    });

    if (result.status === 'approved') {
      showPaymentResult(result);
    } else if (result.pixQrCodeBase64) {
      renderPixResult(result, order);
    } else {
      showToast('Não foi possível gerar o Pix', 'error');
      pixBtn.disabled = false;
      pixBtn.textContent = `Gerar Pix de ${formatPrice(order.total)}`;
    }
  } catch (error) {
    showToast(error.message || 'Erro ao gerar Pix', 'error');
    pixBtn.disabled = false;
    pixBtn.textContent = `Gerar Pix de ${formatPrice(order.total)}`;
  }
}

function renderPixResult(result, order) {
  const pixContent = document.querySelector('[data-pix-content]');
  pixContent.innerHTML = `
    <p class="pix-status"><span class="spinner"></span> Pix gerado! Escaneie o QR Code ou copie o código. Aguardando confirmação...</p>
    <img class="pix-qr-image" src="data:image/png;base64,${result.pixQrCodeBase64}" alt="QR Code Pix" />
    <div class="pix-copy-row">
      <input class="form-control" type="text" readonly value="${escapeHtml(result.pixQrCode || '')}" data-pix-code />
      <button class="btn btn-secondary" type="button" data-copy-pix>Copiar código</button>
    </div>
  `;

  pixContent.querySelector('[data-copy-pix]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(result.pixQrCode || '');
      showToast('Código Pix copiado!', 'success');
    } catch {
      showToast('Não foi possível copiar o código', 'error');
    }
  });

  startPixPolling(order.id);
}

function stopPixPolling() {
  pixPollSession += 1;

  if (pixPollTimeout) {
    clearTimeout(pixPollTimeout);
    pixPollTimeout = null;
  }

  if (pixPollAbortController) {
    pixPollAbortController.abort();
    pixPollAbortController = null;
  }
}

function renderPixPollingRecovery(message) {
  stopPixPolling();

  const pixContent = document.querySelector('[data-pix-content]');
  if (!pixContent) return;

  pixContent.innerHTML = `
    <div class="empty-state empty-state--inline">
      <p>${escapeHtml(message)}</p>
      <p>
        O pagamento ainda pode ser confirmado posteriormente.
        Consulte o pedido antes de iniciar uma nova tentativa.
      </p>
      <a class="btn btn-primary" href="orders.html">Ver meus pedidos</a>
    </div>
  `;
}

function logPixPollingError(error, consecutiveFailures) {
  logAppError('checkout.pix.polling', error, {
    code: 'PIX_POLL_NETWORK_ERROR',
    consecutiveFailures,
  });
}

function startPixPolling(orderId) {
  stopPixPolling();

  const session = pixPollSession;
  const deadline = Date.now() + PIX_POLL_MAX_DURATION_MS;
  let consecutiveFailures = 0;

  const poll = async () => {
    if (session !== pixPollSession) return;

    if (Date.now() >= deadline) {
      renderPixPollingRecovery(
        'Ainda não recebemos a confirmação deste Pix.',
      );
      return;
    }

    pixPollAbortController = new AbortController();

    try {
      const response = await apiGet('/orders?page=0&size=1000', {
        signal: pixPollAbortController.signal,
      });

      if (session !== pixPollSession) return;

      consecutiveFailures = 0;
      const orders = response.content;
      const updated = orders.find((o) => o.id === orderId);

      if (updated && updated.paymentStatus === 'approved') {
        showPaymentResult({ status: 'approved' });
        return;
      }
    } catch (error) {
      // Abort provocado por stopPixPolling() não é falha operacional.
      if (session !== pixPollSession || error.code === 'API_ABORTED') return;

      consecutiveFailures += 1;
      logPixPollingError(error, consecutiveFailures);

      if (consecutiveFailures >= PIX_POLL_MAX_CONSECUTIVE_FAILURES) {
        renderPixPollingRecovery(
          'Não foi possível continuar verificando automaticamente a confirmação deste Pix.',
        );
        return;
      }
    } finally {
      if (session === pixPollSession) {
        pixPollAbortController = null;
      }
    }

    if (Date.now() >= deadline) {
      renderPixPollingRecovery(
        'Ainda não recebemos a confirmação deste Pix.',
      );
      return;
    }

    // Só agenda depois que apiGet termina, impedindo sobreposição.
    pixPollTimeout = setTimeout(poll, PIX_POLL_DELAY_MS);
  };

  pixPollTimeout = setTimeout(poll, PIX_POLL_DELAY_MS);
}

function showPaymentResult(result) {
  stopPixPolling();

  document.querySelector('[data-checkout-payment]').hidden = true;

  const config = PAYMENT_RESULT_CONTENT[result.status] || PAYMENT_RESULT_CONTENT.pending;
  const message = result.status === 'rejected' && result.statusDetail && STATUS_DETAIL_MESSAGES[result.statusDetail]
    ? STATUS_DETAIL_MESSAGES[result.statusDetail]
    : config.message;

  const actionButton = result.status === 'rejected'
    ? '<button class="btn btn-primary" type="button" data-retry-btn>Tentar novamente</button>'
    : '<a class="btn btn-primary" href="orders.html">Ver meus pedidos</a>';

  const resultSection = document.querySelector('[data-checkout-result]');
  resultSection.innerHTML = `
    <div class="checkout-result-icon ${config.modifierClass}">${config.icon}</div>
    <h2>${config.title}</h2>
    <p>${escapeHtml(message)}</p>
    ${actionButton}
  `;
  resultSection.hidden = false;
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const retryBtn = resultSection.querySelector('[data-retry-btn]');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => window.location.reload());
  }
}

async function initCheckoutPage() {
  if (!requireAuth()) return;

  const currentUser = getCurrentUser();
  if (currentUser && !currentUser.emailVerified) {
    renderCheckoutError('Verifique seu email antes de finalizar a compra. Confira sua caixa de entrada.');
    return;
  }

  const orderId = getOrderId();

  try {
    if (orderId) {
      const response = await apiGet('/orders?page=0&size=1000');
      const orders = response.content;
      const order = orders.find((o) => o.id === orderId);

      if (!order) {
        showToast('Pedido não encontrado', 'error');
        window.location.href = 'orders.html';
        return;
      }

      renderCheckout(order);
      return;
    }

    const cart = await apiGet('/cart');
    if (!cart.items.length) {
      showToast('Seu carrinho está vazio', 'error');
      window.location.href = 'cart.html';
      return;
    }

    const addresses = await apiGet('/addresses');
    renderCheckoutFromCart(cart, addresses);
  } catch (error) {
    renderCheckoutError(error.message || 'Erro ao carregar checkout');
  }
}

window.addEventListener('pagehide', stopPixPolling);
document.addEventListener('DOMContentLoaded', initCheckoutPage);
