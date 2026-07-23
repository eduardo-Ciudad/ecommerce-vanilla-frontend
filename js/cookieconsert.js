(function () {
    'use strict';

    var CONSENT_KEY = 'cookie_consent';
    var CONSENT_DATE_KEY = 'cookie_consent_date';
    var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

    function hasValidConsent() {
        var value = localStorage.getItem(CONSENT_KEY);
        var dateStr = localStorage.getItem(CONSENT_DATE_KEY);
        if (!value || !dateStr) return false;

        var savedDate = new Date(dateStr).getTime();
        if (isNaN(savedDate)) return false;

        return (Date.now() - savedDate) < MAX_AGE_MS;
    }

    function saveConsent(value) {
        localStorage.setItem(CONSENT_KEY, value);
        localStorage.setItem(CONSENT_DATE_KEY, new Date().toISOString());
    }

    function injectStyles() {
        if (document.getElementById('cookieConsentStyles')) return;

        var style = document.createElement('style');
        style.id = 'cookieConsentStyles';
        style.textContent =
            '.cookie-consent-banner {' +
            '  position: fixed; left: 0; right: 0; bottom: 0; z-index: 9999;' +
            '  display: flex; justify-content: center;' +
            '  padding: var(--space-lg, 1.5rem);' +
            '  transform: translateY(120%); opacity: 0;' +
            '  transition: transform 320ms ease, opacity 320ms ease;' +
            '  pointer-events: none;' +
            '}' +
            '.cookie-consent-banner.cookie-consent-visible {' +
            '  transform: translateY(0); opacity: 1; pointer-events: auto;' +
            '}' +
            '.cookie-consent-card {' +
            '  width: 100%; max-width: 640px;' +
            '  background: var(--color-white, #fff);' +
            '  border: 1px solid var(--color-border, #E5E7EB);' +
            '  border-radius: var(--radius-lg, 16px);' +
            '  box-shadow: var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.12));' +
            '  padding: var(--space-lg, 1.5rem);' +
            '  color: var(--color-text, #2D2D2D);' +
            '  font-family: var(--font-body, sans-serif);' +
            '}' +
            '.cookie-consent-text {' +
            '  font-size: var(--font-size-sm, 0.875rem); color: var(--color-text-light, #6B7280);' +
            '  margin: 0 0 var(--space-md, 1rem); line-height: 1.6;' +
            '}' +
            '.cookie-consent-text a {' +
            '  color: var(--color-primary, #E8636F); text-decoration: underline;' +
            '  font-weight: 500;' +
            '}' +
            '.cookie-consent-actions {' +
            '  display: flex; align-items: center; justify-content: flex-end;' +
            '  gap: var(--space-sm, 0.5rem); flex-wrap: wrap;' +
            '}' +
            '@media (max-width: 560px) {' +
            '  .cookie-consent-banner { padding: var(--space-md, 1rem); }' +
            '  .cookie-consent-actions { flex-direction: column; align-items: stretch; }' +
            '  .cookie-consent-actions .btn { width: 100%; }' +
            '}';
        document.head.appendChild(style);
    }

    function buildBanner() {
        var banner = document.createElement('div');
        banner.className = 'cookie-consent-banner';
        banner.id = 'cookieConsentBanner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-live', 'polite');
        banner.setAttribute('aria-label', 'Aviso de cookies');

        var rootPath = typeof resolveRootPath === 'function' ? resolveRootPath() : '';

        banner.innerHTML =
            '<div class="cookie-consent-card">' +
            '  <p class="cookie-consent-text">' +
            '    🍪 Usamos cookies para melhorar sua experiência na GabiKids. Cookies essenciais são necessários para o funcionamento da loja. Você pode aceitar todos ou apenas os essenciais. ' +
            '    <a href="' + rootPath + 'politica-de-cookies.html">Saiba mais</a>' +
            '  </p>' +
            '  <div class="cookie-consent-actions">' +
            '    <button type="button" class="btn btn-secondary btn-sm" id="cookieConsentEssential">Apenas necessários</button>' +
            '    <button type="button" class="btn btn-primary btn-sm" id="cookieConsentAcceptAll">Aceitar todos</button>' +
            '  </div>' +
            '</div>';

        return banner;
    }

    function hideBanner(banner) {
        banner.classList.remove('cookie-consent-visible');
        window.setTimeout(function () {
            if (banner.parentNode) banner.parentNode.removeChild(banner);
        }, 350);
    }

    function init() {
        if (hasValidConsent()) return;
        if (document.getElementById('cookieConsentBanner')) return;

        injectStyles();
        var banner = buildBanner();
        document.body.appendChild(banner);

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                banner.classList.add('cookie-consent-visible');
            });
        });

        document.getElementById('cookieConsentAcceptAll').addEventListener('click', function () {
            saveConsent('all');
            hideBanner(banner);
        });

        document.getElementById('cookieConsentEssential').addEventListener('click', function () {
            saveConsent('essential');
            hideBanner(banner);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();