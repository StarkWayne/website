/**
 * Stark Wayne — article builder.
 *
 * Reads article markdown (source of truth lives in the marketing workspace,
 * `marketing/content/articles/*.md`), renders each PUBLISHED article to a static
 * page that mirrors the hand-authored site, and regenerates the /articles index,
 * sitemap.xml and robots.txt. Dependency-free — plain Node, no toolchain.
 *
 * Usage:
 *   SW_ARTICLES_SRC="/abs/path/to/marketing/content/articles" node scripts/build-articles.mjs
 *   node scripts/build-articles.mjs --src "/abs/path/to/content/articles"
 *
 * Output goes into the repo this script lives in (override with SW_SITE_REPO).
 *
 * Article format (see marketing/content/articles/README.md):
 *   ---
 *   title: ...
 *   slug: ...
 *   date: 2026-08-24        # YYYY-MM-DD
 *   description: ...        # SEO meta (~150 chars)
 *   standfirst: ...         # on-page lead (optional)
 *   list: both              # a | b | both  (used by the email step, not here)
 *   status: published       # draft | published  (drafts are skipped)
 *   author: Stark Wayne     # optional; defaults to Stark Wayne
 *   ---
 *   body markdown...
 *   ## FAQ                  # optional; ### question, then the answer
 *   ### Is MPX changing?
 *   No. ...
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.SW_SITE_REPO ? path.resolve(process.env.SW_SITE_REPO) : path.resolve(__dirname, '..');
const BASE = 'https://starkwayne.co.uk';

function resolveSrc() {
  const argi = process.argv.indexOf('--src');
  if (argi !== -1 && process.argv[argi + 1]) return path.resolve(process.argv[argi + 1]);
  if (process.env.SW_ARTICLES_SRC) return path.resolve(process.env.SW_ARTICLES_SRC);
  die('No source dir. Set SW_ARTICLES_SRC or pass --src <dir> (the marketing content/articles folder).');
}
function die(msg) { console.error('build-articles: ' + msg); process.exit(1); }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return String(iso || '');
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

/* Typographer's quotes, so articles match the hand-set site. Run on text before esc. */
function smartQuotes(s) {
  let out = '';
  for (const c of String(s == null ? '' : s)) {
    const prev = out[out.length - 1] || '';
    if (c === '"') out += (prev === '' || /[\s([{]/.test(prev)) ? '“' : '”';
    else if (c === "'") out += /[A-Za-z0-9)]/.test(prev) ? '’' : '‘';
    else out += c;
  }
  return out;
}
const escText = (s) => esc(smartQuotes(s));

/* ---- markdown (scoped subset: headings, paras, bold/italic, links, lists, quotes, hr, code) ---- */

function renderInline(s) {
  s = esc(smartQuotes(s));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

const isBlank = (l) => /^\s*$/.test(l);
const isHeading = (l) => /^(#{2,3})\s+/.test(l);
const isQuote = (l) => /^>\s?/.test(l);
const isUl = (l) => /^\s*[-*]\s+/.test(l);
const isOl = (l) => /^\s*\d+\.\s+/.test(l);
const isHr = (l) => /^---+\s*$/.test(l);

function renderBlocks(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    if (isHr(line)) { out.push('<hr>'); i++; continue; }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) { const lvl = h[1].length; out.push(`<h${lvl}>${renderInline(h[2].trim())}</h${lvl}>`); i++; continue; }
    if (isQuote(line)) {
      const buf = [];
      while (i < lines.length && isQuote(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${renderInline(buf.join(' ').trim())}</blockquote>`);
      continue;
    }
    if (isUl(line)) {
      const items = [];
      while (i < lines.length && isUl(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      out.push(`<ul>${items.map((it) => `<li>${renderInline(it.trim())}</li>`).join('')}</ul>`);
      continue;
    }
    if (isOl(line)) {
      const items = [];
      while (i < lines.length && isOl(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push(`<ol>${items.map((it) => `<li>${renderInline(it.trim())}</li>`).join('')}</ol>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && !isBlank(lines[i]) && !isHeading(lines[i]) && !isQuote(lines[i])
      && !isUl(lines[i]) && !isOl(lines[i]) && !isHr(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${renderInline(buf.join(' ').trim())}</p>`);
  }
  return out.join('\n');
}

function plain(md) {
  return String(md || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---- parse ---- */

function parseFrontmatter(s) {
  const o = {};
  for (const line of s.split('\n')) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    v = v.replace(/^["']|["']$/g, '');
    o[k] = v;
  }
  return o;
}

function splitFaq(body) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex((l) => /^##\s+FAQs?\s*$/i.test(l.trim()));
  if (idx === -1) return { main: body, faqs: [] };
  const main = lines.slice(0, idx).join('\n');
  const faqs = [];
  let cur = null;
  for (const l of lines.slice(idx + 1)) {
    const h = l.match(/^###\s+(.*)$/);
    if (h) { if (cur) faqs.push(cur); cur = { q: h[1].trim(), a: [] }; }
    else if (cur) cur.a.push(l);
  }
  if (cur) faqs.push(cur);
  return { main, faqs: faqs.map((f) => ({ q: f.q, aMd: f.a.join('\n').trim() })) };
}

function parseArticle(raw, filename) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = m ? parseFrontmatter(m[1]) : {};
  const body = m ? m[2] : raw;
  const { main, faqs } = splitFaq(body);
  const slug = (data.slug || filename.replace(/\.md$/, '')).trim();
  return { ...data, slug, main, faqs };
}

/* ---- shared chrome (absolute paths — article pages live under /articles/) ---- */

const NAV = `<header class="nav">
  <div class="wrap">
    <a class="brand" href="/"><img src="/assets/sw-logo-simple.png" alt="Stark Wayne"></a>
    <div style="display:flex;align-items:center;gap:36px;">
      <nav class="nav-links" id="navlinks">
        <a href="/">Home</a>
        <a href="/how-we-work">How we work</a>
        <a href="/proof">Proof</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav>
      <a class="btn" href="/contact">Book a call</a>
      <button class="nav-toggle" aria-label="Menu" onclick="document.getElementById('navlinks').classList.toggle('open')">&#8801;</button>
    </div>
  </div>
</header>`;

const FOOTER = `<footer>
  <div class="wrap">
    <div class="foot-top">
      <div>
        <img src="/assets/sw-logo-simple.png" alt="Stark Wayne">
        <p style="max-width:32ch;margin:0;color:var(--graphite);">The people you come to when you need something built.</p>
      </div>
      <div class="foot-links">
        <a href="/">Home</a>
        <a href="/how-we-work">How we work</a>
        <a href="/proof">Proof</a>
        <a href="/about">About</a>
        <a href="/articles">Articles</a>
        <a href="/contact">Contact</a>
        <a href="https://mpx.co.uk">MPX &#8599;</a>
      </div>
    </div>
    <div class="foot-legal">
      <span>Stark Wayne Ltd · Registered in England and Wales, company no. 09495737 · Woodland Lodge, Dunston Business Village, Stafford Road, Penkridge, Staffordshire, ST18 9AB</span>
      <span><a href="mailto:hello@starkwayne.co.uk">hello@starkwayne.co.uk</a> · 01785 50 80 60</span>
    </div>
  </div>
</footer>`;

function head({ title, desc, url, isoDate, ogType }) {
  const t = esc(title), d = esc(desc);
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Stark Wayne">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://starkwayne.co.uk/assets/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
${isoDate ? `<meta property="article:published_time" content="${isoDate}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="https://starkwayne.co.uk/assets/og-image.png">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/styles.css">
</head>`;
}

/* ---- pages ---- */

function renderFaq(faqs) {
  const items = faqs.map((f) => `        <div class="faq-item">
          <h3>${renderInline(f.q)}</h3>
${renderBlocks(f.aMd)}
        </div>`).join('\n');
  return `      <div class="faq">
        <h2>Frequently asked</h2>
${items}
      </div>`;
}

function articleLd(a, url) {
  return safeJson({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.title,
    description: a.description,
    datePublished: a.date,
    author: { '@type': 'Organization', name: 'Stark Wayne', url: BASE },
    publisher: { '@type': 'Organization', name: 'Stark Wayne', logo: { '@type': 'ImageObject', url: `${BASE}/assets/og-image.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: `${BASE}/assets/og-image.png`,
  });
}
function faqLd(faqs) {
  return safeJson({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: plain(f.aMd) },
    })),
  });
}

function articlePage(a) {
  const url = `${BASE}/articles/${a.slug}`;
  const faqBlock = a.faqs.length ? '\n' + renderFaq(a.faqs) : '';
  const faqScript = a.faqs.length ? `\n<script type="application/ld+json">${faqLd(a.faqs)}</script>` : '';
  return `${head({ title: `${a.title} — Stark Wayne`, desc: a.description, url, isoDate: a.date, ogType: 'article' })}
<body>

${NAV}

<main>

  <section class="page-head article-head">
    <div class="wrap narrow">
      <p class="eyebrow">Article</p>
      <h1>${escText(a.title)}</h1>
      ${a.standfirst ? `<p class="lead">${escText(a.standfirst)}</p>` : ''}
      <p class="article-meta">${esc(a.author || 'Stark Wayne')} &middot; <time datetime="${a.date}">${fmtDate(a.date)}</time></p>
    </div>
  </section>

  <section>
    <div class="wrap narrow">
      <div class="article-body">
${renderBlocks(a.main)}
      </div>${faqBlock}
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>The people you come to.</h2>
      <p class="lead">Tell us what you need built, and we&rsquo;ll call you back within the hour.</p>
      <a class="btn light" href="/contact">Book a call</a>
    </div>
  </section>

</main>

${FOOTER}

<script type="application/ld+json">${articleLd(a, url)}</script>${faqScript}
<script src="/assets/reveal.js" defer></script>
</body>
</html>
`;
}

function indexPage(articles) {
  const url = `${BASE}/articles`;
  const list = articles.map((a) => `        <div class="article-item">
          <p class="date">${fmtDate(a.date)}</p>
          <h2><a href="/articles/${a.slug}">${escText(a.title)}</a></h2>
          <p>${escText(a.standfirst || a.description)}</p>
        </div>`).join('\n');
  return `${head({ title: 'Articles — Stark Wayne', desc: "Notes from the Stark Wayne team on building software real businesses run on — what we're building, and what we've learned since 2015.", url, ogType: 'website' })}
<body>

${NAV}

<main>

  <section class="page-head">
    <div class="wrap narrow">
      <p class="eyebrow">Articles</p>
      <h1>What we&rsquo;re building, and what we&rsquo;ve learned.</h1>
      <p class="lead">Notes from the team — the thinking behind the software, the odd opinion, and what a decade in production teaches you. New pieces regularly.</p>
    </div>
  </section>

  <section>
    <div class="wrap narrow">
      <div class="article-list">
${list || '        <p>First articles coming soon.</p>'}
      </div>
    </div>
  </section>

  <section class="cta">
    <div class="wrap">
      <h2>The people you come to.</h2>
      <p class="lead">Tell us what you need built, and we&rsquo;ll call you back within the hour.</p>
      <a class="btn light" href="/contact">Book a call</a>
    </div>
  </section>

</main>

${FOOTER}

<script src="/assets/reveal.js" defer></script>
</body>
</html>
`;
}

function sitemapXml(articles) {
  const core = ['/', '/how-we-work', '/proof', '/about', '/contact', '/articles'];
  const urls = core.map((p) => `  <url><loc>${BASE}${p}</loc></url>`);
  for (const a of articles) urls.push(`  <url><loc>${BASE}/articles/${a.slug}</loc><lastmod>${a.date}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

const ROBOTS = `User-agent: *
Allow: /

Sitemap: ${BASE}/sitemap.xml
`;

/* ---- main ---- */

function main() {
  const SRC = resolveSrc();
  if (!fs.existsSync(SRC)) die(`Source dir not found: ${SRC}`);

  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md');
  const all = files.map((f) => parseArticle(fs.readFileSync(path.join(SRC, f), 'utf8'), f));

  const published = all.filter((a) => String(a.status || '').toLowerCase() === 'published');
  for (const a of published) {
    for (const req of ['title', 'slug', 'date', 'description']) {
      if (!a[req]) die(`Article "${a.slug || '?'}" is missing required field: ${req}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) die(`Article "${a.slug}" has a bad date (need YYYY-MM-DD): ${a.date}`);
  }
  published.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));

  const outDir = path.join(REPO, 'articles');
  fs.mkdirSync(outDir, { recursive: true });

  for (const a of published) {
    fs.writeFileSync(path.join(outDir, `${a.slug}.html`), articlePage(a));
    console.log(`  article  /articles/${a.slug}`);
  }
  fs.writeFileSync(path.join(REPO, 'articles.html'), indexPage(published));
  fs.writeFileSync(path.join(REPO, 'sitemap.xml'), sitemapXml(published));
  fs.writeFileSync(path.join(REPO, 'robots.txt'), ROBOTS);

  const drafts = all.length - published.length;
  console.log(`build-articles: ${published.length} published, ${drafts} draft(s) skipped. Index + sitemap + robots written.`);
}

main();
