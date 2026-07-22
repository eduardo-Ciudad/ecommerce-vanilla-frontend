let productsCache = [];
let productCategoriesCache = [];

const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const CAMERA_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4a2 2 0 011.76 1.05l.49.9A2 2 0 0018 7h2a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2h2a2 2 0 001.76-1.05l.48-.9A2 2 0 0110 4z"/><circle cx="12" cy="13" r="3"/></svg>';

function validateProductImageFile(file) {
  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return 'Formato inválido. Envie um arquivo JPEG, PNG ou WebP.';
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    return 'Arquivo muito grande. O tamanho máximo é 5MB.';
  }
  return null;
}

function triggerImageUpload(productId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ALLOWED_PRODUCT_IMAGE_TYPES.join(',');
  input.style.display = 'none';

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.remove();
    if (!file) return;

    const validationError = validateProductImageFile(file);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    try {
      await apiUploadFile(`/products/${productId}/image`, file);
      showToast('Imagem atualizada com sucesso', 'success');
      await loadProducts();
    } catch (error) {
      showToast(error.message || 'Não foi possível enviar a imagem', 'error');
    }
  });

  document.body.appendChild(input);
  input.click();
}

function renderProductsTable() {
  const tbody = document.querySelector('[data-products-tbody]');

  if (!productsCache.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Nenhum produto cadastrado.</div></td></tr>';
    return;
  }

  tbody.innerHTML = productsCache
    .map(
      (product) => `
        <tr class="fade-in" data-product-row="${product.id}">
          <td>
            <div class="admin-product-thumb">
              ${product.imageUrl
                ? `<img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" />`
                : productImagePlaceholder()}
              <button class="admin-product-thumb-upload" type="button" data-upload-image="${product.id}" title="Alterar imagem" aria-label="Alterar imagem do produto">${CAMERA_ICON}</button>
            </div>
          </td>
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
  tbody.querySelectorAll('[data-upload-image]').forEach((btn) => {
    btn.addEventListener('click', () => triggerImageUpload(btn.dataset.uploadImage));
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
    <div class="form-group">
      <label for="product-image">Imagem do produto</label>
      ${product?.imageUrl ? `<img class="product-image-preview" src="${product.imageUrl}" alt="Imagem atual de ${escapeHtml(product.name)}" />` : ''}
      <input class="form-control" id="product-image" type="file" accept="${ALLOWED_PRODUCT_IMAGE_TYPES.join(',')}" />
      <p class="form-hint">JPEG, PNG ou WebP. Máximo 5MB.</p>
      <p class="form-error"></p>
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
      const imageInput = content.querySelector('#product-image');

      const name = nameInput.value.trim();
      const categoryId = categoryInput.value;
      const imageFile = imageInput.files[0] || null;
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
      if (imageFile) {
        const imageError = validateProductImageFile(imageFile);
        if (imageError) {
          imageInput.closest('.form-group').classList.add('has-error');
          imageInput.closest('.form-group').querySelector('.form-error').textContent = imageError;
          hasError = true;
        }
      }
      if (hasError) return;

      const payload = { categoryId, name, description: descriptionInput.value.trim() };

      try {
        let productId = product?.id;
        if (isEdit) {
          await apiPut(`/products/${productId}`, payload);
        } else {
          const created = await apiPost('/products', payload);
          productId = created.id;
        }

        if (imageFile) {
          await apiUploadFile(`/products/${productId}/image`, imageFile);
        }

        if (isEdit) {
          showToast('Produto atualizado com sucesso', 'success');
          closeModal();
          await loadProducts();
        } else {
          showToast('Produto criado com sucesso! Agora adicione uma variação para começar a vender.', 'success');
          closeModal();
          await loadProducts();
          // Fluxo direto: pula a listagem de variações e abre o form de
          // criação já vinculado ao produto recém-criado.
          openVariantFormModal(productId, null);
        }
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
      : '<p class="empty-state empty-state--spacious">Nenhuma variação cadastrada.</p>';

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
    <h3 class="modal-subtitle">Variações de ${escapeHtml(product.name)}</h3>
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
  const product = productsCache.find((p) => p.id === productId);
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

  const modalTitle = isEdit
    ? 'Editar Variação'
    : product
      ? `Nova Variação — ${product.name}`
      : 'Nova Variação';

  openModal({
    title: modalTitle,
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
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">Não foi possível carregar os produtos.</div></td></tr>';
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
