const HOME_PRODUCT_PREVIEW_COUNT = 8;
const HERO_SLIDE_INTERVAL = 4000;
const HOME_EDITORIAL_PRODUCT_IDS = [
  'cced2d1c-3e1f-4cb0-8f9b-b4dae8beb596',
  '5c142349-6663-407d-b10d-43bcb2dc68db',
  '1fb65825-b47f-446e-b434-b1bb32687849',
];

function initHeroCarousel() {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const slides = Array.from(hero.querySelectorAll('[data-hero-slide]'));
  const dots = Array.from(hero.querySelectorAll('[data-hero-dot]'));
  const arrows = Array.from(hero.querySelectorAll('[data-hero-direction]'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = 0;
  let timerId = null;
  let isPointerOverHero = false;

  function stopTimer() {
    if (timerId === null) return;
    window.clearInterval(timerId);
    timerId = null;
  }

  function startTimer() {
    stopTimer();
    if (reducedMotion.matches || isPointerOverHero) return;

    timerId = window.setInterval(() => {
      goToSlide(activeIndex + 1);
    }, HERO_SLIDE_INTERVAL);
  }

  function goToSlide(index, restartTimer = false) {
    activeIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });

    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-current', String(isActive));
    });

    if (restartTimer) startTimer();
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      goToSlide(index, true);
    });
  });

  arrows.forEach((arrow) => {
    arrow.addEventListener('click', () => {
      const offset = arrow.dataset.heroDirection === 'next' ? 1 : -1;
      const targetIndex = (activeIndex + offset + dots.length) % dots.length;

      dots[targetIndex].click();
    });
  });

  hero.addEventListener('mouseenter', () => {
    isPointerOverHero = true;
    stopTimer();
  });

  hero.addEventListener('mouseleave', () => {
    isPointerOverHero = false;
    startTimer();
  });

  reducedMotion.addEventListener('change', startTimer);
  goToSlide(0);
  startTimer();
}

function normalizeText(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

let categoriesPromise = null;

function loadCategories() {
  if (!categoriesPromise) {
    categoriesPromise = apiGet('/categories').catch((error) => {
      categoriesPromise = null;
      throw error;
    });
  }
  return categoriesPromise;
}

async function renderVaralLinks() {
  const links = document.querySelectorAll('[data-varal-link]');
  if (!links.length) return;
  try {
    const categories = await loadCategories();
    links.forEach((link) => {
      const target = normalizeText(link.dataset.varalLink);
      const segment = categories.find(
        (category) => !category.parentId && normalizeText(category.name) === target,
      );
      if (segment) {
        link.href = `shop.html?category=${segment.id}`;
      }
    });
  } catch (error) {
    // Mantém o href padrão (shop.html) definido no HTML
  }
}

function renderEditorial(products) {
  const root = document.querySelector('[data-editorial]');
  if (!root) return;

  const list = products
    .map((product) => {
      const price = lowestVariantPrice(product);
      const priceLabel = price === null ? 'Indisponível' : formatPrice(price);
      const media = product.imageUrl
        ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />`
        : productImagePlaceholder();
      return `
        <a class="editorial-item" href="product.html?id=${product.id}">
          <span class="editorial-item-media">${media}</span>
          <span class="editorial-item-info">
            <span class="editorial-item-category">${escapeHtml(product.categoryName || '')}</span>
            <span class="editorial-item-name">${escapeHtml(product.name)}</span>
            <span class="editorial-item-price">${priceLabel}</span>
          </span>
        </a>
      `;
    })
    .join('');

  root.innerHTML = `
    <div class="editorial-feature">
      <div class="editorial-copy">
        <div class="editorial-eyebrow">Edição da estação</div>
        <h2 class="editorial-title">Looks de Verão</h2>
        <p class="editorial-text">Modelos leves e confortáveis para aproveitar os dias mais quentes.</p>
      </div>
      <a class="editorial-feature-media" href="shop.html" aria-label="Confira todos os produtos">
        <img src="img/card-verao.jpg" alt="Look infantil de verão" loading="lazy" />
        <span class="editorial-feature-cta">confira <span aria-hidden="true">→</span></span>
      </a>
    </div>
    <div class="editorial-list">${list}</div>
  `;
}

async function renderSummerEditorial() {
  const requests = HOME_EDITORIAL_PRODUCT_IDS.map((id) => apiGet(`/products/${id}`));
  const results = await Promise.allSettled(requests);
  const products = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  renderEditorial(products);
}

async function renderBestSellers() {
  const grid = document.querySelector('[data-product-grid]');
  try {
    const response = await apiGet(`/products?page=0&size=${HOME_PRODUCT_PREVIEW_COUNT}&categoryId=26ccc12e-fa10-4369-bee4-f67ce2f82e41`);
    const products = response.content;
    if (!products.length) {
      grid.innerHTML = '<p class="empty-state">Nenhum produto disponível no momento.</p>';
      return;
    }
    grid.innerHTML = products.map((product) => buildProductCard(product)).join('');
  } catch (error) {
    grid.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos.</p>';
  }
}

function initNewsletterForm() {
  const form = document.querySelector('[data-newsletter-form]');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('Inscrição realizada com sucesso!', 'success');
    form.reset();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  renderVaralLinks();
  renderBestSellers();
  renderSummerEditorial();
  initNewsletterForm();
});
