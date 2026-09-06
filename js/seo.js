const SEO_SITE_URL = 'https://gabikids.vercel.app';
const SEO_DEFAULT_IMAGE = `${SEO_SITE_URL}/img/hero-banner.png`;

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
}

function upsertCanonical(url) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = url;
}

function setStructuredData(id, data) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

function applySeoMetadata({ title, description, url, image = SEO_DEFAULT_IMAGE, type = 'website' }) {
  document.title = title;
  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
  upsertCanonical(url);
}

function minimumVariantPrice(product) {
  const prices = (product.variants || [])
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite);
  return prices.length ? Math.min(...prices) : null;
}

function applyProductSeo(product) {
  const productUrl = `${SEO_SITE_URL}/product.html?id=${encodeURIComponent(product.id)}`;
  const description = (product.description || `${product.name} na GabiKids. Confira tamanhos, preço e disponibilidade.`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  const image = product.imageUrl || SEO_DEFAULT_IMAGE;
  const price = minimumVariantPrice(product);
  const inStock = (product.variants || []).some((variant) => Number(variant.stock) > 0);
  applySeoMetadata({
    title: `${product.name} | GabiKids`,
    description,
    url: productUrl,
    image,
    type: 'product',
  });

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image: [image],
    sku: `GK-${String(product.id).slice(0, 8).toUpperCase()}`,
    category: product.categoryName || undefined,
    brand: { '@type': 'Brand', name: 'GabiKids' },
  };

  if (price !== null) {
    productSchema.offers = {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'BRL',
      price: price.toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    };
  }

  setStructuredData('product-schema', productSchema);
  setStructuredData('breadcrumb-schema', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SEO_SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Loja', item: `${SEO_SITE_URL}/shop.html` },
      { '@type': 'ListItem', position: 3, name: product.name, item: productUrl },
    ],
  });
}

function applyShopSeo(categories) {
  const categoryId = new URLSearchParams(window.location.search).get('category');
  const category = categoryId && categories.find((item) => String(item.id) === categoryId);
  if (!category) return;

  const url = `${SEO_SITE_URL}/shop.html?category=${encodeURIComponent(category.id)}`;
  const title = `${category.name} infantil | GabiKids`;
  const description = `Compre ${category.name} infantil na GabiKids. Encontre moda infantil com estilo, qualidade e carinho.`;
  applySeoMetadata({ title, description, url });
  setStructuredData('breadcrumb-schema', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SEO_SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Loja', item: `${SEO_SITE_URL}/shop.html` },
      { '@type': 'ListItem', position: 3, name: category.name, item: url },
    ],
  });
}
