/* BANNEI MOD LQ — Telegram Mini App */
const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); tg.enableClosingConfirmation?.(); }

const ADMIN_ID = 2056107378;

const $ = (id) => document.getElementById(id);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

const state = {
  catalog: {},
  cart: {},
  currentLetter: null,
  currentHero: null,
};

const EXTRA_KEYS = new Set(['Cam Xa', 'HD Chiêu', 'MOD ROV', 'Máy Yếu', 'Nút Bấm']);

/* ───────────────────────── TELEGRAM LOGIN ───────────────────────── */
function loginTelegram() {
  const u = tg?.initDataUnsafe?.user;
  if (!u) {
    $('userName').textContent = 'Khách (mở qua Telegram)';
    $('userId').textContent = 'Chưa đăng nhập';
    $('avatar').textContent = '?';
    $('vipText').textContent = 'N/A';
    $('vipPill').classList.add('none');
    return;
  }
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'User';
  $('userName').textContent = name;
  $('userId').textContent = `ID: ${u.id}`;
  if (u.photo_url) {
    $('avatar').innerHTML = `<img src="${u.photo_url}" alt="">`;
  } else {
    $('avatar').textContent = (u.first_name || '?')[0].toUpperCase();
  }

  // VIP check: parse start_param (vip:<days_left>) if bot passed it
  const sp = tg.initDataUnsafe?.start_param || '';
  if (sp.startsWith('vip:')) {
    const days = parseInt(sp.slice(4), 10);
    if (days > 0) {
      $('vipText').textContent = `VIP ${days} ngày`;
      $('vipPill').classList.remove('none','expired');
    } else {
      $('vipText').textContent = 'VIP hết hạn';
      $('vipPill').classList.add('expired');
    }
  } else {
    $('vipText').textContent = 'Free';
    $('vipPill').classList.add('none');
  }

  // Show admin tab if user is admin
  if (u.id === ADMIN_ID) {
    qsa('.admin-only').forEach(el => el.hidden = false);
    document.querySelector('.tabs')?.classList.add('with-admin');
    $('vipText').textContent = '👑 ADMIN';
    $('vipPill').classList.remove('none','expired');
    $('vipPill').style.background = 'linear-gradient(135deg,rgba(255,210,95,.3),rgba(255,107,154,.2))';
    $('vipPill').style.color = '#ffd25f';
    $('vipPill').style.borderColor = 'rgba(255,210,95,.5)';
  }
}

/* ───────────────────────── CATALOG ───────────────────────── */
async function loadCatalog() {
  $('loader').hidden = false;
  $('loaderText').textContent = 'Đang tải catalog…';
  try {
    const res = await fetch('catalog.json?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.catalog = await res.json();
    const n = Object.keys(state.catalog).length;
    if (!n) throw new Error('catalog rỗng');
    $('loader').hidden = true;
    renderAlphabet();
  } catch (e) {
    $('loaderText').innerHTML =
      '❌ Lỗi tải catalog<br><small style="opacity:.6">' + e.message + '</small>';
    toast('Không tải được catalog: ' + e.message, 'error');
  }
}

/* ───────────────────────── TABS ───────────────────────── */
qsa('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    qsa('.tab').forEach(b => b.classList.toggle('active', b === btn));
    qsa('.page').forEach(p => p.classList.toggle('active', p.id === `page-${tab}`));
    haptic('light');
    if (tab === 'cart') renderCart();
  });
});

/* ───────────────────────── HEROES PAGE ───────────────────────── */
function renderAlphabet() {
  const folders = Object.keys(state.catalog);
  const letters = [...new Set(folders.map(f => f[0].toUpperCase()))].sort();
  const grid = $('alphaGrid');
  grid.innerHTML = '';
  letters.forEach(L => {
    const cell = document.createElement('button');
    cell.className = 'alpha-cell';
    cell.textContent = L;
    cell.addEventListener('click', () => openLetter(L));
    grid.appendChild(cell);
  });
}

function openLetter(L) {
  state.currentLetter = L;
  haptic('medium');
  const folders = Object.keys(state.catalog)
    .filter(f => f[0].toUpperCase() === L).sort();
  $('heroListTitle').textContent = `Tướng bắt đầu bằng "${L}"`;
  const grid = $('heroGrid');
  grid.innerHTML = '';
  folders.forEach((f, i) => {
    const cell = document.createElement('button');
    cell.className = 'hero-cell';
    cell.textContent = f;
    cell.style.animationDelay = `${i * 0.025}s`;
    cell.addEventListener('click', () => openHero(f));
    grid.appendChild(cell);
  });
  $('alphaGrid').hidden = true;
  $('heroListWrap').hidden = false;
  $('skinListWrap').hidden = true;
}

$('heroBack').addEventListener('click', () => {
  $('alphaGrid').hidden = false;
  $('heroListWrap').hidden = true;
  haptic('light');
});

function openHero(folder) {
  state.currentHero = folder;
  haptic('medium');
  const skins = state.catalog[folder] || [];
  $('skinListTitle').textContent = `${folder} — Chọn skin`;
  const grid = $('skinGrid');
  grid.innerHTML = '';
  if (!skins.length) {
    grid.innerHTML = `<div class="empty"><p>Tướng này chưa có skin.</p></div>`;
  } else {
    skins.forEach((s, i) => {
      const cell = document.createElement('button');
      cell.className = 'skin-cell';
      if (state.cart[folder] === s) cell.classList.add('selected');
      cell.innerHTML = `<span>${escapeHtml(s)}</span>`;
      cell.style.animationDelay = `${i * 0.03}s`;
      cell.addEventListener('click', () => pickSkin(folder, s, cell));
      grid.appendChild(cell);
    });
  }
  $('heroListWrap').hidden = true;
  $('skinListWrap').hidden = false;
}

$('skinBack').addEventListener('click', () => {
  $('heroListWrap').hidden = false;
  $('skinListWrap').hidden = true;
  haptic('light');
});

function pickSkin(folder, skin, cellEl) {
  state.cart[folder] = skin;
  saveCart();
  qsa('.skin-cell', $('skinGrid')).forEach(c => c.classList.remove('selected'));
  cellEl.classList.add('selected');
  haptic('success');
  toast(`✓ ${folder}: ${shorten(skin, 26)}`, 'success');
  updateBadge();
}

/* ───────────────────────── EXTRAS PAGE ───────────────────────── */
qsa('.extra-card').forEach(card => {
  card.addEventListener('click', () => {
    const e = card.dataset.extra;
    haptic('medium');
    if (e === 'camxa') return openZoomPicker();
    if (e === 'hdchieu') return toggleExtra('HD Chiêu', 'HD', card);
    if (e === 'modrov')  return toggleExtra('MOD ROV', 'rov', card);
    if (e === 'mayyeu')  return toggleExtra('Máy Yếu', 'mayyeu', card);
  });
});

function toggleExtra(key, source, cardEl) {
  if (state.cart[key]) {
    delete state.cart[key];
    cardEl.classList.remove('selected');
    toast(`✗ Đã bỏ ${key}`);
  } else {
    state.cart[key] = source;
    cardEl.classList.add('selected');
    toast(`✓ Đã thêm ${key}`, 'success');
    haptic('success');
  }
  saveCart();
  updateBadge();
}

function openZoomPicker() {
  const grid = $('zoomGrid');
  grid.innerHTML = '';
  let i = 0;
  for (let z = 105; z < 300; z += 5) {
    const b = document.createElement('button');
    b.className = 'zoom-cell';
    b.textContent = `${z}%`;
    b.style.animationDelay = `${(i++) * 0.012}s`;
    b.addEventListener('click', () => {
      state.cart['Cam Xa'] = `${z}%`;
      saveCart();
      haptic('success');
      toast(`✓ Cam Xa ${z}%`, 'success');
      // mark card selected
      qsa('.extra-card').forEach(c => {
        if (c.dataset.extra === 'camxa') c.classList.add('selected');
      });
      $('zoomPicker').hidden = true;
      $('extrasList')?.removeAttribute('hidden');
      qsa('.extras-list')[0].style.display = '';
      updateBadge();
    });
    grid.appendChild(b);
  }
  qsa('.extras-list')[0].style.display = 'none';
  $('zoomPicker').hidden = false;
}

$('zoomBack').addEventListener('click', () => {
  $('zoomPicker').hidden = true;
  qsa('.extras-list')[0].style.display = '';
  haptic('light');
});

/* ───────────────────────── CART PAGE ───────────────────────── */
function renderCart() {
  const list = $('cartList');
  const empty = $('cartEmpty');
  const actions = $('cartActions');
  const entries = Object.entries(state.cart);
  list.innerHTML = '';
  if (!entries.length) {
    empty.hidden = false;
    actions.hidden = true;
    return;
  }
  empty.hidden = true;
  actions.hidden = false;
  entries.forEach(([k, v], i) => {
    const isExtra = EXTRA_KEYS.has(k);
    const div = document.createElement('div');
    div.className = 'cart-item' + (isExtra ? ' extra' : '');
    div.style.animationDelay = `${i * 0.04}s`;
    div.innerHTML = `
      <div class="cart-icon">${isExtra ? '🛠️' : '🎭'}</div>
      <div>
        <div class="cart-name">${escapeHtml(k)}</div>
        <div class="cart-source">${escapeHtml(v)}</div>
      </div>
      <button class="cart-del" data-key="${escapeAttr(k)}">✕</button>
    `;
    list.appendChild(div);
  });
  qsa('.cart-del', list).forEach(b => {
    b.addEventListener('click', () => {
      const key = b.dataset.key;
      const item = b.closest('.cart-item');
      item.classList.add('removing');
      haptic('warning');
      setTimeout(() => {
        delete state.cart[key];
        saveCart();
        updateBadge();
        renderCart();
      }, 280);
    });
  });
}

$('clearBtn').addEventListener('click', () => {
  if (!Object.keys(state.cart).length) return;
  if (!confirm('Xoá toàn bộ giỏ?')) return;
  state.cart = {};
  saveCart();
  updateBadge();
  renderCart();
  haptic('warning');
  toast('🧹 Đã xoá sạch giỏ', 'success');
});

$('runBtn').addEventListener('click', () => {
  const entries = Object.entries(state.cart);
  if (!entries.length) { toast('Giỏ trống!', 'error'); return; }
  if (!tg) { toast('Cần mở qua Telegram!', 'error'); return; }

  haptic('success');
  fireConfetti();

  const payload = {
    type: 'chaymod',
    items: state.cart,
    ts: Date.now(),
  };
  try {
    tg.sendData(JSON.stringify(payload));
  } catch (e) {
    toast('Lỗi gửi: ' + e.message, 'error');
    return;
  }

  showRunOverlay(entries.length);
});

function showRunOverlay(itemCount) {
  $('runOverlay').hidden = false;
  $('runTitle').textContent = '🎉 Đã gửi yêu cầu!';
  $('runMsg').innerHTML =
    `Bot đang xử lý <b>${itemCount}</b> mục Mod.<br>Quay lại chat để nhận file ZIP nhé!`;

  const steps = [
    { p: 15, t: '🔄 Đã nhận dữ liệu, đang khởi tạo...' },
    { p: 40, t: '🛠️ Đang ghép mã Mod...' },
    { p: 70, t: '📦 Đang đóng gói file ZIP...' },
    { p: 95, t: '📤 Sắp gửi file vào chat của bạn...' },
  ];
  let i = 0;
  const bar = $('runBar');
  const status = $('runStatus');
  bar.style.width = '5%';
  status.textContent = '⏳ Đang gửi yêu cầu...';
  status.classList.remove('ok');

  const tick = () => {
    if (i >= steps.length) {
      bar.style.width = '100%';
      status.textContent = '✅ Hoàn tất gửi yêu cầu. Mở chat để xem file!';
      status.classList.add('ok');
      return;
    }
    const s = steps[i++];
    bar.style.width = s.p + '%';
    status.textContent = s.t;
    setTimeout(tick, 1100 + Math.random() * 600);
  };
  setTimeout(tick, 500);

  // Cleanup cart after send
  state.cart = {};
  saveCart();
  updateBadge();
  renderCart();
}

$('runClose').addEventListener('click', () => {
  haptic('light');
  $('runOverlay').hidden = true;
  // Optional: close mini app khi user chủ động bấm
  setTimeout(() => tg?.close?.(), 200);
});

/* ───────────────────────── SEARCH ───────────────────────── */
$('searchInput').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const wrap = $('searchResults');
  wrap.innerHTML = '';
  if (q.length < 2) return;
  const hits = [];
  for (const [folder, skins] of Object.entries(state.catalog)) {
    if (folder.toLowerCase().includes(q)) {
      skins.forEach(s => hits.push({ folder, skin: s, score: 2 }));
    } else {
      skins.forEach(s => {
        if (s.toLowerCase().includes(q)) hits.push({ folder, skin: s, score: 1 });
      });
    }
    if (hits.length > 50) break;
  }
  hits.slice(0, 40).forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'search-row';
    row.style.animationDelay = `${i * 0.02}s`;
    row.innerHTML = `<div><b>${escapeHtml(h.folder)}</b><div class="meta">${escapeHtml(h.skin)}</div></div><span>›</span>`;
    row.addEventListener('click', () => {
      state.cart[h.folder] = h.skin;
      saveCart();
      updateBadge();
      haptic('success');
      toast(`✓ ${h.folder}: ${shorten(h.skin, 22)}`, 'success');
    });
    wrap.appendChild(row);
  });
  if (!hits.length) {
    wrap.innerHTML = `<div class="empty"><p>Không tìm thấy "${escapeHtml(q)}"</p></div>`;
  }
});

/* ───────────────────────── UTIL ───────────────────────── */
function saveCart() {
  try { localStorage.setItem('bannei_cart', JSON.stringify(state.cart)); } catch {}
}
function loadCartLocal() {
  try {
    const v = localStorage.getItem('bannei_cart');
    if (v) state.cart = JSON.parse(v) || {};
  } catch {}
}
function updateBadge() {
  const n = Object.keys(state.cart).length;
  const el = $('cartBadge');
  el.textContent = n ? n : '';
  if (n) el.removeAttribute('data-zero'); else el.setAttribute('data-zero','');
}
function toast(msg, type='') {
  const t = $('toast');
  t.className = 'toast show ' + type;
  t.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = 'toast'; }, 2200);
}
function haptic(kind='light') {
  try {
    const h = tg?.HapticFeedback;
    if (!h) return;
    if (['success','warning','error'].includes(kind)) h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {}
}
function escapeHtml(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function escapeAttr(s){ return escapeHtml(s).replace(/'/g,'&#39;'); }
function shorten(s, n){ return s.length>n ? s.slice(0,n-1)+'…' : s; }

function fireConfetti() {
  const wrap = $('confetti');
  wrap.innerHTML = '';
  const colors = ['#6c8cff','#b16cff','#ffd25f','#ff6b9a','#34d399'];
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = (Math.random() * 0.4) + 's';
    s.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
    s.style.transform = `rotate(${Math.random()*360}deg)`;
    wrap.appendChild(s);
  }
  setTimeout(() => wrap.innerHTML = '', 2400);
}

/* ───────────────────────── ADMIN ACTIONS ───────────────────────── */
function bindAdminButtons() {
  qsa('.admin-card button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => onAdminClick(btn));
  });
}

function onAdminClick(btn) {
  const act = btn.dataset.act;
  const confirmMsg = btn.dataset.confirm;
  if (confirmMsg && !confirm(confirmMsg)) return;
  if (!tg) { toast('Cần mở qua Telegram!', 'error'); return; }

  const args = {};
  let valid = true;

  switch (act) {
    case 'vipmember':
      args.user_id = $('adm_vip_uid').value.trim();
      args.days = $('adm_vip_days').value.trim();
      if (!args.user_id || !args.days) { toast('Điền đủ User ID + ngày', 'error'); valid = false; }
      break;
    case 'congvipall':
      args.days = $('adm_all_days').value.trim();
      if (!args.days) { toast('Nhập số ngày', 'error'); valid = false; }
      break;
    case 'resetvip':
      args.user_id = $('adm_reset_uid').value.trim();
      if (!args.user_id) { toast('Nhập User ID', 'error'); valid = false; }
      break;
    case 'ban':
      args.user_id = $('adm_ban_uid').value.trim();
      if (!args.user_id) { toast('Nhập User ID', 'error'); valid = false; }
      break;
    case 'unban':
      args.user_id = $('adm_unban_uid').value.trim();
      if (!args.user_id) { toast('Nhập User ID', 'error'); valid = false; }
      break;
    case 'guiall':
      args.text = $('adm_broadcast').value.trim();
      if (!args.text) { toast('Nhập nội dung', 'error'); valid = false; }
      break;
    case 'resetvipall':
    case 'tatkey':
    case 'batkey':
    case 'listvip':
      // no args
      break;
  }

  if (!valid) { haptic('error'); return; }

  haptic('success');
  const payload = { type: 'admin', action: act, args, ts: Date.now() };
  try {
    tg.sendData(JSON.stringify(payload));
  } catch (e) {
    toast('Lỗi gửi: ' + e.message, 'error');
    return;
  }
  toast('📤 Đã gửi → kiểm tra chat bot', 'success');
}

/* ───────────────────────── BOOT ───────────────────────── */
loginTelegram();
loadCartLocal();
updateBadge();
bindAdminButtons();
loadCatalog();

// Apply Telegram theme on change
tg?.onEvent?.('themeChanged', () => {
  // CSS vars auto-applied; nothing manual needed
});
