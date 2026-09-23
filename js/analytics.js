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
    return {
      analytics_storage: choice === 'all' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
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

  window.gabiAnalyticsConsent = function (choice) {
    gtag('consent', 'update', consentState(choice));
  };

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
  document.head.appendChild(script);
})();
