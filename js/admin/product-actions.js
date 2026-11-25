const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateProductImageFile(file) {
  if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return 'Formato inválido. Envie um arquivo JPEG, PNG ou WebP.';
  }
  if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
    return 'Arquivo muito grande. O tamanho máximo é 5MB.';
  }
  return null;
}

async function runProductChanged(onChanged, ...args) {
  return typeof onChanged === 'function' ? onChanged(...args) : null;
}

function triggerImageUpload(productId, onChanged) {
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
      await runProductChanged(onChanged, productId);
    } catch (error) {
      showToast(error.message || 'Não foi possível enviar a imagem', 'error');
    }
  });

  document.body.appendChild(input);
  input.click();
}

function productCategoryOptions(categories, selectedId) {
  return categories
    .map((category) => `<option value="${escapeAttr(category.id)}" ${category.id === selectedId ? 'selected' : ''}>${escapeHtml(category.name)}</option>`)
    .join('');
}

function openProductModal(product, categories, onChanged) {
  const isEdit = !!product;
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label for="product-name">Nome</label>
      <input class="form-control" id="product-name" type="text" maxlength="150" value="${product ? escapeAttr(product.name) : ''}" required />
      <p class="form-error"></p>
    </div>
    <div class="form-group">
      <label for="product-category">Categoria</label>
      <select class="form-control" id="product-category" required>
        <option value="">Selecione...</option>
        ${productCategoryOptions(categories, product?.categoryId)}
      </select>
      <p class="form-error"></p>
    </div>
    <div class="form-group">
      <label for="product-description">Descrição</label>
      <textarea class="form-control" id="product-description" rows="3">${product ? escapeHtml(product.description || '') : ''}</textarea>
    </div>
    <div class="form-group">
      <label for="product-image">Imagem do produto</label>
      ${product?.imageUrl ? `<img class="product-image-preview" src="${escapeAttr(product.imageUrl)}" alt="Imagem atual de ${escapeAttr(product.name)}" />` : ''}
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
        if (imageFile) await apiUploadFile(`/products/${productId}/image`, imageFile);

        showToast(isEdit
          ? 'Produto atualizado com sucesso'
          : 'Produto criado com sucesso! Agora adicione uma variação para começar a vender.', 'success');
        closeModal();
        await runProductChanged(onChanged, productId, { created: !isEdit });
      } catch (error) {
        showToast(error.message || 'Não foi possível salvar o produto', 'error');
      }
    },
  });
}

function confirmDeleteProduct(product, onChanged) {
  openModal({
    title: 'Desativar produto',
    content: `<p>Tem certeza que deseja desativar <strong>${escapeHtml(product?.name || '')}</strong>? Ele deixará de aparecer na loja.</p>`,
    confirmLabel: 'Desativar',
    onConfirm: async () => {
      try {
        await apiDelete(`/products/${product.id}`);
        closeModal();
        showToast('Produto desativado com sucesso', 'success');
        await runProductChanged(onChanged, product.id);
      } catch (error) {
        showToast(error.message || 'Não foi possível desativar o produto', 'error');
      }
    },
  });
}

function openVariantFormModal(product, variant, onChanged) {
  const isEdit = !!variant;
  const baseSizes = ['RN', 'P', 'M', 'G', 'GG', '1', '2', '3', '4', '6', '8', '10', '12', '14', '16', '18'];
  const selectedSize = variant?.size != null ? String(variant.size) : '';
  const sizes = selectedSize && !baseSizes.includes(selectedSize)
    ? [selectedSize, ...baseSizes]
    : baseSizes;
  const content = document.createElement('div');
  content.innerHTML = `
    ${isEdit && variant.color ? `<p class="form-hint"><strong>Cor:</strong> ${escapeHtml(variant.color)}</p>` : ''}
    <div class="form-group">
      <label for="variant-size">Tamanho</label>
      <select class="form-control" id="variant-size">
        ${sizes.map((size) => `<option value="${escapeAttr(size)}" ${selectedSize === size ? 'selected' : ''}>${escapeHtml(size)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label for="variant-price">Preço (R$)</label>
      <input class="form-control" id="variant-price" type="number" step="0.01" min="0.01" value="${variant ? escapeAttr(variant.price) : ''}" required />
      <p class="form-error"></p>
    </div>
    <div class="form-group">
      <label for="variant-stock">Estoque (unidades)</label>
      <input class="form-control" id="variant-stock" type="number" step="1" min="0" value="${variant ? escapeAttr(variant.stock) : ''}" required />
      <p class="form-error"></p>
    </div>
  `;

  openModal({
    title: isEdit ? 'Editar Variação' : product ? `Nova Variação — ${product.name}` : 'Nova Variação',
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
          await apiPost(`/products/${product.id}/variants`, payload);
          showToast('Variação adicionada com sucesso', 'success');
        }
        closeModal();
        await runProductChanged(onChanged, product.id);
      } catch (error) {
        showToast(error.message || 'Não foi possível salvar a variação', 'error');
      }
    },
  });
}

function confirmDeleteVariant(product, variantId, onChanged) {
  openModal({
    title: 'Remover variação',
    content: '<p>Tem certeza que deseja remover esta variação?</p>',
    confirmLabel: 'Remover',
    onConfirm: async () => {
      try {
        await apiDelete(`/variants/${variantId}`);
        closeModal();
        showToast('Variação removida com sucesso', 'success');
        await runProductChanged(onChanged, product.id);
      } catch (error) {
        showToast(error.message || 'Não foi possível remover a variação', 'error');
      }
    },
  });
}

async function resyncProduct(productId, button, onChanged) {
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add('is-loading');
  button.setAttribute('aria-busy', 'true');

  try {
    const result = await apiPost(`/bling/sync/product/${encodeURIComponent(productId)}`, {}, { timeoutMs: 90000 });
    const variantsSynced = Number(result.variantsSynced) || 0;
    const variantsZeroed = Number(result.variantsZeroed) || 0;
    const variantsFailed = Number(result.variantsFailed) || 0;
    let summary = `Produto atualizado: ${variantsSynced} ${variantsSynced === 1 ? 'variação sincronizada' : 'variações sincronizadas'}`;
    if (variantsZeroed > 0) {
      summary += `, ${variantsZeroed} ${variantsZeroed === 1 ? 'variação zerada' : 'variações zeradas'} (não ${variantsZeroed === 1 ? 'existe' : 'existem'} mais no Bling)`;
    }
    if (variantsFailed > 0) summary += `, ${variantsFailed} com falha`;

    showToast(summary, variantsFailed > 0 ? 'warning' : 'success');
    await runProductChanged(onChanged, productId);
  } catch (error) {
    if (error.status === 409) {
      showToast('Já existe uma sincronização com o Bling em andamento. Tente de novo quando ela terminar.', 'error');
    } else {
      showToast(error.message || 'Não foi possível ressincronizar o produto', 'error');
    }
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.removeAttribute('aria-busy');
    }
  }
}
