import { writeFile } from 'node:fs/promises';

const siteUrl = (process.env.SITE_URL || 'https://gabikids.vercel.app').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'https://gabikids.duckdns.org').replace(/\/$/, '');
const pageSize = 100;

const staticEntries = [
  ['/', 'weekly', '1.0'],
  ['/shop.html', 'daily', '0.9'],
  ['/politica-de-privacidade.html', 'yearly', '0.3'],
  ['/termos-de-uso.html', 'yearly', '0.3'],
  ['/politica-de-troca-e-devolucao.html', 'yearly', '0.3'],
  ['/politica-de-cookies.html', 'yearly', '0.3'],
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function fetchJson(path) {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) throw new Error(`API respondeu ${response.status} para ${path}`);
  return response.json();
}

async function getAllProducts() {
  const products = [];
  let page = 0;
  let totalPages = 1;
  do {
    const result = await fetchJson(`/products?page=${page}&size=${pageSize}`);
    if (!Array.isArray(result.content)) throw new Error('Resposta de produtos inválida');
    products.push(...result.content);
    totalPages = Number(result.totalPages) || 1;
    page += 1;
  } while (page < totalPages);
  return products;
}

const [products, categories] = await Promise.all([
  getAllProducts(),
  fetchJson('/categories'),
]);
if (!Array.isArray(categories)) throw new Error('Resposta de categorias inválida');
const entries = [
  ...staticEntries,
  ...categories.map((category) => [`/shop.html?category=${encodeURIComponent(category.id)}`, 'weekly', '0.7']),
  ...products.map((product) => [`/product.html?id=${encodeURIComponent(product.id)}`, 'weekly', '0.8']),
];
const urls = entries.map(([path, changefreq, priority]) => `  <url>
    <loc>${escapeXml(`${siteUrl}${path}`)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

await writeFile(new URL('../sitemap.xml', import.meta.url), xml, 'utf8');
console.log(`sitemap.xml gerado com ${products.length} produto(s), ${categories.length} categoria(s) e ${staticEntries.length} página(s) estática(s).`);
