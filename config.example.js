/*
 * Variáveis de configuração do build de produção:
 *
 * MP_PUBLIC_KEY: Public Key de produção da aplicação Mercado Pago.
 * Na Vercel, configure-a em Project Settings > Environment Variables
 * para o ambiente Production. O build rejeita valores vazios,
 * placeholders e chaves TEST- em deploys de produção.
 *
 * CARD_PAYMENT_ENABLED: aceita true ou false (sem diferenciar maiúsculas
 * e minúsculas). Ausente ou inválida, o build usa false.
 *
 * CARD_PROVIDER: aceita infinitepay ou mercadopago (sem diferenciar
 * maiúsculas e minúsculas). Ausente, o build usa infinitepay; um valor
 * inválido interrompe o build.
 */
const MP_PUBLIC_KEY = 'TEST-sua-chave-publica-aqui';
const CARD_PAYMENT_ENABLED_CONFIG = false;
const CARD_PROVIDER_CONFIG = 'infinitepay';
