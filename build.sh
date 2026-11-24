#!/bin/sh

set -eu

fail_build() {
  echo "Erro de configuração: $1" >&2
  exit 1
}

mp_public_key="${MP_PUBLIC_KEY:-}"
card_payment_enabled_raw="${CARD_PAYMENT_ENABLED:-}"
card_provider_raw="${CARD_PROVIDER:-}"

if [ -z "$mp_public_key" ]; then
  fail_build "MP_PUBLIC_KEY é obrigatória e não pode estar vazia."
fi

case "$mp_public_key" in
  *[![:space:]]*) ;;
  *) fail_build "MP_PUBLIC_KEY é obrigatória e não pode estar vazia." ;;
esac

case "$mp_public_key" in
  TEST-sua-chave-publica-aqui|YOUR_PUBLIC_KEY|REPLACE_ME)
    fail_build "MP_PUBLIC_KEY ainda contém um valor de exemplo."
    ;;
  *[!A-Za-z0-9_-]*)
    fail_build "MP_PUBLIC_KEY contém caracteres inesperados."
    ;;
esac

if [ "${VERCEL_ENV:-}" = "production" ]; then
  case "$mp_public_key" in
    TEST-*)
      fail_build "MP_PUBLIC_KEY não pode ser uma chave de teste em um deploy de produção."
      ;;
  esac
fi

case "$card_payment_enabled_raw" in
  [Tt][Rr][Uu][Ee]) card_payment_enabled=true ;;
  [Ff][Aa][Ll][Ss][Ee]) card_payment_enabled=false ;;
  *) card_payment_enabled=false ;;
esac

echo "CARD_PAYMENT_ENABLED: $card_payment_enabled"

case "$card_provider_raw" in
  "") card_provider=infinitepay ;;
  [Ii][Nn][Ff][Ii][Nn][Ii][Tt][Ee][Pp][Aa][Yy]) card_provider=infinitepay ;;
  [Mm][Ee][Rr][Cc][Aa][Dd][Oo][Pp][Aa][Gg][Oo]) card_provider=mercadopago ;;
  *) fail_build "CARD_PROVIDER deve ser 'infinitepay' ou 'mercadopago'." ;;
esac

printf "const MP_PUBLIC_KEY = '%s';\nconst CARD_PAYMENT_ENABLED_CONFIG = %s;\nconst CARD_PROVIDER_CONFIG = '%s';\n" \
  "$mp_public_key" "$card_payment_enabled" "$card_provider" > config.js

node scripts/generate-sitemap.mjs
