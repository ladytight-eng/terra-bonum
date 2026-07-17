(() => {
  'use strict';

  const TOKEN_KEY = 'terrabonum_admin_pw';

  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const productForm = document.getElementById('productForm');
  const formError = document.getElementById('formError');
  const productList = document.getElementById('productList');
  const productCount = document.getElementById('productCount');
  const formTitle = document.getElementById('formTitle');
  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const pPreview = document.getElementById('pPreview');
  const pPreviewImg = document.getElementById('pPreviewImg');

  let editingId = null;

  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch (e) { return ''; }
  }
  function setToken(pw) {
    try { localStorage.setItem(TOKEN_KEY, pw); } catch (e) {}
  }
  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  // Wraps fetch for admin endpoints: attaches the stored password as a
  // header, and surfaces network/auth failures instead of failing silently.
  async function api(url, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers, { 'x-admin-password': getToken() });
    let res;
    try {
      res = await fetch(url, Object.assign({ cache: 'no-store' }, opts, { headers }));
    } catch (err) {
      throw new Error('Could not reach the server. Make sure it is running, then try again.');
    }
    if (res.status === 401) {
      clearToken();
      showLogin('Your session is no longer valid — please sign in again.');
      throw new Error('Not authenticated');
    }
    return res;
  }

  function showLogin(message) {
    loginView.hidden = false;
    appView.hidden = true;
    if (message) {
      loginError.textContent = message;
      loginError.hidden = false;
    }
  }
  function showApp() {
    loginView.hidden = true;
    appView.hidden = false;
    loadProducts().catch(() => {});
    loadVideos().catch(() => {});
    loadAbout().catch(() => {});
    loadMoments().catch(() => {});
    loadPolicy().catch(() => {});
  }

  async function checkSession() {
    if (!getToken()) { showLogin(); return; }
    try {
      const res = await api('/api/admin/products');
      if (res.ok) showApp();
    } catch (e) {
      // api() already switched to the login view on failure
    }
  }

  const loginPasswordInput = document.getElementById('loginPassword');
  const loginHint = document.getElementById('loginHint');
  loginPasswordInput.addEventListener('input', () => {
    const len = loginPasswordInput.value.length;
    loginHint.textContent = len === 0 ? 'Nothing typed yet' : len + ' character' + (len === 1 ? '' : 's') + ' typed: "' + loginPasswordInput.value + '"';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = loginPasswordInput.value;
    if (!password) {
      loginError.textContent = 'Type the password into the box above first.';
      loginError.hidden = false;
      return;
    }
    let res;
    try {
      res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
    } catch (err) {
      loginError.textContent = 'Could not reach the server. Make sure it is running, then try again.';
      loginError.hidden = false;
      return;
    }
    if (res.ok) {
      setToken(password);
      loginForm.reset();
      showApp();
    } else {
      loginError.textContent = 'Incorrect password. Please try again.';
      loginError.hidden = false;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearToken();
    showLogin();
  });

  function resetForm() {
    editingId = null;
    productForm.reset();
    document.getElementById('pId').value = '';
    pPreview.hidden = true;
    formTitle.textContent = 'Add a new piece';
    submitBtn.textContent = 'Add product';
    cancelEditBtn.hidden = true;
    formError.hidden = true;
  }

  cancelEditBtn.addEventListener('click', resetForm);

  function rowHTML(p) {
    return `
      <div class="admin-row" data-id="${p.id}">
        <div class="admin-row__img"><img src="${p.img}" alt="${p.name}"></div>
        <div class="admin-row__info">
          <div class="admin-row__name">${p.name}</div>
          <div class="admin-row__meta">${p.collection || p.category || '—'} · ${p.tag || 'No tag'}</div>
        </div>
        <div class="admin-row__price">${money(p.price)}</div>
        <div class="admin-row__actions">
          <button data-edit="${p.id}">Edit</button>
          <button class="danger" data-delete="${p.id}">Delete</button>
        </div>
      </div>`;
  }

  let cache = [];

  async function loadProducts() {
    const res = await api('/api/admin/products');
    cache = await res.json();
    productCount.textContent = cache.length;
    productList.innerHTML = cache.length
      ? cache.map(rowHTML).join('')
      : '<div class="admin-empty">No products yet — add your first piece above.</div>';
  }

  productList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) { startEdit(editBtn.dataset.edit); return; }
    const delBtn = e.target.closest('[data-delete]');
    if (delBtn) { deleteProduct(delBtn.dataset.delete); return; }
  });

  function startEdit(id) {
    const p = cache.find(x => x.id === id);
    if (!p) return;
    editingId = id;
    document.getElementById('pId').value = id;
    document.getElementById('pName').value = p.name || '';
    document.getElementById('pPrice').value = p.price || '';
    document.getElementById('pCategory').value = p.category || '';
    document.getElementById('pCollection').value = p.collection || '';
    document.getElementById('pMeaning').value = p.meaning || '';
    document.getElementById('pTag').value = p.tag || '';
    document.getElementById('pSize').value = p.size || '';
    document.getElementById('pDesc').value = p.desc || '';
    document.getElementById('pImage').value = '';
    pPreviewImg.src = p.img;
    pPreview.hidden = false;
    formTitle.textContent = 'Edit “' + p.name + '”';
    submitBtn.textContent = 'Save changes';
    cancelEditBtn.hidden = false;
    formError.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    try {
      const res = await api('/api/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res.ok) {
        if (editingId === id) resetForm();
        loadProducts();
      }
    } catch (err) {
      // api() already surfaced the error via the login view or will retry
    }
  }

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.hidden = true;
    const fd = new FormData();
    fd.append('name', document.getElementById('pName').value.trim());
    fd.append('price', document.getElementById('pPrice').value);
    fd.append('category', document.getElementById('pCategory').value.trim());
    fd.append('collection', document.getElementById('pCollection').value.trim());
    fd.append('meaning', document.getElementById('pMeaning').value.trim());
    fd.append('tag', document.getElementById('pTag').value.trim());
    fd.append('size', document.getElementById('pSize').value.trim());
    fd.append('desc', document.getElementById('pDesc').value.trim());
    const file = document.getElementById('pImage').files[0];
    if (file) fd.append('image', file);

    const url = editingId ? '/api/admin/products/' + encodeURIComponent(editingId) : '/api/admin/products';
    const method = editingId ? 'PUT' : 'POST';
    try {
      const res = await api(url, { method, body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        formError.textContent = data.error || 'Something went wrong. Please try again.';
        formError.hidden = false;
        return;
      }
      resetForm();
      loadProducts();
    } catch (err) {
      formError.textContent = err.message || 'Something went wrong. Please try again.';
      formError.hidden = false;
    }
  });

  // ---- Watch the craft: video management ----
  const videoForm = document.getElementById('videoForm');
  const videoFormError = document.getElementById('videoFormError');
  const videoList = document.getElementById('videoList');
  const videoCount = document.getElementById('videoCount');
  const videoSubmitBtn = document.getElementById('videoSubmitBtn');
  const videoFormTitle = document.getElementById('videoFormTitle');
  const videoCancelEditBtn = document.getElementById('videoCancelEditBtn');
  const vFileInput = document.getElementById('vFile');

  let editingVideoId = null;
  let videoCache = [];

  function videoRowHTML(v) {
    return `
      <div class="admin-row admin-row--video" data-id="${v.id}">
        <div class="admin-row__img"><video src="${v.video}" muted preload="metadata"></video></div>
        <div class="admin-row__info">
          <div class="admin-row__name">${v.title}</div>
          <div class="admin-row__meta">${v.caption || 'No caption'}</div>
        </div>
        <div class="admin-row__actions">
          <button data-video-edit="${v.id}">Edit</button>
          <button class="danger" data-video-delete="${v.id}">Delete</button>
        </div>
      </div>`;
  }

  async function loadVideos() {
    const res = await api('/api/admin/videos');
    videoCache = await res.json();
    videoCount.textContent = videoCache.length;
    videoList.innerHTML = videoCache.length
      ? videoCache.map(videoRowHTML).join('')
      : '<div class="admin-empty">No videos yet — upload your first clip above.</div>';
  }

  videoList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-video-edit]');
    if (editBtn) { startVideoEdit(editBtn.dataset.videoEdit); return; }
    const delBtn = e.target.closest('[data-video-delete]');
    if (delBtn) deleteVideo(delBtn.dataset.videoDelete);
  });

  function startVideoEdit(id) {
    const v = videoCache.find(x => x.id === id);
    if (!v) return;
    editingVideoId = id;
    document.getElementById('vId').value = id;
    document.getElementById('vTitle').value = v.title || '';
    document.getElementById('vCaption').value = v.caption || '';
    vFileInput.value = '';
    vFileInput.required = false;
    videoFormTitle.textContent = 'Edit “' + v.title + '”';
    videoSubmitBtn.textContent = 'Save changes';
    videoCancelEditBtn.hidden = false;
    videoFormError.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetVideoForm() {
    editingVideoId = null;
    videoForm.reset();
    document.getElementById('vId').value = '';
    vFileInput.required = true;
    videoFormTitle.textContent = 'Watch the craft — add a video';
    videoSubmitBtn.textContent = 'Upload video';
    videoCancelEditBtn.hidden = true;
    videoFormError.hidden = true;
  }

  videoCancelEditBtn.addEventListener('click', resetVideoForm);

  async function deleteVideo(id) {
    if (!confirm('Delete this video? This cannot be undone.')) return;
    try {
      const res = await api('/api/admin/videos/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res.ok) {
        if (editingVideoId === id) resetVideoForm();
        loadVideos();
      }
    } catch (err) {
      // api() already surfaced the error via the login view
    }
  }

  videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    videoFormError.hidden = true;
    const file = vFileInput.files[0];
    if (!editingVideoId && !file) {
      videoFormError.textContent = 'Choose a video file first.';
      videoFormError.hidden = false;
      return;
    }
    const fd = new FormData();
    fd.append('title', document.getElementById('vTitle').value.trim());
    fd.append('caption', document.getElementById('vCaption').value.trim());
    if (file) fd.append('video', file);

    const url = editingVideoId ? '/api/admin/videos/' + encodeURIComponent(editingVideoId) : '/api/admin/videos';
    const method = editingVideoId ? 'PUT' : 'POST';

    videoSubmitBtn.disabled = true;
    videoSubmitBtn.textContent = editingVideoId ? 'Saving…' : 'Uploading…';
    try {
      const res = await api(url, { method, body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        videoFormError.textContent = data.error || 'Something went wrong. Please try again.';
        videoFormError.hidden = false;
        return;
      }
      resetVideoForm();
      loadVideos();
    } catch (err) {
      videoFormError.textContent = err.message || 'Something went wrong. Please try again.';
      videoFormError.hidden = false;
    } finally {
      videoSubmitBtn.disabled = false;
      videoSubmitBtn.textContent = editingVideoId ? 'Save changes' : 'Upload video';
    }
  });

  // ---- Meet the maker: about section ----
  const aboutForm = document.getElementById('aboutForm');
  const aboutFormError = document.getElementById('aboutFormError');
  const aboutFormSuccess = document.getElementById('aboutFormSuccess');
  const aboutSubmitBtn = document.getElementById('aboutSubmitBtn');
  const aPreview = document.getElementById('aPreview');
  const aPreviewImg = document.getElementById('aPreviewImg');

  async function loadAbout() {
    const res = await api('/api/admin/about');
    const about = await res.json();
    document.getElementById('aName').value = about.name || '';
    document.getElementById('aRole').value = about.role || '';
    document.getElementById('aBio').value = about.bio || '';
    if (about.photo) {
      aPreviewImg.src = about.photo;
      aPreview.hidden = false;
    } else {
      aPreview.hidden = true;
    }
  }

  aboutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    aboutFormError.hidden = true;
    aboutFormSuccess.hidden = true;
    const fd = new FormData();
    fd.append('name', document.getElementById('aName').value.trim());
    fd.append('role', document.getElementById('aRole').value.trim());
    fd.append('bio', document.getElementById('aBio').value.trim());
    const file = document.getElementById('aPhoto').files[0];
    if (file) fd.append('photo', file);

    aboutSubmitBtn.disabled = true;
    aboutSubmitBtn.textContent = 'Saving…';
    try {
      const res = await api('/api/admin/about', { method: 'PUT', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        aboutFormError.textContent = data.error || 'Something went wrong. Please try again.';
        aboutFormError.hidden = false;
        return;
      }
      const updated = await res.json();
      if (updated.photo) {
        aPreviewImg.src = updated.photo;
        aPreview.hidden = false;
      }
      document.getElementById('aPhoto').value = '';
      aboutFormSuccess.hidden = false;
    } catch (err) {
      aboutFormError.textContent = err.message || 'Something went wrong. Please try again.';
      aboutFormError.hidden = false;
    } finally {
      aboutSubmitBtn.disabled = false;
      aboutSubmitBtn.textContent = 'Save';
    }
  });

  // ---- Customer moments ----
  const momentForm = document.getElementById('momentForm');
  const momentFormError = document.getElementById('momentFormError');
  const momentList = document.getElementById('momentList');
  const momentCount = document.getElementById('momentCount');
  const momentSubmitBtn = document.getElementById('momentSubmitBtn');
  const momentFormTitle = document.getElementById('momentFormTitle');
  const momentCancelEditBtn = document.getElementById('momentCancelEditBtn');
  const mFileInput = document.getElementById('mFile');
  const mPreview = document.getElementById('mPreview');
  const mPreviewImg = document.getElementById('mPreviewImg');

  let editingMomentId = null;
  let momentCache = [];

  function momentRowHTML(m) {
    const thumb = m.mediaType === 'video'
      ? `<video src="${m.media}" muted preload="metadata"></video>`
      : `<img src="${m.media}" alt="${m.customerName || 'Customer moment'}">`;
    const label = [m.customerName, m.occasion].filter(Boolean).join(' · ') || 'No details added';
    return `
      <div class="admin-row admin-row--video" data-id="${m.id}">
        <div class="admin-row__img">${thumb}</div>
        <div class="admin-row__info">
          <div class="admin-row__name">${label}</div>
          <div class="admin-row__meta">${m.mediaType === 'video' ? 'Video' : 'Photo'}</div>
        </div>
        <div class="admin-row__actions">
          <button data-moment-edit="${m.id}">Edit</button>
          <button class="danger" data-moment-delete="${m.id}">Delete</button>
        </div>
      </div>`;
  }

  async function loadMoments() {
    const res = await api('/api/admin/moments');
    momentCache = await res.json();
    momentCount.textContent = momentCache.length;
    momentList.innerHTML = momentCache.length
      ? momentCache.map(momentRowHTML).join('')
      : '<div class="admin-empty">No moments yet — add your first one above.</div>';
  }

  momentList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-moment-edit]');
    if (editBtn) { startMomentEdit(editBtn.dataset.momentEdit); return; }
    const delBtn = e.target.closest('[data-moment-delete]');
    if (delBtn) deleteMoment(delBtn.dataset.momentDelete);
  });

  function startMomentEdit(id) {
    const m = momentCache.find(x => x.id === id);
    if (!m) return;
    editingMomentId = id;
    document.getElementById('mId').value = id;
    document.getElementById('mName').value = m.customerName || '';
    document.getElementById('mOccasion').value = m.occasion || '';
    mFileInput.value = '';
    mFileInput.required = false;
    if (m.mediaType === 'image') {
      mPreviewImg.src = m.media;
      mPreview.hidden = false;
    } else {
      mPreview.hidden = true;
    }
    momentFormTitle.textContent = 'Edit moment';
    momentSubmitBtn.textContent = 'Save changes';
    momentCancelEditBtn.hidden = false;
    momentFormError.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetMomentForm() {
    editingMomentId = null;
    momentForm.reset();
    document.getElementById('mId').value = '';
    mFileInput.required = true;
    mPreview.hidden = true;
    momentFormTitle.textContent = 'Customer moments — add a photo or video';
    momentSubmitBtn.textContent = 'Add moment';
    momentCancelEditBtn.hidden = true;
    momentFormError.hidden = true;
  }

  momentCancelEditBtn.addEventListener('click', resetMomentForm);

  async function deleteMoment(id) {
    if (!confirm('Delete this moment? This cannot be undone.')) return;
    try {
      const res = await api('/api/admin/moments/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res.ok) {
        if (editingMomentId === id) resetMomentForm();
        loadMoments();
      }
    } catch (err) {
      // api() already surfaced the error via the login view
    }
  }

  momentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    momentFormError.hidden = true;
    const file = mFileInput.files[0];
    if (!editingMomentId && !file) {
      momentFormError.textContent = 'Choose a photo or video first.';
      momentFormError.hidden = false;
      return;
    }
    const fd = new FormData();
    fd.append('customerName', document.getElementById('mName').value.trim());
    fd.append('occasion', document.getElementById('mOccasion').value.trim());
    if (file) fd.append('media', file);

    const url = editingMomentId ? '/api/admin/moments/' + encodeURIComponent(editingMomentId) : '/api/admin/moments';
    const method = editingMomentId ? 'PUT' : 'POST';

    momentSubmitBtn.disabled = true;
    momentSubmitBtn.textContent = editingMomentId ? 'Saving…' : 'Uploading…';
    try {
      const res = await api(url, { method, body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        momentFormError.textContent = data.error || 'Something went wrong. Please try again.';
        momentFormError.hidden = false;
        return;
      }
      resetMomentForm();
      loadMoments();
    } catch (err) {
      momentFormError.textContent = err.message || 'Something went wrong. Please try again.';
      momentFormError.hidden = false;
    } finally {
      momentSubmitBtn.disabled = false;
      momentSubmitBtn.textContent = editingMomentId ? 'Save changes' : 'Add moment';
    }
  });

  // ---- Shipping & Returns policy ----
  const policyForm = document.getElementById('policyForm');
  const policyFormError = document.getElementById('policyFormError');
  const policyFormSuccess = document.getElementById('policyFormSuccess');
  const policySubmitBtn = document.getElementById('policySubmitBtn');
  const pContent = document.getElementById('pContent');

  async function loadPolicy() {
    const res = await api('/api/admin/policy');
    const policy = await res.json();
    pContent.value = policy.content || '';
  }

  policyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    policyFormError.hidden = true;
    policyFormSuccess.hidden = true;
    policySubmitBtn.disabled = true;
    policySubmitBtn.textContent = 'Saving…';
    try {
      const res = await api('/api/admin/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: pContent.value })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        policyFormError.textContent = data.error || 'Something went wrong. Please try again.';
        policyFormError.hidden = false;
        return;
      }
      policyFormSuccess.hidden = false;
    } catch (err) {
      policyFormError.textContent = err.message || 'Something went wrong. Please try again.';
      policyFormError.hidden = false;
    } finally {
      policySubmitBtn.disabled = false;
      policySubmitBtn.textContent = 'Save';
    }
  });

  checkSession();
})();
