const MP_PUBLIC_KEY = 'APP_USR-b8bd2a22-221e-4f4d-9bfe-eedd23d1299d';

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
    icon: '✓',
    modifierClass: 'checkout-result-icon--success',
    title: 'Pagamento aprovado!',
    message: 'Seu pedido foi confirmado.',
  },
  rejected: {
    icon: '✕',
    modifierClass: 'checkout-result-icon--error',
    title: 'Pagamento recusado',
    message: 'Não foi possível processar o pagamento.',
  },
  pending: {
    icon: '⏳',
    modifierClass: 'checkout-result-icon--pending',
    title: 'Pagamento em processamento',
    message: 'Você receberá a confirmação em breve.',
  },
  in_process: {
    icon: '⏳',
    modifierClass: 'checkout-result-icon--pending',
    title: 'Pagamento em processamento',
    message: 'Você receberá a confirmação em breve.',
  },
};

let pixPollInterval = null;

function getOrderId() {
  return new URLSearchParams(window.location.search).get('orderId');
}

function renderCheckoutError(message) {
  document.querySelector('[data-checkout-root]').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">😕</div>
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

function renderCheckout(order) {
  const root = document.querySelector('[data-checkout-root]');
  root.innerHTML = `
    <div class="checkout-layout fade-in">
      <section class="checkout-summary">
        <h2>Resumo do Pedido</h2>
        <ul class="checkout-summary-items">
          ${order.items.map(checkoutItemRow).join('')}
        </ul>
        <div class="checkout-summary-total">
          <span>Total</span>
          <span>${formatPrice(order.total)}</span>
        </div>
      </section>

      <section class="checkout-payment" data-checkout-payment>
        <div class="payment-tabs">
          <button class="payment-tab is-active" type="button" data-payment-tab="card">💳 Cartão de Crédito</button>
          <button class="payment-tab" type="button" data-payment-tab="pix">📱 Pix</button>
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

// O CardPayment Brick já renderiza seu próprio botão "Pagar" com o valor
// formatado, então não adicionamos um botão de submit manual abaixo dele.
function initCardForm(order) {
  const container = document.getElementById('mp-card-form');

  if (typeof MercadoPago === 'undefined') {
    container.innerHTML = '<p class="empty-state empty-state--inline">Não foi possível carregar o formulário de pagamento.</p>';
    return;
  }

  const mp = new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
  const bricksBuilder = mp.bricks();

  bricksBuilder.create('cardPayment', 'mp-card-form', {
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
      onError: (error) => {
        console.error('MP Brick error:', error);
        showToast('Erro no formulário de pagamento', 'error');
      },
    },
  });
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

function startPixPolling(orderId) {
  if (pixPollInterval) clearInterval(pixPollInterval);

  pixPollInterval = setInterval(async () => {
    try {
      const orders = await apiGet('/orders');
      const updated = orders.find((o) => o.id === orderId);
      if (updated && updated.paymentStatus === 'approved') {
        clearInterval(pixPollInterval);
        showPaymentResult({ status: 'approved' });
      }
    } catch {
      /* ignora falhas de polling — tenta de novo no próximo tick */
    }
  }, 5000);
}

function showPaymentResult(result) {
  if (pixPollInterval) clearInterval(pixPollInterval);

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

  const orderId = getOrderId();
  if (!orderId) {
    showToast('Pedido não encontrado', 'error');
    window.location.href = 'cart.html';
    return;
  }

  try {
    const orders = await apiGet('/orders');
    const order = orders.find((o) => o.id === orderId);

    if (!order) {
      showToast('Pedido não encontrado', 'error');
      window.location.href = 'orders.html';
      return;
    }

    renderCheckout(order);
  } catch (error) {
    renderCheckoutError(error.message || 'Erro ao carregar checkout');
  }
}

document.addEventListener('DOMContentLoaded', initCheckoutPage);
