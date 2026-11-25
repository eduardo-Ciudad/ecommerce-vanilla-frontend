/*
 * Google Tag Manager condicionado ao consentimento LGPD.
 * - O container só é carregado após a escolha "Aceitar todos".
 * - O banner chama window.gabiAnalyticsConsent('all' | 'essential').
 * - Eventos são enviados ao dataLayer para configuração no GTM.
 */
(function () {
  'use strict';

  var GTM_ID = 'GTM-T2FDCSCK';
  var CONSENT_KEY = 'cookie_consent';
  var CONSENT_DATE_KEY = 'cookie_consent_date';
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  var SENSITIVE_PARAMS = ['token'];
  var gtmLoaded = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  function readStoredConsent() {
    try {
      var value = localStorage.getItem(CONSENT_KEY);
      var savedDate = new Date(localStorage.getItem(CONSENT_DATE_KEY)).getTime();
      if (!value || isNaN(savedDate) || (Date.now() - savedDate) >= MAX_AGE_MS) return null;
      return value;
    } catch (e) {
      return null;
    }
  }

  function redactUrl(url) {
    if (!url) return url;
    try {
      var parsed = new URL(url, window.location.href);
      var changed = false;
      SENSITIVE_PARAMS.forEach(function (name) {
        if (parsed.searchParams.has(name)) {
          parsed.searchParams.set(name, 'REDACTED');
          changed = true;
        }
      });
      return changed ? parsed.toString() : url;
    } catch (e) {
      return url;
    }
  }

  function consentState(choice) {
    var granted = choice === 'all';
    return {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied'
    };
  }

  function currentUrlHasSensitiveParams() {
    try {
      var params = new URL(window.location.href).searchParams;
      return SENSITIVE_PARAMS.some(function (name) { return params.has(name); });
    } catch (e) {
      return true;
    }
  }

  function loadGtm() {
    if (gtmLoaded || currentUrlHasSensitiveParams() || document.getElementById('gabi-gtm-script')) return;
    gtmLoaded = true;

    window.dataLayer.push({
      page_location: redactUrl(window.location.href),
      page_referrer: redactUrl(document.referrer)
    });
    window.dataLayer.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js'
    });

    var script = document.createElement('script');
    script.id = 'gabi-gtm-script';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    document.head.appendChild(script);
  }

  function pushEcommerceEvent(eventName, ecommerce) {
    if (readStoredConsent() !== 'all') return;
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: eventName, ecommerce: ecommerce });
  }

  function buildAnalyticsItem(item) {
    var price = Number(item && item.price);
    var quantity = Number(item && item.quantity);
    if (!item || !item.variantId || !item.productName || item.price == null
      || !Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) return null;

    var analyticsItem = {
      item_id: String(item.variantId),
      item_name: String(item.productName),
      price: Number(price.toFixed(2)),
      quantity: quantity
    };
    var categoryName = String(item.categoryName || '').trim();
    var color = String(item.color || '').trim();
    var size = String(item.size || '').trim();
    var variantParts = [color, size].filter(Boolean);
    if (categoryName) analyticsItem.item_category = categoryName;
    if (variantParts.length) analyticsItem.item_variant = variantParts.join(' / ');
    return analyticsItem;
  }

  function purchaseItems(order) {
    if (!order || !Array.isArray(order.items) || !order.items.length) return [];

    return order.items.map(function (item) {
      return buildAnalyticsItem({
        variantId: item && item.variantId,
        productName: item && item.productName,
        categoryName: item && item.categoryName,
        color: item && item.color,
        size: item && item.size,
        price: item && item.unitPrice,
        quantity: item && item.quantity
      });
    }).filter(Boolean);
  }

  window.trackViewItem = function (product, variant) {
    var item = buildAnalyticsItem({
      variantId: variant && variant.id,
      productName: product && product.name,
      categoryName: product && product.categoryName,
      color: variant && variant.color,
      size: variant && variant.size,
      price: variant && variant.price,
      quantity: 1
    });
    if (!item) return;
    pushEcommerceEvent('view_item', {
      currency: 'BRL',
      value: item.price,
      items: [item]
    });
  };

  window.trackAddToCart = function (product, variant, quantity) {
    var item = buildAnalyticsItem({
      variantId: variant && variant.id,
      productName: product && product.name,
      categoryName: product && product.categoryName,
      color: variant && variant.color,
      size: variant && variant.size,
      price: variant && variant.price,
      quantity: quantity
    });
    if (!item) return;
    pushEcommerceEvent('add_to_cart', {
      currency: 'BRL',
      value: Number((item.price * item.quantity).toFixed(2)),
      items: [item]
    });
  };

  window.trackBeginCheckout = function (cartItems) {
    var items = (Array.isArray(cartItems) ? cartItems : []).map(function (item) {
      return buildAnalyticsItem(item || {});
    }).filter(Boolean);
    if (!items.length) return;
    var value = items.reduce(function (total, item) {
      return total + (item.price * item.quantity);
    }, 0);
    pushEcommerceEvent('begin_checkout', {
      currency: 'BRL',
      value: Number(value.toFixed(2)),
      items: items
    });
  };

  window.trackPurchase = function (order) {
    if (readStoredConsent() !== 'all') return;

    var orderId = order && order.id;
    var total = Number(order && order.total);
    var shipping = Number(order && order.shippingPrice);
    var items = purchaseItems(order);
    if (!orderId || !Number.isFinite(total)) return;
    if (!Number.isFinite(shipping)) shipping = 0;

    var storageKey = 'gk_purchase_' + orderId;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch (e) {
      return;
    }

    pushEcommerceEvent('purchase', {
      transaction_id: String(orderId),
      value: Number(total.toFixed(2)),
      currency: 'BRL',
      shipping: Number(shipping.toFixed(2)),
      items: items
    });

    try {
      localStorage.setItem(storageKey, '1');
    } catch (e) {
      // O bloqueio do storage não deve interromper o checkout.
    }
  };

  window.gabiAnalyticsConsent = function (choice) {
    gtag('consent', 'update', consentState(choice));
    if (choice === 'all') loadGtm();
  };

  var defaults = consentState(readStoredConsent());
  defaults.wait_for_update = 500;
  gtag('consent', 'default', defaults);

  if (readStoredConsent() === 'all') loadGtm();
})();
