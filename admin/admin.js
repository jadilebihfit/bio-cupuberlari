/* Admin panel bio cupuberlari.
   - Login memakai fine-grained token GitHub (disimpan hanya di browser ini).
   - Semua perubahan disimpan sebagai draf lokal + dikirim ke pratinjau.
   - Publish = satu commit ke repo (data.json + gambar baru) lewat GitHub Git Data API.
     GitHub Pages lalu menerbitkan ulang halaman secara otomatis. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var toastT; function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3000); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var CFG = Object.assign({ owner: 'jadilebihfit', repo: 'bio-cupuberlari', branch: 'main', token: '' }, LS.get('bio-admin-cfg', {}));
  var DATA = null, BASE = '', TAB = 'profil', OPEN = {}, PVTAB = 'links', SITE = '';

  /* ---------- GitHub API ---------- */
  function gh(path, opt) {
    opt = opt || {};
    var h = { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + CFG.token, 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.body) h['Content-Type'] = 'application/json';
    return fetch('https://api.github.com' + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (r.status === 204) return null;
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
          return j;
        });
      });
  }
  var R = function () { return '/repos/' + CFG.owner + '/' + CFG.repo; };
  function b64ToText(b) { var bin = atob(b.replace(/\n/g, '')), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }

  /* ---------- login ---------- */
  function showLogin(err) {
    $('#shell').hidden = true; var l = $('#login'); l.hidden = false;
    l.innerHTML = '<div class="box"><h1>Admin<br>cupuberlari</h1>' +
      '<p class="muted">Hubungkan ke repo GitHub supaya tombol Publish bisa langsung memperbarui halaman bio.</p>' +
      (err ? '<div class="err">' + esc(err) + '</div>' : '') +
      '<div class="grid2"><label class="f" for="lg-owner">Pemilik repo<input id="lg-owner" value="' + esc(CFG.owner) + '"></label><label class="f" for="lg-repo">Nama repo<input id="lg-repo" value="' + esc(CFG.repo) + '"></label></div>' +
      '<label class="f" for="lg-token">Token GitHub<input id="lg-token" type="password" autocomplete="off" placeholder="github_pat_…" value="' + esc(CFG.token) + '"></label>' +
      '<details><summary class="small" style="cursor:pointer;font-weight:600">Cara membuat token (sekali saja)</summary><ol style="margin-top:10px">' +
      '<li>Buka <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a></li>' +
      '<li>Token name: <b>admin bio</b>, Expiration: sesuai keinginan.</li>' +
      '<li>Repository access: <b>Only select repositories</b> → pilih <b>' + esc(CFG.repo) + '</b>.</li>' +
      '<li>Permissions → Repository: <b>Contents</b> = Read and write, <b>Pages</b> = Read and write.</li>' +
      '<li>Klik Generate token, salin, tempel di atas.</li></ol></details>' +
      '<p class="tiny muted">Token hanya disimpan di browser ini dan dikirim langsung ke GitHub. Jangan bagikan token ke siapa pun.</p>' +
      '<div class="row"><button class="btn pri" type="button" id="lg-go">Hubungkan</button></div></div>';
  }
  document.addEventListener('click', function (e) {
    if (e.target.id !== 'lg-go') return;
    CFG.owner = $('#lg-owner').value.trim(); CFG.repo = $('#lg-repo').value.trim(); CFG.token = $('#lg-token').value.trim();
    if (!CFG.token) { showLogin('Isi token GitHub dulu.'); return; }
    e.target.disabled = true; e.target.textContent = 'Menghubungkan…';
    connect().catch(function (err) { showLogin(err.status === 401 ? 'Token tidak valid atau sudah kedaluwarsa.' : err.status === 404 ? 'Repo tidak ditemukan, atau token belum diberi akses ke repo ini.' : err.message); });
  });

  function connect() {
    return gh(R()).then(function (repo) {
      if (repo.permissions && repo.permissions.push === false) throw new Error('Token ini tidak punya izin menulis ke repo. Set Contents = Read and write.');
      CFG.branch = repo.default_branch || 'main'; LS.set('bio-admin-cfg', CFG);
      return Promise.all([loadData(), findSite()]);
    }).then(function () { boot(); });
  }
  function loadData() {
    return gh(R() + '/contents/data.json?ref=' + encodeURIComponent(CFG.branch)).then(function (f) { return JSON.parse(b64ToText(f.content)); })
      .catch(function (e) { if (e.status === 404) return fetch('../data.json', { cache: 'no-store' }).then(function (r) { return r.json(); }); throw e; })
      .then(function (d) {
        BASE = JSON.stringify(d); DATA = d;
        var draft = LS.get('bio-admin-draft', null);
        if (draft && draft.base === BASE && draft.data) { DATA = draft.data; toast('Draf yang belum dipublish dipulihkan.'); }
      });
  }
  function findSite() {
    return gh(R() + '/pages').then(function (p) { SITE = p.html_url || ''; }).catch(function () {
      return gh(R() + '/contents/CNAME?ref=' + encodeURIComponent(CFG.branch)).then(function (f) { SITE = 'https://' + b64ToText(f.content).trim() + '/'; })
        .catch(function () { SITE = 'https://' + CFG.owner + '.github.io/' + CFG.repo + '/'; });
    });
  }

  /* ---------- shell ---------- */
  function boot() {
    $('#login').hidden = true; $('#shell').hidden = false;
    $('#repo-name').textContent = CFG.owner + '/' + CFG.repo;
    $('#live-link').href = SITE || '../';
    renderPanel(); markDirty(true);
  }
  function markDirty(skipSave) {
    var now = JSON.stringify(DATA), dirty = now !== BASE;
    $('#dirty').hidden = !dirty; $('#publish').disabled = !dirty; $('#revert').hidden = !dirty;
    if (!skipSave) { if (dirty) { if (!LS.set('bio-admin-draft', { base: BASE, data: DATA })) toast('Draf terlalu besar untuk disimpan otomatis. Publish segera.'); } else LS.del('bio-admin-draft'); }
    sendPreview();
  }
  var pvT; function sendPreview() { clearTimeout(pvT); pvT = setTimeout(function () { var f = $('#pv'); if (f && f.contentWindow) f.contentWindow.postMessage({ type: 'bio-preview', data: DATA, tab: PVTAB }, '*'); }, 120); }
  window.addEventListener('message', function (e) { if (e.data && e.data.type === 'bio-ready') sendPreview(); });
  $('#pv').addEventListener('load', sendPreview);
  $('#pv-tab').addEventListener('click', function (e) { var b = e.target.closest('[data-pt]'); if (!b) return; PVTAB = b.getAttribute('data-pt'); $$('#pv-tab button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); sendPreview(); });
  $('#pv-toggle').addEventListener('click', function () { var p = $('.preview'), o = p.classList.toggle('open'); this.textContent = o ? 'Tutup pratinjau' : 'Lihat pratinjau'; sendPreview(); });
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; TAB = b.getAttribute('data-t'); $$('#tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
    if (TAB === 'produk') { PVTAB = 'products'; } else if (TAB === 'link' || TAB === 'statistik') { PVTAB = 'links'; }
    $$('#pv-tab button').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-pt') === PVTAB); });
    renderPanel(); sendPreview(); });
  $('#revert').addEventListener('click', function () { openModal('<h3>Batalkan semua perubahan?</h3><p class="muted">Draf dibuang dan isi kembali seperti versi yang sudah terbit.</p><div class="row"><button class="btn pri" type="button" id="rv-yes">Ya, batalkan</button><button class="btn" type="button" data-close>Tidak</button></div>'); });
  document.addEventListener('click', function (e) { if (e.target.id === 'rv-yes') { DATA = JSON.parse(BASE); LS.del('bio-admin-draft'); closeModal(); renderPanel(); markDirty(); toast('Perubahan dibatalkan.'); } });

  /* ---------- path helpers ---------- */
  function getP(path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, DATA); }
  function setP(path, v) { var ks = path.split('.'), o = DATA; for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }

  /* ---------- field builders ---------- */
  function tf(label, path, opt) {
    opt = opt || {}; var v = getP(path), id = 'f-' + path.replace(/\./g, '-');
    var inp = opt.area ? '<textarea id="' + id + '" data-k="' + path + '" rows="' + (opt.rows || 3) + '" placeholder="' + esc(opt.ph || '') + '">' + esc(v) + '</textarea>'
      : '<input id="' + id + '" data-k="' + path + '" value="' + esc(v) + '" placeholder="' + esc(opt.ph || '') + '"' + (opt.list ? ' list="' + opt.list + '"' : '') + (opt.type ? ' type="' + opt.type + '"' : '') + '>';
    return '<label class="f" for="' + id + '">' + esc(label) + inp + (opt.hint ? '<span class="tiny muted" style="font-weight:400">' + opt.hint + '</span>' : '') + '</label>';
  }
  function cb(label, path, def) { var v = getP(path); if (v == null) v = def; var id = 'c-' + path.replace(/\./g, '-'); return '<label class="row" for="' + id + '" style="cursor:pointer"><input type="checkbox" id="' + id + '" data-k="' + path + '" data-type="bool"' + (v ? ' checked' : '') + '><span>' + esc(label) + '</span></label>'; }
  function rng(label, path, min, max, unit) { var v = getP(path), id = 'r-' + path.replace(/\./g, '-'); return '<label class="f" for="' + id + '">' + esc(label) + '<span class="range"><input type="range" id="' + id + '" data-k="' + path + '" data-type="num" min="' + min + '" max="' + max + '" value="' + esc(v) + '"><output>' + esc(v) + (unit || 'px') + '</output></span></label>'; }
  function col(label, path) { var v = getP(path) || '#000000', id = 'k-' + path.replace(/\./g, '-'); return '<label class="f" for="' + id + '">' + esc(label) + '<input type="color" id="' + id + '" data-k="' + path + '" value="' + esc(v) + '"></label>'; }
  function iconPrev(v) {
    v = String(v || '');
    if (v.indexOf('emoji:') === 0) return '<span class="emo">' + esc(v.slice(6)) + '</span>';
    if (/^(https?:|assets\/|data:image)/.test(v)) return '<img src="' + esc(imgSrc(v)) + '" alt="">';
    return window.iconSVG(v || 'link') || window.iconSVG('link');
  }
  function imgSrc(v) { return /^assets\//.test(v) ? '../' + v : v; }
  function iconField(label, path) {
    var v = getP(path) || ''; var nm = window.ICONS[v] ? window.ICONS[v].n : (v.indexOf('emoji:') === 0 ? 'Emoji' : v ? 'Gambar' : 'Belum dipilih');
    return '<div class="f"><span>' + esc(label) + '</span><div class="iconf"><span class="prev">' + iconPrev(v) + '</span><span class="small">' + esc(nm) + '</span><button class="btn sm" type="button" data-icon="' + path + '">Ganti ikon</button></div></div>';
  }
  function imgField(label, path, opt) {
    opt = opt || {}; var v = getP(path) || '';
    return '<div class="f"><span>' + esc(label) + '</span><div class="imgf"><span class="pic' + (opt.round ? ' round' : '') + '" style="' + (v ? "background-image:url('" + esc(imgSrc(v)) + "')" : '') + '"></span>' +
      '<div class="stack" style="gap:6px"><div class="row"><label class="btn sm" for="up-' + path + '">Upload</label><input type="file" id="up-' + path + '" accept="image/*" hidden data-up="' + path + '" data-max="' + (opt.max || 1080) + '">' +
      (v ? '<button class="btn sm ghost danger" type="button" data-clear="' + path + '">Hapus</button>' : '') + '</div>' + (opt.hint ? '<span class="tiny muted" style="font-weight:400">' + opt.hint + '</span>' : '') + '</div></div></div>';
  }

  /* ---------- list editor ---------- */
  var LISTS = {
    links: { title: function (x) { return x.title || 'Link tanpa judul'; }, sub: function (x) { return x.subtitle || x.url || ''; }, thumb: function (x) { return iconPrev(x.icon); },
      body: function (p) { return '<div class="grid2">' + tf('Judul', p + '.title') + tf('Keterangan', p + '.subtitle', { ph: 'mis. @cupuberlari' }) + '</div>' +
        tf('URL', p + '.url', { ph: 'https://…', hint: 'Isi <b>#produk</b> untuk membuka tab Produk.' }) +
        '<div class="grid2">' + iconField('Ikon', p + '.icon') + tf('Label kecil di kanan', p + '.tag', { ph: 'mis. TOP, BARU' }) + '</div>'; },
      blank: function () { return { id: uid(), title: 'Link baru', subtitle: '', url: 'https://', icon: 'link', tag: '', visible: true }; } },
    products: { title: function (x) { return x.name || 'Produk tanpa nama'; }, sub: function (x) { return [x.price, x.shop, x.category].filter(Boolean).join(' · '); },
      thumb: function (x) { return x.image ? '<img src="' + esc(imgSrc(x.image)) + '" alt="">' : window.iconSVG('shopping-bag'); },
      body: function (p) { return tf('Nama produk', p + '.name') + tf('Link afiliasi', p + '.url', { ph: 'https://s.shopee.co.id/…' }) +
        '<div class="grid2">' + tf('Harga', p + '.price', { ph: 'Rp749.000' }) + tf('Harga coret (opsional)', p + '.oldPrice', { ph: 'Rp999.000', hint: 'Persen diskon dihitung otomatis.' }) + '</div>' +
        '<div class="grid2">' + tf('Marketplace', p + '.shop', { list: 'dl-shops' }) + tf('Kategori', p + '.category', { list: 'dl-cats', hint: 'Jadi filter di halaman produk.' }) + '</div>' +
        '<div class="grid2">' + tf('Label (opsional)', p + '.badge', { ph: 'Favorit, Promo, Baru' }) + tf('Teks tombol', p + '.cta', { ph: 'Beli sekarang' }) + '</div>' +
        imgField('Foto produk', p + '.image', { max: 800, hint: 'Persegi lebih rapi. Otomatis dikecilkan.' }); },
      blank: function () { return { id: uid(), name: 'Produk baru', price: '', oldPrice: '', shop: 'Shopee', url: 'https://', image: '', category: '', badge: '', visible: true }; } },
    stats: { title: function (x) { return (x.value || '–') + ' ' + (x.label || ''); }, sub: function () { return ''; }, thumb: function () { return window.iconSVG('trophy'); },
      body: function (p) { return '<div class="grid2">' + tf('Angka', p + '.value', { ph: '242' }) + tf('Keterangan', p + '.label', { ph: 'km tahun ini' }) + '</div>'; },
      blank: function () { return { value: '0', label: 'keterangan' }; }, max: 4, noHide: true },
    'profile.socials': { title: function (x) { return (window.ICONS[x.icon] && window.ICONS[x.icon].n) || 'Ikon'; }, sub: function (x) { return x.url || 'URL belum diisi'; }, thumb: function (x) { return iconPrev(x.icon); },
      body: function (p) { return iconField('Ikon', p + '.icon') + tf('URL', p + '.url', { ph: 'https://instagram.com/cupuberlari' }); },
      blank: function () { return { icon: 'instagram', url: '' }; }, max: 6, noHide: true }
  };
  function listHTML(key, addLabel) {
    var L = LISTS[key], arr = getP(key) || [];
    var h = '<div class="items">' + arr.map(function (x, i) {
      var p = key + '.' + i, id = key + ':' + i, open = OPEN[id];
      return '<div class="item' + (x.visible === false ? ' off' : '') + '" data-list="' + key + '" data-i="' + i + '">' +
        '<div class="item-h" data-toggle="' + id + '"><span class="thumb">' + L.thumb(x) + '</span><span class="t"><b>' + esc(L.title(x)) + '</b><span>' + esc(L.sub(x)) + (x.visible === false ? ' · disembunyikan' : '') + '</span></span>' +
        '<span class="acts">' + (L.noHide ? '' : '<button class="ib" type="button" data-act="vis" title="' + (x.visible === false ? 'Tampilkan' : 'Sembunyikan') + '" aria-label="Tampilkan atau sembunyikan">' + eye(x.visible !== false) + '</button>') +
        '<button class="ib" type="button" data-act="up" title="Naikkan" aria-label="Naikkan"' + (i === 0 ? ' disabled' : '') + '>' + arrow('up') + '</button>' +
        '<button class="ib" type="button" data-act="down" title="Turunkan" aria-label="Turunkan"' + (i === arr.length - 1 ? ' disabled' : '') + '>' + arrow('down') + '</button>' +
        '<button class="ib danger" type="button" data-act="del" title="Hapus" aria-label="Hapus">' + trash() + '</button></span></div>' +
        (open ? '<div class="item-b">' + L.body(p) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    if (!L.max || arr.length < L.max) h += '<button class="add" type="button" data-add="' + key + '">+ ' + esc(addLabel) + '</button>';
    return h;
  }
  function eye(on) { return on ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'; }
  function arrow(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="' + (d === 'up' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M19 12l-7 7-7-7') + '"/></svg>'; }
  function trash() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>'; }

  /* ---------- panels ---------- */
  var DISPLAY_FONTS = ['Anton', 'Bebas Neue', 'Oswald', 'League Gothic', 'Archivo Black', 'Big Shoulders Display', 'Bricolage Grotesque', 'Space Grotesk', 'Syne', 'Unbounded'];
  var BODY_FONTS = ['DM Sans', 'Inter', 'Plus Jakarta Sans', 'Manrope', 'Outfit', 'Poppins', 'Space Grotesk', 'Figtree', 'Work Sans'];
  var PRESETS = [
    { n: 'Lime (bawaan)', c: { bg: '#E3E86B', hero: '#C8D6B2', panel: '#2D3B22', card: '#FFFFFF', accent: '#F4F062', ink: '#22301A', panelInk: '#FFFFFF', accentInk: '#22301A' } },
    { n: 'Malam', c: { bg: '#1B1D22', hero: '#2B2E36', panel: '#111216', card: '#22252C', accent: '#CCF33A', ink: '#F3F4F5', panelInk: '#F3F4F5', accentInk: '#15160F' } },
    { n: 'Oranye lari', c: { bg: '#FFB38A', hero: '#FFD9C2', panel: '#2B1D16', card: '#FFFFFF', accent: '#FF6B2C', ink: '#2B1D16', panelInk: '#FFFFFF', accentInk: '#FFFFFF' } },
    { n: 'Biru laut', c: { bg: '#9CC8FF', hero: '#D3E6FF', panel: '#10223F', card: '#FFFFFF', accent: '#7CF0C5', ink: '#10223F', panelInk: '#FFFFFF', accentInk: '#10223F' } }
  ];
  function selectF(label, path, opts) { var v = getP(path), id = 's-' + path.replace(/\./g, '-'); return '<label class="f" for="' + id + '">' + esc(label) + '<select id="' + id + '" data-k="' + path + '">' + opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>'; }

  function renderPanel() {
    var h = '', d = DATA;
    if (TAB === 'profil') {
      h += '<div class="card"><h3>Nama & teks</h3><div class="grid2">' + tf('Nama baris 1', 'profile.nameTop') + tf('Nama baris 2', 'profile.nameBottom') + '</div>' +
        tf('Keterangan di bawah nama', 'profile.subtitle') + tf('Label kuning', 'profile.badge', { ph: 'OPEN FOR COLLAB' }) + cb('Tampilkan tombol bagikan (kiri atas)', 'profile.shareButton', true) + '</div>';
      h += '<div class="card"><h3>Foto</h3><div class="grid2">' + imgField('Foto utama (kanan)', 'profile.photo', { max: 1200, hint: 'Pakai PNG dengan latar transparan (foto potongan) supaya mirip contoh.' }) +
        imgField('Foto profil kecil', 'profile.avatar', { round: true, max: 400 }) + '</div></div>';
      h += '<div class="card"><h3>Ikon sosial media</h3><p class="small muted" style="margin-top:-6px">Tampil sebagai lingkaran putih di samping label kuning. Maksimal 6.</p>' + listHTML('profile.socials', 'Tambah ikon sosial') + '</div>';
    } else if (TAB === 'link') {
      h += '<div class="card"><div class="grid2">' + tf('Judul bagian', 'linksTitle') + tf('Nama tab', 'tabs.links') + '</div></div>' + listHTML('links', 'Tambah link');
    } else if (TAB === 'produk') {
      h += '<div class="card"><div class="grid2">' + tf('Judul bagian', 'productsTitle') + tf('Nama tab', 'tabs.products') + '</div>' + tf('Catatan afiliasi', 'productsNote', { area: true, rows: 3, hint: 'Sebaiknya tetap ada: memberi tahu pengunjung bahwa ini link afiliasi.' }) + '</div>' +
        listHTML('products', 'Tambah produk') +
        '<datalist id="dl-shops">' + ['Shopee', 'Tokopedia', 'TikTok Shop', 'Lazada', 'Blibli', 'Bukalapak', 'Zalora', 'Website resmi'].map(function (s) { return '<option value="' + s + '">'; }).join('') + '</datalist>' +
        '<datalist id="dl-cats">' + (d.products || []).map(function (x) { return x.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; }).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>';
    } else if (TAB === 'statistik') {
      h += '<div class="card">' + tf('Judul bagian', 'statsTitle') + '<p class="small muted" style="margin:0">Kartu putih berisi angka. Maksimal 4. Hapus semua untuk menyembunyikan bagian ini.</p></div>' + listHTML('stats', 'Tambah kartu');
    } else if (TAB === 'tampilan') {
      h += '<div class="card"><h3>Preset warna</h3><div class="swatches">' + PRESETS.map(function (p, i) { return '<button type="button" data-preset="' + i + '"><i style="background:linear-gradient(135deg,' + p.c.bg + ' 50%,' + p.c.panel + ' 50%)"></i>' + esc(p.n) + '</button>'; }).join('') + '</div></div>';
      h += '<div class="card"><h3>Warna</h3><div class="grid2">' + col('Latar halaman', 'theme.bg') + col('Latar atas (hero)', 'theme.hero') + col('Panel bawah', 'theme.panel') + col('Kartu', 'theme.card') + col('Aksen (tombol, label)', 'theme.accent') + col('Teks utama', 'theme.ink') + col('Teks di panel', 'theme.panelInk') + col('Teks di atas aksen', 'theme.accentInk') + '</div></div>';
      h += '<div class="card"><h3>Font</h3><div class="grid2">' + selectF('Font nama besar', 'theme.displayFont', DISPLAY_FONTS) + selectF('Font teks', 'theme.bodyFont', BODY_FONTS) + '</div>' + cb('Nama huruf kapital semua', 'theme.uppercase', true) + '</div>';
      h += '<div class="card"><h3>Ukuran</h3><div class="grid2">' + rng('Nama besar', 'theme.titleSize', 36, 110) + rng('Keterangan nama', 'theme.subtitleSize', 12, 24) + rng('Judul bagian', 'theme.sectionSize', 16, 36) +
        rng('Teks umum', 'theme.bodySize', 13, 20) + rng('Judul link', 'theme.linkSize', 13, 24) + rng('Angka statistik', 'theme.statSize', 18, 48) + rng('Sudut kartu', 'theme.radius', 0, 32) + '</div></div>';
    } else {
      h += '<div class="card"><h3>Tombol melayang</h3>' + cb('Tampilkan tombol', 'cta.show', true) + '<div class="grid2">' + tf('Teks tombol', 'cta.text') + tf('URL', 'cta.url') + '</div></div>';
      h += '<div class="card"><h3>Info halaman</h3>' + tf('Judul tab browser', 'seo.title') + tf('Deskripsi (untuk Google & preview link)', 'seo.description', { area: true, rows: 2 }) + tf('Teks footer', 'footer') + '</div>';
      h += '<div class="card"><h3>Repo & akun</h3><p class="small muted" style="margin:0">Terhubung ke <b>' + esc(CFG.owner + '/' + CFG.repo) + '</b> (branch ' + esc(CFG.branch) + '). Halaman: <a href="' + esc(SITE) + '" target="_blank" rel="noopener">' + esc(SITE) + '</a></p>' +
        '<div class="row"><button class="btn sm" type="button" id="pages-on">Aktifkan / cek GitHub Pages</button><button class="btn sm" type="button" id="dl-json">Unduh data.json</button><button class="btn sm ghost danger" type="button" id="logout">Keluar (hapus token dari browser ini)</button></div></div>';
    }
    $('#panel').innerHTML = h;
  }

  /* ---------- events: input ---------- */
  $('#panel').addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-k'); if (!k) return;
    var t = e.target.getAttribute('data-type'), v = t === 'bool' ? e.target.checked : t === 'num' ? +e.target.value : e.target.value;
    setP(k, v);
    if (t === 'num') { var o = e.target.parentNode.querySelector('output'); if (o) o.textContent = v + 'px'; }
    var it = e.target.closest('.item');
    if (it) { var key = it.getAttribute('data-list'), x = getP(key)[+it.getAttribute('data-i')], L = LISTS[key]; $('.item-h .t b', it).textContent = L.title(x); $('.item-h .t span', it).textContent = L.sub(x); }
    markDirty();
  });
  $('#panel').addEventListener('change', function (e) { if (e.target.type === 'checkbox' && e.target.getAttribute('data-k')) { setP(e.target.getAttribute('data-k'), e.target.checked); markDirty(); } });

  /* ---------- events: clicks ---------- */
  $('#panel').addEventListener('click', function (e) {
    var pr = e.target.closest('[data-preset]'); if (pr) { Object.assign(DATA.theme, PRESETS[+pr.getAttribute('data-preset')].c); renderPanel(); markDirty(); return; }
    var add = e.target.closest('[data-add]'); if (add) { var key = add.getAttribute('data-add'), arr = getP(key) || []; arr.push(LISTS[key].blank()); setP(key, arr); OPEN[key + ':' + (arr.length - 1)] = true; renderPanel(); markDirty(); return; }
    var act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      var it = act.closest('.item'), key2 = it.getAttribute('data-list'), i = +it.getAttribute('data-i'), a = getP(key2), A = act.getAttribute('data-act');
      if (A === 'vis') a[i].visible = a[i].visible === false;
      else if (A === 'up' && i > 0) { a.splice(i - 1, 0, a.splice(i, 1)[0]); swapOpen(key2, i, i - 1); }
      else if (A === 'down' && i < a.length - 1) { a.splice(i + 1, 0, a.splice(i, 1)[0]); swapOpen(key2, i, i + 1); }
      else if (A === 'del') { openModal('<h3>Hapus "' + esc(LISTS[key2].title(a[i])) + '"?</h3><p class="muted">Bisa dibatalkan selama belum Publish (tombol Batalkan perubahan).</p><div class="row"><button class="btn pri" type="button" id="del-yes" data-key="' + key2 + '" data-i="' + i + '">Hapus</button><button class="btn" type="button" data-close>Batal</button></div>'); return; }
      renderPanel(); markDirty(); return;
    }
    var tg = e.target.closest('[data-toggle]'); if (tg) { var id = tg.getAttribute('data-toggle'); OPEN[id] = !OPEN[id]; renderPanel(); return; }
    var ic = e.target.closest('[data-icon]'); if (ic) { iconPicker(ic.getAttribute('data-icon')); return; }
    var cl = e.target.closest('[data-clear]'); if (cl) { setP(cl.getAttribute('data-clear'), ''); renderPanel(); markDirty(); return; }
    if (e.target.id === 'logout') { CFG.token = ''; LS.set('bio-admin-cfg', CFG); showLogin(); return; }
    if (e.target.id === 'dl-json') { var blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' }), u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'data.json'; l.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000); return; }
    if (e.target.id === 'pages-on') { enablePages(e.target); }
  });
  function swapOpen(key, a, b) { var x = OPEN[key + ':' + a], y = OPEN[key + ':' + b]; OPEN[key + ':' + a] = y; OPEN[key + ':' + b] = x; }
  document.addEventListener('click', function (e) {
    if (e.target.id === 'del-yes') { var k = e.target.getAttribute('data-key'), i = +e.target.getAttribute('data-i'); getP(k).splice(i, 1); Object.keys(OPEN).forEach(function (x) { if (x.indexOf(k + ':') === 0) delete OPEN[x]; }); closeModal(); renderPanel(); markDirty(); toast('Dihapus. Publish untuk menerapkan.'); }
    if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal();
  });

  function enablePages(btn) {
    btn.disabled = true;
    gh(R() + '/pages').then(function (p) { SITE = p.html_url; toast('GitHub Pages sudah aktif: ' + p.html_url); })
      .catch(function (err) {
        if (err.status !== 404) throw err;
        return gh(R() + '/pages', { method: 'POST', body: { source: { branch: CFG.branch, path: '/' } } }).then(function (p) { SITE = p.html_url; toast('GitHub Pages diaktifkan. Halaman siap dalam 1–2 menit.'); });
      })
      .catch(function (err) { toast(err.status === 403 ? 'Token belum punya izin Pages (Read and write). Aktifkan manual: Settings → Pages → Deploy from branch.' : 'Gagal: ' + err.message); })
      .then(function () { btn.disabled = false; $('#live-link').href = SITE; renderPanel(); });
  }

  /* ---------- upload gambar ---------- */
  $('#panel').addEventListener('change', function (e) {
    var path = e.target.getAttribute('data-up'); if (!path) return; var f = e.target.files[0]; e.target.value = ''; if (!f) return;
    resize(f, +e.target.getAttribute('data-max') || 1080).then(function (url) { setP(path, url); renderPanel(); markDirty(); }).catch(function () { toast('Gambar tidak bisa dibaca. Coba JPG atau PNG.'); });
  });
  function resize(file, max) {
    return new Promise(function (ok, no) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        var alpha = /png|webp|gif|svg/.test(file.type);
        ok(c.toDataURL(alpha ? 'image/png' : 'image/jpeg', 0.86));
      };
      im.onerror = no; im.src = u;
    });
  }

  /* ---------- pemilih ikon ---------- */
  var ICON_PATH = '';
  function iconPicker(path) {
    ICON_PATH = path; var cur = getP(path) || '';
    var names = Object.keys(window.ICONS);
    openModal('<div class="row" style="justify-content:space-between"><h3>Pilih ikon</h3><button class="btn sm ghost" type="button" data-close>Tutup</button></div>' +
      '<input id="ic-q" placeholder="Cari: instagram, lari, belanja…" autocomplete="off">' +
      '<div class="icons" id="ic-grid">' + names.map(function (n) { return '<button type="button" data-pick="' + n + '" data-name="' + esc((n + ' ' + window.ICONS[n].n).toLowerCase()) + '" aria-pressed="' + (n === cur) + '">' + window.iconSVG(n) + esc(window.ICONS[n].n) + '</button>'; }).join('') + '</div>' +
      '<div class="grid2"><label class="f" for="ic-emo">Atau pakai emoji<input id="ic-emo" placeholder="🏃" maxlength="4" value="' + esc(cur.indexOf('emoji:') === 0 ? cur.slice(6) : '') + '"></label>' +
      '<div class="f"><span>Atau upload gambar ikon</span><div class="row"><label class="btn sm" for="ic-up">Upload</label><input type="file" id="ic-up" accept="image/*" hidden><button class="btn sm" type="button" id="ic-emo-ok">Pakai emoji</button></div></div></div>');
    setTimeout(function () { var q = $('#ic-q'); if (q) q.focus(); }, 30);
  }
  $('#sheet').addEventListener('input', function (e) { if (e.target.id === 'ic-q') { var q = e.target.value.toLowerCase().trim(); $$('#ic-grid button').forEach(function (b) { b.hidden = q && b.getAttribute('data-name').indexOf(q) < 0; }); } });
  $('#sheet').addEventListener('click', function (e) {
    var p = e.target.closest('[data-pick]'); if (p) { setP(ICON_PATH, p.getAttribute('data-pick')); closeModal(); renderPanel(); markDirty(); return; }
    if (e.target.id === 'ic-emo-ok') { var v = $('#ic-emo').value.trim(); if (!v) { toast('Ketik satu emoji dulu.'); return; } setP(ICON_PATH, 'emoji:' + v); closeModal(); renderPanel(); markDirty(); }
  });
  $('#sheet').addEventListener('change', function (e) {
    if (e.target.id !== 'ic-up') return; var f = e.target.files[0]; if (!f) return;
    resize(f, 192).then(function (u) { setP(ICON_PATH, u); closeModal(); renderPanel(); markDirty(); });
  });
  function openModal(h) { $('#sheet').innerHTML = h; $('#modal').hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#sheet').innerHTML = ''; }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

  /* ---------- publish ---------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  $('#publish').addEventListener('click', function () {
    openModal('<h3>Publish ke GitHub</h3><div class="publog" id="plog"></div><div class="row" id="pact"></div>');
    var log = function (m, c) { $('#plog').insertAdjacentHTML('beforeend', '<span class="' + (c || '') + '">' + m + '</span>'); };
    var out = JSON.parse(JSON.stringify(DATA)), files = [];
    (function walk(o) { Object.keys(o).forEach(function (k) { var v = o[k];
      if (typeof v === 'string' && v.indexOf('data:image/') === 0) { var m = /^data:image\/(png|jpeg|webp|gif);base64,(.*)$/.exec(v); if (m) { var p = 'assets/uploads/' + hash(v) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); files.push({ path: p, b64: m[2] }); o[k] = p; } }
      else if (v && typeof v === 'object') walk(v); }); })(out);
    var head, baseTree, entries = [];
    log('Menyiapkan ' + (files.length ? files.length + ' gambar baru + ' : '') + 'data.json…');
    $('#publish').disabled = true;
    gh(R() + '/git/ref/heads/' + encodeURIComponent(CFG.branch)).then(function (ref) { head = ref.object.sha; return gh(R() + '/git/commits/' + head); })
      .then(function (c) { baseTree = c.tree.sha;
        return files.reduce(function (p, f) { return p.then(function () { return gh(R() + '/git/blobs', { method: 'POST', body: { content: f.b64, encoding: 'base64' } }).then(function (b) { entries.push({ path: f.path, mode: '100644', type: 'blob', sha: b.sha }); log('✓ ' + f.path, 'ok'); }); }); }, Promise.resolve()); })
      .then(function () { return gh(R() + '/git/blobs', { method: 'POST', body: { content: JSON.stringify(out, null, 2) + '\n', encoding: 'utf-8' } }); })
      .then(function (b) { entries.push({ path: 'data.json', mode: '100644', type: 'blob', sha: b.sha }); return gh(R() + '/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: entries } }); })
      .then(function (t) { return gh(R() + '/git/commits', { method: 'POST', body: { message: 'Update bio dari admin panel', tree: t.sha, parents: [head] } }); })
      .then(function (c) { return gh(R() + '/git/refs/heads/' + encodeURIComponent(CFG.branch), { method: 'PATCH', body: { sha: c.sha } }).then(function () { return c; }); })
      .then(function (c) {
        DATA = out; BASE = JSON.stringify(out); LS.del('bio-admin-draft'); renderPanel(); markDirty();
        log('✓ Commit ' + c.sha.slice(0, 7) + ' terkirim.', 'ok');
        log('Halaman bio akan berubah dalam ±1 menit (GitHub Pages sedang menerbitkan ulang).');
        $('#pact').innerHTML = '<a class="btn pri" href="' + esc(SITE) + '" target="_blank" rel="noopener">Buka halaman</a><button class="btn" type="button" data-close>Tutup</button>';
      })
      .catch(function (err) {
        log('✗ Gagal: ' + esc(err.status === 409 || err.status === 422 ? 'Repo berubah di tempat lain. Tutup, muat ulang halaman admin, lalu publish lagi.' : err.status === 403 ? 'Token tidak punya izin menulis (Contents: Read and write).' : err.message), 'bad');
        $('#pact').innerHTML = '<button class="btn" type="button" data-close>Tutup</button>'; $('#publish').disabled = false;
      });
  });

  window.addEventListener('beforeunload', function (e) { if (DATA && JSON.stringify(DATA) !== BASE) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- start ---------- */
  if (CFG.token) connect().catch(function (err) { showLogin(err.status === 401 ? 'Token kedaluwarsa. Masukkan token baru.' : 'Tidak bisa terhubung ke GitHub: ' + err.message); });
  else showLogin();
})();
