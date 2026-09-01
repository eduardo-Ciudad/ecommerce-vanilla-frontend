#!/bin/sh

set -eu

fail_build() {
  echo "Erro de configuração: $1" >&2
  exit 1
}

mp_public_key="${MP_PUBLIC_KEY:-}"

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

printf "const MP_PUBLIC_KEY = '%s';\n" "$mp_public_key" > config.js
