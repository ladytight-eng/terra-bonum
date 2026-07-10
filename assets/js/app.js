(() => {
  'use strict';

  const WA = '233244632732';
  const CART_KEY = 'terrabonum_cart';

  const PRODUCTS = [
    { id: 'royal-fire', name: 'Fathia Royal Cloth', category: 'Full Cloth', collection: 'Full Cloth', meaning: 'Fathia Fata Nkrumah', tag: 'Bestseller', price: 480, img: 'assets/images/kente-hero.jpg', size: '6 yards · full men’s toga / 12 yards women’s set', desc: 'A commanding cloth in the classic red, gold, green and blue — the colours of celebration and royalty. Woven strip by strip and hand-joined so the zig-zag motifs align across the full width.' },
    { id: 'pink-grove', name: 'Emaa Da Set', category: 'Full Cloth', collection: 'Full Cloth', meaning: 'Emaa Da · unprecedented', tag: 'New', price: 460, img: 'assets/images/kente-heritage.jpg', size: '6 yards · full toga / women’s set', desc: 'A softer palette of olive green, gold and rose — refined and modern while staying true to the traditional weave. A favourite for engagements and outdooring ceremonies.' },
    { id: 'sunset-zig', name: 'Nsroma Cloth', category: 'Full Cloth', collection: 'Full Cloth', meaning: 'Nsroma · star of hope', tag: 'Limited', price: 495, img: 'assets/images/kente-sunset.jpg', size: '6 yards · full toga / women’s set', desc: 'Vivid magenta, emerald and orange charged with shimmer thread. A statement piece that catches the light — woven for those who want to be seen.' },
    { id: 'grad-stole', name: 'Graduation Stole', category: 'Stoles & Sashes', collection: 'Stoles & Sashes', meaning: 'wear your achievement', tag: 'Popular', price: 65, img: 'assets/images/kente-hero.jpg', size: 'Approx. 72" × 5" · one size', desc: 'A handwoven kente stole to crown your milestone. Rich, durable and made to be kept — a graduation keepsake passed down for years.' },
    { id: 'clutch-bag', name: 'Woven Clutch Bag', category: 'Bags & Accessories', collection: 'Bags & Accessories', meaning: 'carry your culture', tag: 'Accessory', price: 85, img: 'assets/images/kente-heritage.jpg', size: 'Approx. 10" × 6" · lined, zip close', desc: 'A structured clutch cut from genuine kente and fully lined. The perfect finishing touch for weddings, church and events.' },
    { id: 'bow-tie', name: 'Kente Bow Tie', category: 'Bags & Accessories', collection: 'Bags & Accessories', meaning: 'a nod to heritage', tag: 'Accessory', price: 35, img: 'assets/images/kente-sunset.jpg', size: 'Adjustable neck strap · one size', desc: 'A self-tie kente bow tie for grooms, graduates and gentlemen. Small in size, big on statement.' },
    { id: 'table-run', name: 'Kente Table Runner', category: 'Home', collection: 'Home', meaning: 'heritage at the table', tag: 'Home', price: 70, img: 'assets/images/kente-hero.jpg', size: 'Approx. 72" × 13"', desc: 'Bring the warmth of Bonwire to your table. A handwoven runner that turns any gathering into a celebration.' },
    { id: 'headwrap', name: 'Kente Head Wrap', category: 'Bags & Accessories', collection: 'Bags & Accessories', meaning: 'crown yourself', tag: 'Accessory', price: 45, img: 'assets/images/kente-heritage.jpg', size: 'Approx. 72" × 22"', desc: 'A generous head wrap (duku) in vibrant kente — tie it your way. Also worn as a shawl or sash.' }
  ];

  const COLLECTIONS = [
    { id: 'Full Cloth', name: 'Full Cloth', count: '3 pieces', img: 'assets/images/kente-hero.jpg' },
    { id: 'Stoles & Sashes', name: 'Stoles & Sashes', count: '1 piece', img: 'assets/images/kente-sunset.jpg' },
    { id: 'Bags & Accessories', name: 'Accessories', count: '3 pieces', img: 'assets/images/kente-heritage.jpg' },
    { id: 'Home', name: 'Home', count: '1 piece', img: 'assets/images/kente-hero.jpg' }
  ];

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

  function renderHome() {
    document.getElementById('collectionsGrid').innerHTML = COLLECTIONS.map(collectionCardHTML).join('');
    document.getElementById('featuredGrid').innerHTML = PRODUCTS.slice(0, 4).map(productCardHTML).join('');
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

  routeFromHash();
  render();
  if (location.hash === '#heritage' || location.hash === '#/heritage') {
    requestAnimationFrame(() => {
      const el = document.getElementById('heritage');
      if (el) el.scrollIntoView();
    });
  }
})();
