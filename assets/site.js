/* Halaman bio cupuberlari: membaca data.json lalu menggambar semuanya.
   Admin panel mengirim data draf lewat postMessage untuk pratinjau langsung. */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var STATE = { tab: 'links', cat: 'Semua', data: null };
  var PREVIEW = /[?&]preview=1/.test(location.search);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (!u) return '#';
    if (/^(https?:|mailto:|tel:|#|assets\/|\.\/|\/)/i.test(u)) return u;
    if (/^(javascript|data|vbscript):/i.test(u)) return '#';
    return 'https://' + u;
  }
  function isImg(v) { return /^(https?:\/\/|assets\/|data:image\/)/.test(String(v || '')); }

  // ikon: nama dari pustaka, "emoji:🏃", atau gambar (URL / assets/... / data:)
  function iconHTML(v, cls) {
    v = String(v || '');
    if (!v) return window.iconSVG('link', cls);
    if (v.indexOf('emoji:') === 0) return '<span class="emo">' + esc(v.slice(6)) + '</span>';
    if (isImg(v)) return '<img src="' + esc(v) + '" alt="" loading="lazy">';
    return window.iconSVG(v, cls) || window.iconSVG('link', cls);
  }

  var loadedFonts = {};
  function loadFonts(t) {
    [t.displayFont, t.bodyFont].forEach(function (f) {
      if (!f || loadedFonts[f]) return;
      loadedFonts[f] = 1;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
      document.head.appendChild(l);
    });
  }

  function applyTheme(t) {
    var r = document.documentElement.style;
    var map = { bg: '--bg', hero: '--hero', panel: '--panel', card: '--card', accent: '--accent', ink: '--ink', panelInk: '--panel-ink', accentInk: '--accent-ink' };
    if (!t.accentInk) r.setProperty('--accent-ink', t.ink || '#22301A');
    Object.keys(map).forEach(function (k) { if (t[k]) r.setProperty(map[k], t[k]); });
    if (t.displayFont) r.setProperty('--display', '"' + t.displayFont + '", Impact, "Arial Narrow", sans-serif');
    if (t.bodyFont) r.setProperty('--body', '"' + t.bodyFont + '", system-ui, -apple-system, sans-serif');
    var px = { titleSize: '--title', subtitleSize: '--subtitle', sectionSize: '--section', bodySize: '--text', linkSize: '--link', statSize: '--stat', radius: '--r' };
    Object.keys(px).forEach(function (k) { if (t[k] != null && t[k] !== '') r.setProperty(px[k], (+t[k]) + 'px'); });
    // warna teks redup di panel mengikuti warna teks panel
    var ink = t.panelInk || '#FFFFFF';
    r.setProperty('--muted', hexA(ink, 0.62));
    r.setProperty('--line', hexA(ink, 0.12));
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t.hero || '#C8D6B2';
    loadFonts(t);
  }
  function hexA(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 'rgba(255,255,255,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function parsePrice(s) { var n = String(s || '').replace(/[^0-9]/g, ''); return n ? +n : 0; }

  function render() {
    var d = STATE.data; if (!d) return;
    var t = d.theme || {}, p = d.profile || {};
    applyTheme(t);
    if (d.seo) {
      document.title = d.seo.title || 'cupuberlari';
      var md = document.querySelector('meta[name="description"]'); if (md) md.content = d.seo.description || '';
    }
    var links = (d.links || []).filter(function (l) { return l.visible !== false; });
    var prods = (d.products || []).filter(function (x) { return x.visible !== false; });
    var cats = ['Semua'].concat(prods.map(function (x) { return x.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; }));
    if (cats.indexOf(STATE.cat) < 0) STATE.cat = 'Semua';
    var shown = prods.filter(function (x) { return STATE.cat === 'Semua' || x.category === STATE.cat; });
    var stats = (d.stats || []).filter(function (s) { return s.value || s.label; });
    var initials = ((p.nameTop || '') + ' ' + (p.nameBottom || '')).trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();

    var h = '';
    h += '<header class="hero">';
    h += '<div class="hero-top">' + (p.shareButton !== false ? '<button class="sq" type="button" id="share" aria-label="Bagikan halaman ini">' + window.iconSVG('arrow-up-right') + '</button>' : '<span></span>');
    h += '<div class="avatar">' + (p.avatar ? '<img src="' + esc(p.avatar) + '" alt="">' : '<span>' + esc(initials || 'C') + '</span>') + '</div></div>';
    h += '<div class="hero-text"><h1 class="name' + (t.uppercase !== false ? ' up' : '') + '">' + esc(p.nameTop) + (p.nameBottom ? '<br>' + esc(p.nameBottom) : '') + '</h1>';
    if (p.subtitle) h += '<p class="sub">' + esc(p.subtitle) + '</p>';
    h += '</div>';
    h += '<div class="photo">' + (p.photo ? '<img src="' + esc(p.photo) + '" alt="">' : '<div class="ph">' + bigRunner() + '</div>') + '</div>';
    h += '<div class="badges">' + (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '');
    (p.socials || []).forEach(function (s) {
      if (!s.url) return;
      var nm = (window.ICONS[s.icon] && window.ICONS[s.icon].n) || 'Tautan';
      h += '<a class="soc" href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(nm) + '">' + iconHTML(s.icon) + '</a>';
    });
    h += '</div></header>';

    h += '<main class="panel">';
    if (prods.length) {
      h += '<div class="tabs" role="tablist">';
      h += '<button role="tab" type="button" data-tab="links" aria-selected="' + (STATE.tab === 'links') + '">' + esc((d.tabs && d.tabs.links) || 'Link') + '</button>';
      h += '<button role="tab" type="button" data-tab="products" aria-selected="' + (STATE.tab === 'products') + '">' + esc((d.tabs && d.tabs.products) || 'Produk') + '<b>' + prods.length + '</b></button>';
      h += '</div>';
    }
    if (STATE.tab === 'links' || !prods.length) {
      if (stats.length) {
        h += '<div class="sec"><h2>' + esc(d.statsTitle || 'Statistik') + '</h2></div>';
        h += '<div class="stats n' + Math.min(stats.length, 4) + '">' + stats.map(function (s) {
          return '<div class="stat"><b>' + esc(s.value) + '</b><i></i><span>' + esc(s.label) + '</span></div>';
        }).join('') + '</div>';
      }
      h += '<div class="sec"><h2>' + esc(d.linksTitle || 'Link') + '</h2>' + (prods.length ? '<a href="#produk" data-tab="products">Lihat produk ›</a>' : '') + '</div>';
      h += links.length ? '<nav class="links">' + links.map(function (l) {
        var href = safeUrl(l.url), internal = href === '#produk';
        return '<a class="lk" href="' + esc(href) + '"' + (internal ? ' data-tab="products"' : ' target="_blank" rel="noopener"') + '>' +
          '<span class="ico">' + iconHTML(l.icon) + '</span>' +
          '<span class="tx"><b>' + esc(l.title) + '</b>' + (l.subtitle ? '<span>' + esc(l.subtitle) + '</span>' : '') + '</span>' +
          '<span class="go">' + (l.tag ? esc(l.tag) : '') + '<i>' + window.iconSVG('arrow-up-right') + '</i></span></a>';
      }).join('') + '</nav>' : '<p class="empty">Belum ada link.</p>';
    } else {
      h += '<div class="sec"><h2>' + esc(d.productsTitle || 'Produk') + '</h2><span>' + shown.length + ' produk</span></div>';
      if (cats.length > 2) h += '<div class="chips" role="group" aria-label="Kategori">' + cats.map(function (c) {
        return '<button type="button" data-cat="' + esc(c) + '" aria-pressed="' + (c === STATE.cat) + '">' + esc(c) + '</button>';
      }).join('') + '</div>';
      h += shown.length ? '<div class="grid">' + shown.map(function (x) {
        var now = parsePrice(x.price), old = parsePrice(x.oldPrice), disc = old > now && now ? Math.round((1 - now / old) * 100) : 0;
        return '<article class="pc"><div class="img">' + (x.image ? '<img src="' + esc(x.image) + '" alt="' + esc(x.name) + '" loading="lazy">' : window.iconSVG('shopping-bag')) +
          (x.badge ? '<span class="pb">' + esc(x.badge) + '</span>' : '') + (disc ? '<span class="disc">-' + disc + '%</span>' : '') + '</div>' +
          '<div class="bd">' + (x.shop ? '<span class="shop">' + esc(x.shop) + '</span>' : '') + '<span class="nm">' + esc(x.name) + '</span>' +
          '<span class="pr">' + (x.price ? '<b>' + esc(x.price) + '</b>' : '') + (x.oldPrice ? '<s>' + esc(x.oldPrice) + '</s>' : '') + '</span>' +
          '<a class="buy" href="' + esc(safeUrl(x.url)) + '" target="_blank" rel="noopener sponsored">' + esc(x.cta || 'Beli sekarang') + window.iconSVG('arrow-up-right') + '</a></div></article>';
      }).join('') + '</div>' : '<p class="empty">Belum ada produk di kategori ini.</p>';
      if (d.productsNote) h += '<p class="note">' + esc(d.productsNote) + '</p>';
    }
    if (d.footer) h += '<p class="foot">' + esc(d.footer) + '</p>';
    h += '</main>';
    if (d.cta && d.cta.show !== false && d.cta.text) h += '<div class="ctaw"><a class="cta" href="' + esc(safeUrl(d.cta.url)) + '" target="_blank" rel="noopener">' + esc(d.cta.text) + '</a></div>';
    app.innerHTML = h;
  }

  function bigRunner() {
    return '<svg viewBox="0 0 120 150" fill="currentColor" aria-hidden="true"><circle cx="72" cy="22" r="14"/>' +
      '<path d="M58 44c6-4 15-4 21 1l14 12 14-4c5-1 9 4 6 8l-4 5-20 4-9-7-7 21 15 15c3 3 4 7 3 11l-6 33h-14l5-30-17-15-9 21-26 7c-5 1-9-5-5-9l5-5 18-4 16-42-8 3-9 14c-3 5-11 3-11-3l1-4 12-20z"/></svg>';
  }

  function toast(m) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }

  app.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tab]');
    if (tb) { e.preventDefault(); STATE.tab = tb.getAttribute('data-tab'); if (!PREVIEW) history.replaceState(null, '', STATE.tab === 'products' ? '#produk' : '#'); render(); window.scrollTo({ top: document.querySelector('.panel').offsetTop - 20, behavior: 'smooth' }); return; }
    var c = e.target.closest('[data-cat]');
    if (c) { STATE.cat = c.getAttribute('data-cat'); render(); return; }
    if (e.target.closest('#share')) {
      var url = location.href.split('#')[0];
      if (navigator.share) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Link disalin'); }, function () { toast(url); });
    }
  });
  window.addEventListener('hashchange', function () { STATE.tab = location.hash === '#produk' ? 'products' : 'links'; render(); });

  // pratinjau dari admin panel
  window.addEventListener('message', function (e) {
    if (!PREVIEW || !e.data || e.data.type !== 'bio-preview') return;
    STATE.data = e.data.data; if (e.data.tab) STATE.tab = e.data.tab; render();
  });

  STATE.tab = location.hash === '#produk' ? 'products' : 'links';
  if (PREVIEW) { if (window.parent !== window) window.parent.postMessage({ type: 'bio-ready' }, '*'); }
  fetch('data.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
    if (!STATE.data) { STATE.data = d; render(); }
  }).catch(function () { app.innerHTML = '<p style="padding:40px;text-align:center">Gagal memuat data.json</p>'; });
})();
