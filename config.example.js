/*
 * Variáveis obrigatórias no build de produção:
 *
 * MP_PUBLIC_KEY: Public Key de produção da aplicação Mercado Pago.
 * Na Vercel, configure-a em Project Settings > Environment Variables
 * para o ambiente Production. O build rejeita valores vazios,
 * placeholders e chaves TEST- em deploys de produção.
 */
const MP_PUBLIC_KEY = 'TEST-sua-chave-publica-aqui';
