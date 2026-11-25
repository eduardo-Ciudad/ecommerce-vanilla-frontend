const PRODUCT_DETAIL_TABS = ['visao-geral', 'variacoes', 'imagens', 'especificacoes'];
const PRODUCT_SIZE_ORDER = new Map([['P', 0], ['M', 1], ['G', 2], ['GG', 3]]);
const PRODUCT_NATURAL_COLLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

let detailProductId = null;
let detailProduct = null;
let detailCategories = [];

function currentProductTab() {
  const hash = window.location.hash.slice(1);
  return PRODUCT_DETAIL_TABS.includes(hash) ? hash : 'visao-geral';
}

function productDetailError(message) {
  const root = document.querySelector('[data-product-detail]');
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `
    <div class="product-detail-error" role="alert">
      <h1>Produto não encontrado</h1>
      <p>${escapeHtml(message)}</p>
      <a class="btn btn-secondary" href="products.html">Voltar para Produtos</a>
    </div>
  `;
}

function formatProductDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function productPriceSummary(product) {
  const prices = (product.variants || []).map((variant) => Number(variant.price)).filter(Number.isFinite);
  if (!prices.length) return '—';
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return minimum === maximum ? formatPrice(minimum) : `${formatPrice(minimum)} – ${formatPrice(maximum)}`;
}

function distinctProductColors(product) {
  return new Set((product.variants || [])
    .map((variant) => String(variant.color || '').trim().toLocaleLowerCase('pt-BR'))
    .filter(Boolean)).size;
}

function sortProductVariants(variants) {
  return [...variants].sort((left, right) => {
    const colorComparison = PRODUCT_NATURAL_COLLATOR.compare(left.color || '', right.color || '');
    if (colorComparison) return colorComparison;
    const leftSize = String(left.size || '').toUpperCase();
    const rightSize = String(right.size || '').toUpperCase();
    const leftOrder = PRODUCT_SIZE_ORDER.get(leftSize);
    const rightOrder = PRODUCT_SIZE_ORDER.get(rightSize);
    if (leftOrder != null && rightOrder != null) return leftOrder - rightOrder;
    if (leftOrder != null) return -1;
    if (rightOrder != null) return 1;
    return PRODUCT_NATURAL_COLLATOR.compare(leftSize, rightSize);
  });
}

function renderProductSummary(product) {
  const variants = product.variants || [];
  const colors = distinctProductColors(product);
  const gtinCount = variants.filter((variant) => String(variant.gtin || '').trim()).length;
  const gtinClass = variants.length > 0 && gtinCount === variants.length ? 'is-complete' : 'is-incomplete';
  return `
    <section class="product-summary-grid" aria-label="Resumo do produto">
      <article class="product-summary-card"><span>Preço</span><strong>${productPriceSummary(product)}</strong></article>
      <article class="product-summary-card"><span>Estoque total</span><strong>${totalVariantStock(product)} un.</strong></article>
      <article class="product-summary-card"><span>Variações</span><strong>${variants.length} · ${colors} ${colors === 1 ? 'cor' : 'cores'}</strong></article>
      <article class="product-summary-card ${gtinClass}"><span>GTIN</span><strong>${gtinCount} de ${variants.length}</strong></article>
    </section>
  `;
}

function renderOverviewPanel(product) {
  return `
    <section class="product-tab-panel" id="panel-visao-geral" role="tabpanel" aria-labelledby="tab-visao-geral" data-tab-panel="visao-geral">
      <div class="product-overview-grid">
        <div class="product-overview-copy">
          <div class="product-section-heading">
            <div><span class="product-section-eyebrow">Cadastro</span><h2>Visão geral</h2></div>
            <button class="btn btn-secondary btn-sm" type="button" data-edit-product>Editar</button>
          </div>
          <dl class="product-definition-list">
            <div><dt>Categoria</dt><dd>${escapeHtml(product.categoryName || '—')}</dd></div>
            <div><dt>Código no Bling</dt><dd>${product.blingProductId != null ? `#${escapeHtml(product.blingProductId)}` : '—'}</dd></div>
            <div><dt>Cadastrado em</dt><dd>${formatProductDate(product.createdAt)}</dd></div>
            <div class="product-description-row"><dt>Descrição</dt><dd>${escapeHtml(product.description || 'Sem descrição.')}</dd></div>
          </dl>
        </div>
        <div class="product-cover-card">
          <span class="product-section-eyebrow">Capa atual</span>
          <div class="product-cover-preview">
            ${product.imageUrl
              ? `<img src="${escapeAttr(product.imageUrl)}" alt="Capa de ${escapeAttr(product.name)}" />`
              : '<span>Sem foto</span>'}
          </div>
          <button class="product-cover-upload" type="button" data-upload-cover>Trocar capa (upload manual)</button>
        </div>
      </div>
    </section>
  `;
}

function renderVariantsPanel(product) {
  const variants = sortProductVariants(product.variants || []);
  const rows = variants.map((variant) => `
    <tr>
      <td><span class="product-color-label"><i aria-hidden="true"></i>${escapeHtml(variant.color || 'Sem cor')}</span></td>
      <td>${escapeHtml(variant.size || '—')}</td>
      <td>${escapeHtml(variant.sku || '—')}</td>
      <td>${escapeHtml(variant.gtin || '—')}</td>
      <td>${formatPrice(variant.price)}</td>
      <td class="${Number(variant.stock) === 0 ? 'admin-product-stock--out' : ''}">${Number(variant.stock) || 0} un.</td>
      <td>
        <div class="admin-table-actions">
          <button class="icon-btn" type="button" data-edit-variant="${escapeAttr(variant.id)}" aria-label="Editar variação" title="Editar variação">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn icon-btn-danger" type="button" data-delete-variant="${escapeAttr(variant.id)}" aria-label="Remover variação" title="Remover variação">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <section class="product-tab-panel" id="panel-variacoes" role="tabpanel" aria-labelledby="tab-variacoes" data-tab-panel="variacoes">
      <div class="product-section-heading">
        <div><span class="product-section-eyebrow">Grade comercial</span><h2>Variações</h2></div>
        ${product.blingProductId != null
          ? '<p>As variações deste produto vêm do Bling. Para incluir uma nova, cadastre no Bling e clique em Ressincronizar.</p>'
          : '<button class="btn btn-primary btn-sm" type="button" data-add-variant>+ Adicionar variação</button>'}
      </div>
      ${variants.length ? `
        <div class="product-variant-table-wrap">
          <table class="admin-table product-variant-table">
            <thead><tr><th>Cor</th><th>Tamanho</th><th>SKU</th><th>GTIN</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : '<p class="empty-state empty-state--spacious">Nenhuma variação cadastrada.</p>'}
    </section>
  `;
}

function renderImagesPanel(product) {
  const images = [...(product.images || [])].sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0));
  const groups = new Map();
  images.forEach((image) => {
    const color = String(image.color || '').trim() || 'Sem cor';
    if (!groups.has(color)) groups.set(color, []);
    groups.get(color).push(image);
  });

  const content = [...groups.entries()].map(([color, colorImages]) => `
    <section class="product-image-group">
      <h3>${escapeHtml(color)}</h3>
      <div class="product-image-grid">
        ${colorImages.map((image, index) => {
          const source = image.thumbnailUrl || image.url;
          const isCover = image.url === product.imageUrl;
          return `
            <figure class="product-image-tile">
              <img src="${escapeAttr(source)}" alt="${escapeAttr(product.name)} – ${escapeAttr(color)} – foto ${index + 1}" loading="lazy" />
              ${isCover ? '<figcaption>Capa</figcaption>' : ''}
            </figure>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');

  return `
    <section class="product-tab-panel" id="panel-imagens" role="tabpanel" aria-labelledby="tab-imagens" data-tab-panel="imagens">
      <div class="product-section-heading"><div><span class="product-section-eyebrow">Galeria</span><h2>Imagens sincronizadas</h2></div></div>
      ${content || '<p class="empty-state empty-state--spacious">Nenhuma imagem sincronizada.</p>'}
    </section>
  `;
}

function renderSpecificationsPanel(product) {
  const specifications = [...(product.specifications || [])]
    .sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0));
  return `
    <section class="product-tab-panel" id="panel-especificacoes" role="tabpanel" aria-labelledby="tab-especificacoes" data-tab-panel="especificacoes">
      <div class="product-section-heading">
        <div><span class="product-section-eyebrow">Ficha técnica</span><h2>Especificações</h2><p>lidas da descrição do Bling</p></div>
      </div>
      ${specifications.length ? `
        <dl class="product-specifications-list">
          ${specifications.map((specification) => `<div><dt>${escapeHtml(specification.name)}</dt><dd>${escapeHtml(specification.value)}</dd></div>`).join('')}
        </dl>` : '<p class="empty-state empty-state--spacious">Nenhuma especificação cadastrada no Bling.</p>'}
    </section>
  `;
}

function renderProductTabs(product) {
  const variants = (product.variants || []).length;
  const images = (product.images || []).length;
  return `
    <section class="product-tabs-card">
      <div class="product-tabs" role="tablist" aria-label="Dados do produto">
        <button id="tab-visao-geral" type="button" role="tab" aria-controls="panel-visao-geral" data-product-tab="visao-geral">Visão geral</button>
        <button id="tab-variacoes" type="button" role="tab" aria-controls="panel-variacoes" data-product-tab="variacoes">Variações (${variants})</button>
        <button id="tab-imagens" type="button" role="tab" aria-controls="panel-imagens" data-product-tab="imagens">Imagens (${images})</button>
        <button id="tab-especificacoes" type="button" role="tab" aria-controls="panel-especificacoes" data-product-tab="especificacoes">Especificações</button>
      </div>
      <div class="product-tabs-content">
        ${renderOverviewPanel(product)}
        ${renderVariantsPanel(product)}
        ${renderImagesPanel(product)}
        ${renderSpecificationsPanel(product)}
      </div>
    </section>
  `;
}

function renderProductDetail(product) {
  const root = document.querySelector('[data-product-detail]');
  const shortName = product.name.length > 48 ? `${product.name.slice(0, 48)}…` : product.name;
  root.setAttribute('aria-busy', 'false');
  root.innerHTML = `
    <nav class="product-breadcrumb" aria-label="Navegação estrutural">
      <a href="products.html">← Produtos</a><span aria-hidden="true">/</span><span title="${escapeAttr(product.name)}">${escapeHtml(shortName)}</span>
    </nav>
    <section class="product-detail-header">
      <div class="product-detail-identity">
        <div class="product-detail-thumb">
          ${product.imageUrl ? `<img src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.name)}" />` : '<span>Sem foto</span>'}
        </div>
        <div class="product-detail-title">
          <h1>${escapeHtml(product.name)}</h1>
          <div class="product-detail-badges">
            <span class="badge ${product.active ? 'badge-active' : 'badge-inactive'}">${product.active ? 'Ativo' : 'Inativo'}</span>
            ${product.blingProductId != null ? `<span class="product-detail-pill">Bling #${escapeHtml(product.blingProductId)}</span>` : ''}
            <span class="product-detail-pill">${escapeHtml(product.categoryName || 'Sem categoria')}</span>
          </div>
        </div>
      </div>
      <div class="product-detail-actions">
        <a class="btn btn-secondary" href="../product.html?id=${encodeURIComponent(product.id)}" target="_blank" rel="noopener">Ver na loja</a>
        ${product.blingProductId != null ? `
          <button class="btn btn-primary product-resync-button" type="button" data-resync-detail>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 11a8.1 8.1 0 00-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0015.5 2M20 20v-5h-5"/></svg>
            <span>Ressincronizar com o Bling</span>
          </button>` : ''}
        ${product.active ? '<button class="btn product-deactivate-button" type="button" data-deactivate-product>Desativar</button>' : ''}
      </div>
    </section>
    ${product.blingProductId != null ? `
      <aside class="product-sync-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
        <p>Nome, preço, estoque, cores, tamanhos, fotos e especificações vêm do Bling. Para mudar de vez, altere no Bling e clique em Ressincronizar: edições feitas só aqui são substituídas no próximo sync.</p>
      </aside>` : ''}
    ${renderProductSummary(product)}
    ${renderProductTabs(product)}
  `;
  activateProductTab(currentProductTab(), false);
  bindProductDetailEvents();
}

function activateProductTab(tabName, updateHash = true) {
  const activeTab = PRODUCT_DETAIL_TABS.includes(tabName) ? tabName : 'visao-geral';
  document.querySelectorAll('[data-product-tab]').forEach((tab) => {
    const selected = tab.dataset.productTab === activeTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== activeTab;
  });
  if (updateHash && window.location.hash !== `#${activeTab}`) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${activeTab}`);
  }
}

function bindProductDetailEvents() {
  const tabs = [...document.querySelectorAll('[data-product-tab]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateProductTab(tab.dataset.productTab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextTab = tabs[(index + direction + tabs.length) % tabs.length];
      activateProductTab(nextTab.dataset.productTab);
      nextTab.focus();
    });
  });

  document.querySelector('[data-edit-product]')?.addEventListener('click', () => {
    openProductModal(detailProduct, detailCategories, loadProduct);
  });
  document.querySelector('[data-upload-cover]')?.addEventListener('click', () => {
    triggerImageUpload(detailProduct.id, loadProduct);
  });
  document.querySelector('[data-add-variant]')?.addEventListener('click', () => {
    openVariantFormModal(detailProduct, null, loadProduct);
  });
  document.querySelectorAll('[data-edit-variant]').forEach((button) => {
    button.addEventListener('click', () => {
      const variant = detailProduct.variants.find((item) => String(item.id) === button.dataset.editVariant);
      openVariantFormModal(detailProduct, variant, loadProduct);
    });
  });
  document.querySelectorAll('[data-delete-variant]').forEach((button) => {
    button.addEventListener('click', () => confirmDeleteVariant(detailProduct, button.dataset.deleteVariant, loadProduct));
  });
  document.querySelector('[data-deactivate-product]')?.addEventListener('click', () => {
    confirmDeleteProduct(detailProduct, loadProduct);
  });
  document.querySelector('[data-resync-detail]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.querySelector('span').textContent = 'Sincronizando…';
    await resyncProduct(detailProduct.id, button, loadProduct);
    if (button.isConnected) button.querySelector('span').textContent = 'Ressincronizar com o Bling';
  });
}

async function loadProduct() {
  const product = await apiGet(`/products/${encodeURIComponent(detailProductId)}`);
  detailProduct = product;
  renderProductDetail(product);
  return product;
}

async function initProductDetailPage() {
  if (!requireAdmin()) return;
  document.querySelector('.admin-nav a[href="products.html"]')?.classList.add('is-active');
  detailProductId = new URLSearchParams(window.location.search).get('id');
  if (!detailProductId) {
    productDetailError('O endereço não informa qual produto deve ser aberto.');
    return;
  }

  try {
    await loadProduct();
  } catch (error) {
    if (error.status !== 404) logAppError('admin.product_detail.load', error);
    productDetailError(error.status === 404
      ? 'Este produto não existe ou não está mais disponível.'
      : 'Não foi possível carregar os dados deste produto.');
    return;
  }

  try {
    detailCategories = await apiGet('/categories');
  } catch (error) {
    logAppError('admin.product_detail.categories.load', error);
    detailCategories = [];
    showToast(
      'Não foi possível carregar as categorias. A edição do produto pode ficar indisponível.',
      'warning',
    );
  }
}

window.addEventListener('hashchange', () => {
  if (detailProduct) activateProductTab(currentProductTab(), false);
});
document.addEventListener('DOMContentLoaded', initProductDetailPage);
