/*
 * Google Analytics 4 (gtag.js) com Google Consent Mode v2.
 * - Por padrão, armazenamento de análise/anúncios fica NEGADO (LGPD).
 * - Se o visitante já escolheu "Aceitar todos" (cookieconsert.js), a análise é liberada no carregamento.
 * - O banner chama window.gabiAnalyticsConsent('all' | 'essential') ao escolher.
 * - Parâmetros sensíveis da URL (?token=) são removidos antes de qualquer envio ao Google.
 */
(function () {
  'use strict';

  var GA_MEASUREMENT_ID = 'G-9N9W6K9Q47';
  var GOOGLE_ADS_ID = 'AW-18538098111';
  var GOOGLE_ADS_CONVERSION_SEND_TO = 'AW-18538098111/H6OiCNL5i7QdEL_b04dF';
  var CONSENT_KEY = 'cookie_consent';
  var CONSENT_DATE_KEY = 'cookie_consent_date';
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  var SENSITIVE_PARAMS = ['token'];

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

  var defaults = consentState(readStoredConsent());
  defaults.wait_for_update = 500;
  gtag('consent', 'default', defaults);

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    page_location: redactUrl(window.location.href),
    page_referrer: redactUrl(document.referrer)
  });
  gtag('config', GOOGLE_ADS_ID);

  window.trackAdsPurchaseConversion = function (order) {
    if (typeof window.gtag !== 'function' || readStoredConsent() !== 'all') return;

    var orderId = order && order.id;
    var total = Number(order && order.total);
    if (!orderId || !Number.isFinite(total)) return;

    var storageKey = 'gk_ads_conv_' + orderId;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch (e) {
      return;
    }

    window.gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_CONVERSION_SEND_TO,
      value: Number(total.toFixed(2)),
      currency: 'BRL',
      transaction_id: orderId
    });

    try {
      localStorage.setItem(storageKey, '1');
    } catch (e) {
      // O bloqueio do storage não deve interromper o checkout.
    }
  };

  window.gabiAnalyticsConsent = function (choice) {
    gtag('consent', 'update', consentState(choice));
  };

})();
