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

  function purchaseItem(item) {
    var price = Number(item && item.unitPrice);
    var quantity = Number(item && item.quantity);
    if (!item || !item.variantId || !item.productName || item.unitPrice == null || item.quantity == null
      || !Number.isFinite(price) || !Number.isFinite(quantity) || quantity <= 0) return null;
    return {
      item_id: String(item.variantId),
      item_name: String(item.productName),
      price: Number(price.toFixed(2)),
      quantity: quantity
    };
  }

  function purchaseItems(order) {
    if (!order || !Array.isArray(order.items) || !order.items.length) return [];

    var items = order.items.map(purchaseItem);
    if (items.some(function (item) { return !item; })) return [];
    return items;
  }

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

    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: String(orderId),
        value: Number(total.toFixed(2)),
        currency: 'BRL',
        shipping: Number(shipping.toFixed(2)),
        items: items
      }
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
