let categoriesCache = [];

function formatAdminDate(isoString) {
  return new Date(isoString).toLocaleDateString('pt-BR');
}

function renderCategoriesTable() {
  const tbody = document.querySelector('[data-categories-tbody]');

  if (!categoriesCache.length) {
    tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">Nenhuma categoria cadastrada.</div></td></tr>';
    return;
  }

  tbody.innerHTML = categoriesCache
    .map(
      (category) => `
        <tr class="fade-in" data-category-row="${category.id}">
          <td>${escapeHtml(category.name)}</td>
          <td>${formatAdminDate(category.createdAt)}</td>
          <td>
            <div class="admin-table-actions">
              <button class="icon-btn" type="button" disabled title="Edição não disponível na API">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn icon-btn-danger" type="button" data-delete-category="${category.id}" title="Remover categoria">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');

  tbody.querySelectorAll('[data-delete-category]').forEach((button) => {
    button.addEventListener('click', () => confirmDeleteCategory(button.dataset.deleteCategory));
  });
}

function confirmDeleteCategory(id) {
  const category = categoriesCache.find((c) => c.id === id);
  openModal({
    title: 'Remover categoria',
    content: `<p>Tem certeza que deseja remover a categoria <strong>${escapeHtml(category?.name || '')}</strong>? Essa ação não pode ser desfeita.</p>`,
    confirmLabel: 'Remover',
    onConfirm: async () => {
      try {
        await apiDelete(`/categories/${id}`);
        closeModal();
        showToast('Categoria removida com sucesso', 'success');
        await loadCategories();
      } catch (error) {
        showToast(error.message || 'Não foi possível remover a categoria', 'error');
      }
    },
  });
}

function openNewCategoryModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-group">
      <label for="new-category-name">Nome da categoria</label>
      <input class="form-control" id="new-category-name" type="text" maxlength="100" required />
      <p class="form-error"></p>
    </div>
  `;

  openModal({
    title: 'Nova Categoria',
    content,
    confirmLabel: 'Criar',
    onConfirm: async () => {
      const input = content.querySelector('#new-category-name');
      const name = input.value.trim();
      const group = input.closest('.form-group');

      if (!name) {
        group.classList.add('has-error');
        group.querySelector('.form-error').textContent = 'Informe o nome da categoria';
        return;
      }

      try {
        await apiPost('/categories', { name });
        closeModal();
        showToast('Categoria criada com sucesso', 'success');
        await loadCategories();
      } catch (error) {
        showToast(error.message || 'Não foi possível criar a categoria', 'error');
      }
    },
  });
}

async function loadCategories() {
  const tbody = document.querySelector('[data-categories-tbody]');
  try {
    categoriesCache = await apiGet('/categories');
    renderCategoriesTable();
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">Não foi possível carregar as categorias.</div></td></tr>';
    showToast(error.message || 'Erro ao carregar categorias', 'error');
  }
}

async function initCategoriesPage() {
  if (!requireAdmin()) return;
  document.querySelector('[data-new-category-btn]').addEventListener('click', openNewCategoryModal);
  await loadCategories();
}

document.addEventListener('DOMContentLoaded', initCategoriesPage);
