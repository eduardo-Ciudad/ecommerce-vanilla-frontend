let productsCache = [];
let productCategoriesCache = [];

function renderProductsTable() {
  const tbody = document.querySelector('[data-products-tbody]');

  if (!productsCache.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Nenhum produto cadastrado.</div></td></tr>';
    return;
  }

  tbody.innerHTML = productsCache
    .map(
      (product) => `
        <tr data-product-row="${product.id}">
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.categoryName || '-')}</td>
          <td><span class="badge ${product.active ? 'badge-active' : 'badge-inactive'}">${product.active ? 'Ativo' : 'Inativo'}</span></td>
          <td>
            <div class="admin-table-actions">
              <button class="icon-btn" type="button" data-edit-product="${product.id}" title="Editar produto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn" type="button" data-manage-variants="${product.id}" title="Gerenciar variações">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7L9 18l-5-5"/></svg>
              </button>
              <button class="icon-btn icon-btn-danger" type="button" data-delete-product="${product.id}" title="Desativar produto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.addEventListener('click', () => openProductModal(productsCache.find((p) => p.id === btn.dataset.editProduct)));
  });
  tbody.querySelectorAll('[data-manage-variants]').forEach((btn) => {
    btn.addEventListener('click', () => openVariantsModal(btn.dataset.manageVariants));
  });
  tbody.querySelectorAll('[data-delete-product]').forEach((btn) => {
    btn.addEventListener('click', () => confirmDeleteProduct(btn.dataset.deleteProduct));
  });
}

function categoryOptions(selectedId) {
  return productCategoriesCache
    .map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
    .join('');
}

function openProductModal(product) {
  const isEdit = !!product;
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label for="product-name">Nome</label>
      <input class="form-control" id="product-name" type="text" maxlength="150" value="${product ? escapeHtml(product.name) : ''}" required />
      <p class="form-error"></p>
    </div>
    <div class="form-group">
      <label for="product-category">Categoria</label>
      <select class="form-control" id="product-category" required>
        <option value="">Selecione...</option>
        ${categoryOptions(product?.categoryId)}
      </select>
      <p class="form-error"></p>
    </div>
    <div class="form-group">
      <label for="product-description">Descrição</label>
      <textarea class="form-control" id="product-description" rows="3">${product ? escapeHtml(product.description || '') : ''}</textarea>
    </div>
  `;

  openModal({
    title: isEdit ? 'Editar Produto' : 'Novo Produto',
    content,
    confirmLabel: isEdit ? 'Salvar' : 'Criar',
    onConfirm: async () => {
      const nameInput = content.querySelector('#product-name');
      const categoryInput = content.querySelector('#product-category');
      const descriptionInput = content.querySelector('#product-description');

      const name = nameInput.value.trim();
      const categoryId = categoryInput.value;
      let hasError = false;

      if (!name) {
        nameInput.closest('.form-group').classList.add('has-error');
        nameInput.closest('.form-group').querySelector('.form-error').textContent = 'Informe o nome do produto';
        hasError = true;
      }
      if (!categoryId) {
        categoryInput.closest('.form-group').classList.add('has-error');
        categoryInput.closest('.form-group').querySelector('.form-error').textContent = 'Selecione uma categoria';
        hasError = true;
      }
      if (hasError) return;

      const payload = { categoryId, name, description: descriptionInput.value.trim() };

      try {
        if (isEdit) {
          await apiPut(`/products/${product.id}`, payload);
          showToast('Produto atualizado com sucesso', 'success');
        } else {
          await apiPost('/products', payload);
          showToast('Produto criado com sucesso', 'success');
        }
        closeModal();
        await loadProducts();
      } catch (error) {
        showToast(error.message || 'Não foi possível salvar o produto', 'error');
      }
    },
  });
}

function confirmDeleteProduct(id) {
  const product = productsCache.find((p) => p.id === id);
  openModal({
    title: 'Desativar produto',
    content: `<p>Tem certeza que deseja desativar <strong>${escapeHtml(product?.name || '')}</strong>? Ele deixará de aparecer na loja.</p>`,
    confirmLabel: 'Desativar',
    onConfirm: async () => {
      try {
        await apiDelete(`/products/${id}`);
        closeModal();
        showToast('Produto desativado com sucesso', 'success');
        await loadProducts();
      } catch (error) {
        showToast(error.message || 'Não foi possível desativar o produto', 'error');
      }
    },
  });
}

function variantRow(productId, variant) {
  return `
    <div class="variant-manage-row" data-variant-row="${variant.id}">
      <span><strong>${escapeHtml(variant.size)}</strong> — ${formatPrice(variant.price)} — ${variant.stock} un.</span>
      <div class="admin-table-actions">
        <button class="icon-btn" type="button" data-edit-variant="${variant.id}" title="Editar variação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn icon-btn-danger" type="button" data-delete-variant="${variant.id}" title="Remover variação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function openVariantsModal(productId) {
  const product = productsCache.find((p) => p.id === productId);
  const content = document.createElement('div');

  function renderVariantList() {
    const listEl = content.querySelector('[data-variant-list]');
    listEl.innerHTML = product.variants.length
      ? product.variants.map((v) => variantRow(productId, v)).join('')
      : '<p class="empty-state" style="padding: var(--space-md) 0">Nenhuma variação cadastrada.</p>';

    listEl.querySelectorAll('[data-edit-variant]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const variant = product.variants.find((v) => v.id === btn.dataset.editVariant);
        openVariantFormModal(productId, variant);
      });
    });
    listEl.querySelectorAll('[data-delete-variant]').forEach((btn) => {
      btn.addEventListener('click', () => confirmDeleteVariant(productId, btn.dataset.deleteVariant));
    });
  }

  content.innerHTML = `
    <h3 style="font-size: var(--font-size-sm); margin-bottom: var(--space-sm)">Variações de ${escapeHtml(product.name)}</h3>
    <div class="variant-manage-list" data-variant-list></div>
    <button class="btn btn-secondary btn-block" type="button" data-add-variant-btn>+ Adicionar Variação</button>
  `;

  renderVariantList();

  content.querySelector('[data-add-variant-btn]').addEventListener('click', () => {
    closeModal();
    openVariantFormModal(productId, null);
  });

  openModal({ title: 'Gerenciar Variações', content, showFooter: false });
}

function openVariantFormModal(productId, variant) {
  const isEdit = !!variant;
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label for="variant-size">Tamanho</label>
      <select class="form-control" id="variant-size">
        ${['P', 'M', 'G', 'GG'].map((size) => `<option value="${size}" ${variant?.size === size ? 'selected' : ''}>${size}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="variant-price">Preço (R$)</label>
      <input class="form-control" id="variant-price" type="number" step="0.01" min="0.01" value="${variant ? variant.price : ''}" required />
      <p class="form-error"></p>
    </div>
    <div class="form-group">
      <label for="variant-stock">Estoque (unidades)</label>
      <input class="form-control" id="variant-stock" type="number" step="1" min="0" value="${variant ? variant.stock : ''}" required />
      <p class="form-error"></p>
    </div>
  `;

  openModal({
    title: isEdit ? 'Editar Variação' : 'Nova Variação',
    content,
    confirmLabel: isEdit ? 'Salvar' : 'Adicionar',
    onConfirm: async () => {
      const sizeInput = content.querySelector('#variant-size');
      const priceInput = content.querySelector('#variant-price');
      const stockInput = content.querySelector('#variant-stock');

      const price = Number(priceInput.value);
      const stock = Number(stockInput.value);
      let hasError = false;

      if (!(price > 0)) {
        priceInput.closest('.form-group').classList.add('has-error');
        priceInput.closest('.form-group').querySelector('.form-error').textContent = 'Informe um preço válido';
        hasError = true;
      }
      if (!(stock >= 0)) {
        stockInput.closest('.form-group').classList.add('has-error');
        stockInput.closest('.form-group').querySelector('.form-error').textContent = 'Informe um estoque válido';
        hasError = true;
      }
      if (hasError) return;

      const payload = { size: sizeInput.value, price, stock };

      try {
        if (isEdit) {
          await apiPut(`/variants/${variant.id}`, payload);
          showToast('Variação atualizada com sucesso', 'success');
        } else {
          await apiPost(`/products/${productId}/variants`, payload);
          showToast('Variação adicionada com sucesso', 'success');
        }
        closeModal();
        await loadProducts();
        openVariantsModal(productId);
      } catch (error) {
        showToast(error.message || 'Não foi possível salvar a variação', 'error');
      }
    },
  });
}

function confirmDeleteVariant(productId, variantId) {
  openModal({
    title: 'Remover variação',
    content: '<p>Tem certeza que deseja remover esta variação?</p>',
    confirmLabel: 'Remover',
    onConfirm: async () => {
      try {
        await apiDelete(`/variants/${variantId}`);
        closeModal();
        showToast('Variação removida com sucesso', 'success');
        await loadProducts();
        openVariantsModal(productId);
      } catch (error) {
        showToast(error.message || 'Não foi possível remover a variação', 'error');
      }
    },
  });
}

async function loadProducts() {
  const tbody = document.querySelector('[data-products-tbody]');
  try {
    productsCache = await apiGet('/products');
    renderProductsTable();
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Não foi possível carregar os produtos.</div></td></tr>';
    showToast(error.message || 'Erro ao carregar produtos', 'error');
  }
}

async function initProductsPage() {
  if (!requireAdmin()) return;

  document.querySelector('[data-new-product-btn]').addEventListener('click', () => openProductModal(null));

  try {
    productCategoriesCache = await apiGet('/categories');
  } catch {
    productCategoriesCache = [];
  }

  await loadProducts();
}

document.addEventListener('DOMContentLoaded', initProductsPage);
