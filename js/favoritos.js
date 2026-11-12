function favoritesEmptyMarkup() {
  return `
    <div class="favorites-empty">
      <span class="ms" aria-hidden="true">favorite</span>
      <h2>Nenhum favorito ainda</h2>
      <p>Guarde aqui as peças que você mais gostou.</p>
      <a class="btn btn-primary" href="shop.html">Ver a loja</a>
    </div>`;
}

function renderFavorites(products) {
  const grid = document.querySelector('[data-favorites-grid]');
  grid.classList.toggle('is-empty', products.length === 0);
  grid.innerHTML = products.length
    ? products.map((product) => buildProductCard(product)).join('')
    : favoritesEmptyMarkup();
}

async function initFavoritesPage() {
  const ids = getWishlistProductIds();
  if (!ids.length) {
    renderFavorites([]);
    return;
  }

  const results = await Promise.allSettled(ids.map((id) => apiGet(`/products/${encodeURIComponent(id)}`)));
  const staleIds = [];
  const products = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value?.active === false) staleIds.push(ids[index]);
      else if (result.value) products.push(result.value);
    } else if (result.reason?.status === 404) {
      staleIds.push(ids[index]);
    }
  });
  if (staleIds.length) removeWishlistProductIds(staleIds);
  renderFavorites(products);
}

document.addEventListener('wishlist-changed', (event) => {
  const { productId, isWishlisted } = event.detail || {};
  if (!productId || isWishlisted !== false) return;
  const card = document.querySelector(`.product-card[data-product-id="${CSS.escape(String(productId))}"]`);
  if (!card) return;
  card.classList.add('is-leaving');
  setTimeout(() => {
    card.remove();
    const grid = document.querySelector('[data-favorites-grid]');
    if (!grid.querySelector('.product-card')) renderFavorites([]);
  }, 220);
});

document.addEventListener('DOMContentLoaded', initFavoritesPage);
