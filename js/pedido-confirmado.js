const RETURN_POLL_DELAY_MS = 5000;
const RETURN_POLL_MAX_DURATION_MS = 5 * 60 * 1000;
const RETURN_POLL_MAX_CONSECUTIVE_FAILURES = 5;

let returnPollTimeout = null;
let returnPollAbortController = null;
let returnPollSession = 0;
let purchaseTracked = false;

function stopReturnPolling() {
  returnPollSession += 1;

  if (returnPollTimeout) {
    clearTimeout(returnPollTimeout);
    returnPollTimeout = null;
  }

  if (returnPollAbortController) {
    returnPollAbortController.abort();
    returnPollAbortController = null;
  }
}

function isTrustedInfinitePayUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'infinitepay.io' || url.hostname.endsWith('.infinitepay.io'));
  } catch {
    return false;
  }
}

function createActionLink(label, href, className = 'btn btn-primary') {
  const link = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

function createResultIcon(type) {
  const icon = document.createElement('div');
  icon.className = `checkout-result-icon checkout-result-icon--${type}`;

  const symbol = document.createElement('span');
  symbol.className = 'payment-return-icon-symbol';
  symbol.setAttribute('aria-hidden', 'true');
  symbol.textContent = type === 'success' ? '✓' : type === 'error' ? '×' : '…';
  icon.appendChild(symbol);
  return icon;
}

function appendReceiptLink(actions, receiptUrl) {
  if (!isTrustedInfinitePayUrl(receiptUrl)) return;

  const receiptLink = createActionLink('Ver comprovante', receiptUrl, 'btn btn-secondary');
  receiptLink.target = '_blank';
  receiptLink.rel = 'noopener noreferrer';
  actions.appendChild(receiptLink);
}

function renderResult({ type = 'pending', title, message, orderId, receiptUrl, action = 'orders' }) {
  const root = document.querySelector('[data-payment-return-root]');
  const section = document.createElement('section');
  section.className = 'checkout-result fade-in';

  const heading = document.createElement('h2');
  heading.textContent = title;

  const description = document.createElement('p');
  description.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'payment-return-actions';

  if (action === 'checkout' && orderId) {
    actions.appendChild(createActionLink(
      'Voltar ao checkout',
      `checkout.html?orderId=${encodeURIComponent(orderId)}`,
    ));
  } else if (action === 'cart') {
    actions.appendChild(createActionLink('Voltar ao carrinho', 'cart.html'));
  } else {
    actions.appendChild(createActionLink('Ver meus pedidos', 'orders.html'));
  }

  appendReceiptLink(actions, receiptUrl);
  section.append(createResultIcon(type), heading, description, actions);
  root.replaceChildren(section);
  return section;
}

function appendOrderSummary(section, order) {
  const summary = document.createElement('div');
  summary.className = 'checkout-summary payment-return-order';

  const heading = document.createElement('h3');
  heading.textContent = 'Resumo do pedido';

  const items = document.createElement('ul');
  items.className = 'checkout-summary-items';

  order.items.forEach((item) => {
    const row = document.createElement('li');
    row.className = 'checkout-summary-item';

    const label = document.createElement('span');
    label.textContent = `${item.productName} ×${item.quantity}`;

    const price = document.createElement('span');
    price.textContent = formatPrice(Number(item.unitPrice) * Number(item.quantity));
    row.append(label, price);
    items.appendChild(row);
  });

  const total = document.createElement('div');
  total.className = 'payment-return-total';

  const totalLabel = document.createElement('span');
  totalLabel.textContent = 'Total';

  const totalValue = document.createElement('span');
  totalValue.textContent = formatPrice(order.total);
  total.append(totalLabel, totalValue);

  summary.append(heading, items, total);
  section.appendChild(summary);
}

function renderAttention(receiptUrl) {
  const section = renderResult({
    title: 'Pagamento em confirmação',
    message: 'Recebemos seu pagamento e vamos confirmar seu pedido. Se precisar, fale com a gente pelo WhatsApp.',
    receiptUrl,
  });

  const actions = section.querySelector('.payment-return-actions');
  const whatsapp = createActionLink(
    `WhatsApp ${SUPPORT_WHATSAPP_DISPLAY}`,
    SUPPORT_WHATSAPP_LINK,
    'btn btn-secondary',
  );
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  actions.appendChild(whatsapp);
}

function renderCancelled(receiptUrl) {
  const section = renderResult({
    type: 'error',
    title: 'Prazo de pagamento expirado',
    message: 'Este pedido foi cancelado porque o pagamento não foi confirmado a tempo. Se o valor foi cobrado no seu cartão, fale com a gente pelo WhatsApp.',
    receiptUrl,
    action: 'cart',
  });

  const actions = section.querySelector('.payment-return-actions');
  const whatsapp = createActionLink(
    `WhatsApp ${SUPPORT_WHATSAPP_DISPLAY}`,
    SUPPORT_WHATSAPP_LINK,
    'btn btn-secondary',
  );
  whatsapp.target = '_blank';
  whatsapp.rel = 'noopener noreferrer';
  actions.appendChild(whatsapp);
}

async function renderApprovedOrder(orderId, receiptUrl) {
  stopReturnPolling();

  try {
    const order = await apiGet(`/orders/${encodeURIComponent(orderId)}`);
    const section = renderResult({
      type: 'success',
      title: 'Pagamento aprovado!',
      message: 'Seu pedido foi confirmado.',
      orderId,
      receiptUrl,
    });
    appendOrderSummary(section, order);

    if (!purchaseTracked && typeof window.trackPurchase === 'function') {
      purchaseTracked = true;
      window.trackPurchase(order);
    }
  } catch (error) {
    logAppError('payment_return.order', error, { code: 'PAYMENT_RETURN_ORDER_ERROR' });
    renderAnalysis(orderId, receiptUrl);
  }
}

function renderAnalysis(orderId, receiptUrl) {
  stopReturnPolling();
  renderResult({
    title: 'Seu pagamento está em análise',
    message: 'A confirmação pode levar alguns instantes. O status atualizado aparecerá em Meus Pedidos.',
    orderId,
    receiptUrl,
  });
}

function startReturnPolling(orderId, receiptUrl) {
  stopReturnPolling();

  const session = returnPollSession;
  const deadline = Date.now() + RETURN_POLL_MAX_DURATION_MS;
  let consecutiveFailures = 0;

  const poll = async () => {
    if (session !== returnPollSession) return;

    if (Date.now() >= deadline) {
      renderAnalysis(orderId, receiptUrl);
      return;
    }

    returnPollAbortController = new AbortController();

    try {
      const order = await apiGet(`/orders/${encodeURIComponent(orderId)}`, {
        signal: returnPollAbortController.signal,
      });

      if (session !== returnPollSession) return;
      consecutiveFailures = 0;

      if (order?.paymentStatus === 'approved') {
        await renderApprovedOrder(orderId, receiptUrl);
        return;
      }

      if (order?.paymentStatus === 'cancelled') {
        stopReturnPolling();
        renderCancelled(receiptUrl);
        return;
      }

      if (order?.paymentStatus === 'rejected') {
        stopReturnPolling();
        renderResult({
          type: 'error',
          title: 'Pagamento não aprovado',
          message: 'Não foi possível confirmar o pagamento. Você pode tentar novamente pelo checkout.',
          orderId,
          receiptUrl,
          action: 'checkout',
        });
        return;
      }
    } catch (error) {
      if (session !== returnPollSession || error.code === 'API_ABORTED') return;

      consecutiveFailures += 1;
      logAppError('payment_return.polling', error, {
        code: 'PAYMENT_RETURN_POLL_ERROR',
        consecutiveFailures,
      });

      if (consecutiveFailures >= RETURN_POLL_MAX_CONSECUTIVE_FAILURES) {
        renderAnalysis(orderId, receiptUrl);
        return;
      }
    } finally {
      if (session === returnPollSession) returnPollAbortController = null;
    }

    if (Date.now() >= deadline) {
      renderAnalysis(orderId, receiptUrl);
      return;
    }

    returnPollTimeout = setTimeout(poll, RETURN_POLL_DELAY_MS);
  };

  returnPollTimeout = setTimeout(poll, RETURN_POLL_DELAY_MS);
}

async function initPaymentReturnPage() {
  if (!requireAuth()) return;

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_nsu');
  const transactionNsu = params.get('transaction_nsu');
  const slug = params.get('slug');
  const receiptUrl = params.get('receipt_url');

  if (!orderId || !transactionNsu || !slug) {
    renderResult({
      title: 'Seu pagamento está sendo processado',
      message: 'A confirmação aparecerá em Meus Pedidos assim que estiver disponível.',
      orderId,
      receiptUrl,
    });
    return;
  }

  renderResult({
    title: 'Confirmando seu pagamento...',
    message: 'Aguarde enquanto consultamos a InfinitePay.',
    orderId,
    receiptUrl,
  });

  try {
    const confirmation = await apiPost('/payments/infinitepay/confirm', {
      orderNsu: orderId,
      transactionNsu,
      slug,
    });

    if (['PAID', 'ALREADY_PAID'].includes(confirmation?.status)) {
      await renderApprovedOrder(orderId, receiptUrl);
      return;
    }

    if (confirmation?.status === 'NOT_PAID') {
      renderResult({
        title: 'Confirmando seu pagamento...',
        message: 'A confirmação ainda não chegou. Continuaremos verificando automaticamente.',
        orderId,
        receiptUrl,
      });
      startReturnPolling(orderId, receiptUrl);
      return;
    }

    if (confirmation?.status === 'REQUIRES_ATTENTION') {
      renderAttention(receiptUrl);
      return;
    }

    renderAnalysis(orderId, receiptUrl);
  } catch (error) {
    logAppError('payment_return.confirm', error, { code: 'PAYMENT_RETURN_CONFIRM_ERROR' });
    renderAnalysis(orderId, receiptUrl);
  }
}

window.addEventListener('pagehide', stopReturnPolling);
document.addEventListener('DOMContentLoaded', initPaymentReturnPage);
