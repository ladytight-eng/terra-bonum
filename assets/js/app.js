(() => {
  'use strict';

  const WA = '233244632732';
  const CART_KEY = 'terrabonum_cart';

  let PRODUCTS = [];
  let VIDEOS = [];
  let ABOUT = null;
  let MOMENTS = [];

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function buildCollections() {
    const byName = {};
    PRODUCTS.forEach(p => {
      const name = p.collection || p.category || 'Other';
      if (!byName[name]) byName[name] = { id: name, name, count: 0, img: p.img };
      byName[name].count += 1;
    });
    return Object.values(byName).map(c => ({ ...c, count: c.count + (c.count === 1 ? ' piece' : ' pieces') }));
  }

  const state = {
    page: 'home',
    currentId: null,
    cart: loadCart(),
    cartOpen: false,
    detailQty: 1
  };

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) {}
  }

  function money(n) { return '$' + n.toLocaleString('en-US'); }

  function cartLines() {
    return Object.keys(state.cart).map(id => {
      const p = PRODUCTS.find(x => x.id === id);
      return p ? { ...p, qty: state.cart[id] } : null;
    }).filter(Boolean);
  }
  function subtotal() { return cartLines().reduce((s, l) => s + l.price * l.qty, 0); }
  function cartCount() { return cartLines().reduce((s, l) => s + l.qty, 0); }

  function openWhatsApp(text) {
    const url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
    window.open(url, '_blank');
  }

  function addToCart(id, qty) {
    state.cart[id] = (state.cart[id] || 0) + (qty || 1);
    state.cartOpen = true;
    saveCart();
    render();
  }
  function setQty(id, delta) {
    const next = (state.cart[id] || 0) + delta;
    if (next <= 0) delete state.cart[id]; else state.cart[id] = next;
    saveCart();
    render();
  }
  function removeItem(id) {
    delete state.cart[id];
    saveCart();
    render();
  }

  function nav(page, id, opts) {
    state.page = page;
    if (id !== undefined) state.currentId = id;
    state.cartOpen = false;
    state.detailQty = 1;
    render();
    if (page === 'heritage-scroll') return;
    if (!(opts && opts.noScroll)) window.scrollTo(0, 0);
    location.hash = page === 'home' ? '' : (page === 'product' ? 'product/' + id : page);
  }

  function goHeritage() {
    if (state.page !== 'home') {
      state.page = 'home';
      render();
    }
    requestAnimationFrame(() => {
      const el = document.getElementById('heritage');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
    location.hash = 'heritage';
  }

  // ---- Rendering ----
  function productCardHTML(p) {
    return `
      <div class="product-card" data-id="${p.id}">
        <div class="product-card__img" data-open="${p.id}">
          <img src="${p.img}" alt="${p.name}">
          <div class="product-card__tag">${p.tag}</div>
        </div>
        <div class="product-card__body">
          <div class="product-card__info" data-open="${p.id}">
            <div class="product-card__name">${p.name}</div>
            <div class="product-card__meaning">${p.meaning}</div>
          </div>
          <div class="product-card__row">
            <div class="product-card__price">${money(p.price)}</div>
            <button class="add-btn" data-add="${p.id}">Add +</button>
          </div>
        </div>
      </div>`;
  }

  function collectionCardHTML(c) {
    return `
      <div class="collection-card" data-collection="${c.id}">
        <div class="collection-card__img">
          <img src="${c.img}" alt="${c.name}">
          <div class="collection-card__scrim"></div>
          <div class="collection-card__label">
            <div class="collection-card__name">${c.name}</div>
            <div class="collection-card__count">${c.count}</div>
          </div>
        </div>
      </div>`;
  }

  function videoCardHTML(v) {
    return `
      <div class="video-card">
        <video class="video-card__player" controls preload="metadata">
          <source src="${v.video}">
        </video>
        <div class="video-card__title">${v.title}</div>
        ${v.caption ? `<div class="video-card__caption">${v.caption}</div>` : ''}
      </div>`;
  }

  function momentCardHTML(m) {
    const media = m.mediaType === 'video'
      ? `<video class="moment-card__media" controls preload="metadata"><source src="${m.media}"></video>`
      : `<img class="moment-card__media" src="${m.media}" alt="${m.customerName || 'Customer moment'}">`;
    const hasCaption = m.customerName || m.occasion;
    return `
      <div class="moment-card">
        ${media}
        ${hasCaption ? `
        <div class="moment-card__caption">
          ${m.customerName ? `<div class="moment-card__name">${m.customerName}</div>` : ''}
          ${m.occasion ? `<div class="moment-card__occasion">${m.occasion}</div>` : ''}
        </div>` : ''}
      </div>`;
  }

  function renderHome() {
    document.getElementById('collectionsGrid').innerHTML = buildCollections().map(collectionCardHTML).join('');
    document.getElementById('featuredGrid').innerHTML = PRODUCTS.slice(0, 4).map(productCardHTML).join('');
    const videoSection = document.getElementById('craft-videos');
    videoSection.hidden = VIDEOS.length === 0;
    if (VIDEOS.length) {
      document.getElementById('videosGrid').innerHTML = VIDEOS.map(videoCardHTML).join('');
    }

    const momentsSection = document.getElementById('customer-moments');
    momentsSection.hidden = MOMENTS.length === 0;
    if (MOMENTS.length) {
      document.getElementById('momentsGrid').innerHTML = MOMENTS.map(momentCardHTML).join('');
    }

    const makerSection = document.getElementById('maker');
    const hasMaker = ABOUT && ABOUT.name && ABOUT.bio;
    makerSection.hidden = !hasMaker;
    if (hasMaker) {
      document.getElementById('makerPhoto').src = ABOUT.photo || 'assets/images/kente-heritage.jpg';
      document.getElementById('makerPhoto').alt = ABOUT.name;
      document.getElementById('makerName').textContent = ABOUT.name;
      document.getElementById('makerRole').textContent = ABOUT.role || '';
      const bioParas = ABOUT.bio.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      document.getElementById('makerBio').innerHTML = bioParas.map(p => `<p>${escapeHtml(p)}</p>`).join('');
    }
  }

  function renderShop() {
    document.getElementById('shopGrid').innerHTML = PRODUCTS.map(productCardHTML).join('');
  }

  function renderProduct() {
    const p = PRODUCTS.find(x => x.id === state.currentId) || PRODUCTS[0];
    const qty = state.detailQty;
    document.getElementById('productDetail').innerHTML = `
      <div class="product-detail__img">
        <img src="${p.img}" alt="${p.name}">
      </div>
      <div>
        <div class="product-detail__category">${p.category}</div>
        <h1 class="product-detail__name">${p.name}</h1>
        <div class="product-detail__meaning">${p.meaning}</div>
        <div class="product-detail__price">${money(p.price)}</div>
        <p class="product-detail__desc">${p.desc}</p>
        <ul class="product-detail__list">
          <li><span>✓</span> Handwoven in Bonwire on the traditional loom</li>
          <li><span>✓</span> 100% cotton &amp; silk blend</li>
          <li><span>✓</span> ${p.size}</li>
          <li><span>✓</span> Ships worldwide in 5–10 business days</li>
        </ul>
        <div class="qty-row">
          <div class="qty-control">
            <button id="qtyDec">−</button>
            <span>${qty}</span>
            <button id="qtyInc">+</button>
          </div>
          <button class="btn btn--primary" id="addToCartBtn">Add to cart · ${money(p.price * qty)}</button>
        </div>
        <button class="btn btn--green btn--block" id="waProductBtn">Order this on WhatsApp</button>
      </div>`;

    document.getElementById('qtyDec').addEventListener('click', () => {
      state.detailQty = Math.max(1, state.detailQty - 1);
      renderProduct();
    });
    document.getElementById('qtyInc').addEventListener('click', () => {
      state.detailQty += 1;
      renderProduct();
    });
    document.getElementById('addToCartBtn').addEventListener('click', () => {
      addToCart(p.id, state.detailQty);
    });
    document.getElementById('waProductBtn').addEventListener('click', () => {
      openWhatsApp('Hello Terra Bonum! I am interested in the ' + p.name + ' (' + money(p.price) + '). Is it available?');
    });
  }

  function renderCart() {
    const lines = cartLines();
    const badge = document.getElementById('cartBadge');
    const cnt = cartCount();
    badge.hidden = cnt === 0;
    badge.textContent = cnt;

    const body = document.getElementById('cartBody');
    if (!lines.length) {
      body.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty__icon">🧺</div>
          <div class="cart-empty__title">Your cart is empty</div>
          <div class="cart-empty__desc">Add a handwoven piece to begin.</div>
          <button class="btn btn--primary" id="browseShopBtn" style="background:var(--ink);">Browse the shop</button>
        </div>`;
      const btn = document.getElementById('browseShopBtn');
      if (btn) btn.addEventListener('click', () => nav('shop'));
    } else {
      body.innerHTML = lines.map(l => `
        <div class="cart-item" data-id="${l.id}">
          <div class="cart-item__img"><img src="${l.img}" alt="${l.name}"></div>
          <div class="cart-item__info">
            <div class="cart-item__name">${l.name}</div>
            <div class="cart-item__price">${money(l.price)}</div>
            <div class="cart-item__controls">
              <div class="cart-item__qty">
                <button data-dec="${l.id}">−</button>
                <span>${l.qty}</span>
                <button data-inc="${l.id}">+</button>
              </div>
              <button class="cart-item__remove" data-remove="${l.id}">Remove</button>
            </div>
          </div>
          <div class="cart-item__line">${money(l.price * l.qty)}</div>
        </div>`).join('');
    }

    const footer = document.getElementById('cartFooter');
    footer.hidden = lines.length === 0;
    document.getElementById('cartSubtotal').textContent = money(subtotal());

    document.getElementById('cartOverlay').classList.toggle('open', state.cartOpen);
    document.getElementById('cartDrawer').classList.toggle('open', state.cartOpen);
  }

  function renderNav() {
    document.querySelectorAll('.nav__link').forEach(btn => {
      const target = btn.dataset.nav;
      const isActive = (target === 'home' && state.page === 'home') ||
                        (target === 'shop' && (state.page === 'shop' || state.page === 'product')) ||
                        (target === 'contact' && state.page === 'contact');
      btn.classList.toggle('active', isActive);
    });
  }

  function render() {
    document.getElementById('page-home').hidden = state.page !== 'home';
    document.getElementById('page-shop').hidden = state.page !== 'shop';
    document.getElementById('page-product').hidden = state.page !== 'product';
    document.getElementById('page-contact').hidden = state.page !== 'contact';

    if (state.page === 'home') renderHome();
    if (state.page === 'shop') renderShop();
    if (state.page === 'product') renderProduct();

    renderNav();
    renderCart();
  }

  function checkout() {
    const lines = cartLines();
    if (!lines.length) return;
    let msg = 'Hello Terra Bonum! I would like to order:\n';
    lines.forEach(l => { msg += '• ' + l.name + ' × ' + l.qty + ' (' + money(l.price * l.qty) + ')\n'; });
    msg += '\nSubtotal: ' + money(subtotal()) + '\nPlease let me know shipping to my location.';
    openWhatsApp(msg);
  }

  function contactSubmit(e) {
    e.preventDefault();
    const fName = document.getElementById('fName').value.trim();
    const fEmail = document.getElementById('fEmail').value.trim();
    const fMsg = document.getElementById('fMsg').value.trim();
    let msg = 'Hello Terra Bonum!\n';
    if (fName) msg += 'Name: ' + fName + '\n';
    if (fEmail) msg += 'Email: ' + fEmail + '\n';
    msg += '\n' + (fMsg || 'I would like to know more about your kente.');
    openWhatsApp(msg);
  }

  // ---- Event delegation ----
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
      const target = navBtn.dataset.nav;
      if (target === 'heritage') { goHeritage(); return; }
      nav(target);
      return;
    }
    const openId = e.target.closest('[data-open]');
    if (openId) { nav('product', openId.dataset.open); return; }

    const addId = e.target.closest('[data-add]');
    if (addId) { addToCart(addId.dataset.add, 1); return; }

    const collectionEl = e.target.closest('[data-collection]');
    if (collectionEl) { nav('shop'); return; }

    const inc = e.target.closest('[data-inc]');
    if (inc) { setQty(inc.dataset.inc, 1); return; }
    const dec = e.target.closest('[data-dec]');
    if (dec) { setQty(dec.dataset.dec, -1); return; }
    const remove = e.target.closest('[data-remove]');
    if (remove) { removeItem(remove.dataset.remove); return; }
  });

  document.getElementById('cartToggle').addEventListener('click', () => {
    state.cartOpen = !state.cartOpen;
    renderCart();
  });
  document.getElementById('cartClose').addEventListener('click', () => {
    state.cartOpen = false;
    renderCart();
  });
  document.getElementById('cartOverlay').addEventListener('click', () => {
    state.cartOpen = false;
    renderCart();
  });
  document.getElementById('checkoutBtn').addEventListener('click', checkout);
  document.getElementById('contactForm').addEventListener('submit', contactSubmit);

  // ---- Routing from URL hash on load ----
  function routeFromHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    if (!hash) { state.page = 'home'; return; }
    if (hash === 'shop') { state.page = 'shop'; return; }
    if (hash === 'contact') { state.page = 'contact'; return; }
    if (hash === 'heritage') { state.page = 'home'; return; }
    if (hash.startsWith('product/')) {
      const id = hash.slice('product/'.length);
      if (PRODUCTS.find(p => p.id === id)) { state.page = 'product'; state.currentId = id; return; }
    }
    state.page = 'home';
  }

  async function init() {
    try {
      const res = await fetch('/api/products', { cache: 'no-store' });
      PRODUCTS = await res.json();
    } catch (e) {
      PRODUCTS = [];
    }
    try {
      const res = await fetch('/api/videos', { cache: 'no-store' });
      VIDEOS = await res.json();
    } catch (e) {
      VIDEOS = [];
    }
    try {
      const res = await fetch('/api/about', { cache: 'no-store' });
      ABOUT = await res.json();
    } catch (e) {
      ABOUT = null;
    }
    try {
      const res = await fetch('/api/moments', { cache: 'no-store' });
      MOMENTS = await res.json();
    } catch (e) {
      MOMENTS = [];
    }
    routeFromHash();
    render();
    if (location.hash === '#heritage' || location.hash === '#/heritage') {
      requestAnimationFrame(() => {
        const el = document.getElementById('heritage');
        if (el) el.scrollIntoView();
      });
    }
  }

  init();
})();
