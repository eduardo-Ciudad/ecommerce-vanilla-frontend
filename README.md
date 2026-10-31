# GabiKids · Loja virtual

Frontend da loja de roupas infantis GabiKids, em produção em [gabikidstore.com](https://gabikidstore.com). Feito em HTML, CSS e JavaScript puro, sem framework e sem bundler, consumindo a [API do e-commerce](https://github.com/eduardo-Ciudad/ecommerce).

Projeto desenvolvido por mim pela [CiudadLab](https://ciudadlab.com.br).

## O que tem

**Loja**
* Home, vitrine com filtros, página de produto com cores disponíveis e seleção de variação
* Carrinho para visitante, mesclado ao carrinho da conta no login
* Checkout com frete dos Correios, cupom de desconto e pagamento pelo Mercado Pago (Pix e cartão), com nova tentativa enquanto o pedido estiver pendente
* Área do cliente com pedidos e endereços

**Conta**
* Cadastro com verificação de e-mail, login, recuperação e troca de senha

**Administração** (`/admin`)
* Dashboard com faturamento, vendas e separação entre site e loja física
* Produtos, categorias, cupons e pedidos, com status de envio ao Bling e reenvio manual
* Venda no balcão: registra vendas da loja física no mesmo estoque do site

**Institucional e SEO**
* Quem somos, políticas de privacidade, cookies, troca e devolução, envio e termos de uso
* Metadados por página, `sitemap.xml` gerado no build e banner de cookies ligado ao Consent Mode do Google Analytics: sem consentimento, o armazenamento de analytics fica negado

## Estrutura

```
├── *.html            # Uma página por rota da loja e da conta
├── admin/            # Páginas do painel administrativo
├── js/
│   ├── api.js        # Cliente da API: URL base, timeouts, erros e renovação do token
│   ├── auth.js       # Login, cadastro e envio do carrinho do visitante para a conta
│   ├── guestCart.js  # Carrinho do visitante
│   ├── admin/        # Scripts do painel
│   └── ...           # Um script por página
├── css/
├── img/ e assets/
├── scripts/
│   └── generate-sitemap.mjs
├── build.sh          # Build da Vercel
└── vercel.json
```

## Como rodar localmente

1. Suba a [API](https://github.com/eduardo-Ciudad/ecommerce) em `http://localhost:8080`. Rodando em `localhost`, o `js/api.js` aponta para ela sozinho.
2. Crie o `config.js` a partir do exemplo e coloque a sua Public Key de teste do Mercado Pago:

   ```bash
   cp config.example.js config.js
   ```

3. Sirva a pasta como site estático, por exemplo:

   ```bash
   npx serve .
   ```

## Build e deploy

O deploy é na Vercel, com `sh build.sh` como comando de build. O script:

* gera o `config.js` a partir da variável `MP_PUBLIC_KEY`;
* recusa o build se a chave estiver vazia, for um valor de exemplo ou for uma chave `TEST-` num deploy de produção;
* gera o `sitemap.xml`.

O deploy automático a cada push na `main` está desligado no `vercel.json`.

## Autor

Eduardo · [CiudadLab](https://ciudadlab.com.br) · [LinkedIn](https://www.linkedin.com/in/eduardociudadf) · [GitHub](https://github.com/eduardo-Ciudad)