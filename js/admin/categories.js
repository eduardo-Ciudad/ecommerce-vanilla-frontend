const CATEGORY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.6 12.3L12.7 20a2 2 0 01-2.8 0l-7-7a2 2 0 010-2.8L10.8 2.5 20.6 3l.5 9.3z"/><circle cx="15.5" cy="7.5" r="1.5"/></svg>';
const CATEGORY_CARD_COLORS = ['', 'info', 'warning', 'success', 'purple'];

let categoriesCache = [];
let categoryProductCounts = {};

function renderCategoriesGrid() {
  const grid = document.querySelector('[data-categories-grid]');
  const subtitle = document.querySelector('[data-categories-subtitle]');

  subtitle.textContent = `${categoriesCache.length} categoria${categoriesCache.length === 1 ? '' : 's'} cadastrada${categoriesCache.length === 1 ? '' : 's'}`;

  if (!categoriesCache.length) {
    grid.innerHTML = '<div class="empty-state empty-state--full-row">Nenhuma categoria cadastrada.</div>';
    return;
  }

  grid.innerHTML = categoriesCache
    .map((category, index) => {
      const colorModifier = CATEGORY_CARD_COLORS[index % CATEGORY_CARD_COLORS.length];
      const iconClass = colorModifier ? ` category-card-icon--${colorModifier}` : '';
      const count = categoryProductCounts[category.id] || 0;

      return `
        <div class="category-card fade-in" data-category-row="${category.id}">
          <div class="category-card-info">
            <span class="category-card-icon${iconClass}">${CATEGORY_ICON}</span>
            <div>
              <div class="category-card-name">${escapeHtml(category.name)}</div>
              <div class="category-card-count">${count} produto${count === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div class="admin-table-actions">
            <button class="icon-btn" type="button" disabled title="Edição não disponível na API">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn icon-btn-danger" type="button" data-delete-category="${category.id}" title="Remover categoria">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-delete-category]').forEach((button) => {
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

async function loadCategoryProductCounts() {
  try {
    const response = await apiGet('/products?page=0&size=1000');
    categoryProductCounts = response.content.reduce((counts, product) => {
      counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
      return counts;
    }, {});
  } catch {
    categoryProductCounts = {};
  }
}

async function loadCategories() {
  const grid = document.querySelector('[data-categories-grid]');
  try {
    const [categories] = await Promise.all([apiGet('/categories'), loadCategoryProductCounts()]);
    categoriesCache = categories;
    renderCategoriesGrid();
  } catch (error) {
    grid.innerHTML = '<div class="empty-state empty-state--full-row">Não foi possível carregar as categorias.</div>';
    showToast(error.message || 'Erro ao carregar categorias', 'error');
  }
}

async function initCategoriesPage() {
  if (!requireAdmin()) return;
  document.querySelector('[data-new-category-btn]').addEventListener('click', openNewCategoryModal);
  await loadCategories();
}

document.addEventListener('DOMContentLoaded', initCategoriesPage);
