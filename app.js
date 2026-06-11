/* ═══════════════════════════════════════════════════════════════
   BANNEI MOD LQ — LIQUID GLASS 6.0 · app.js
   ═══════════════════════════════════════════════════════════════ */

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation?.();
  try { tg.setHeaderColor?.('secondary_bg_color'); } catch {}
  try { tg.setBackgroundColor?.('#07080d'); } catch {}
}

const ADMIN_ID = 2056107378;
const ADMIN_CONTACT = 'https://t.me/quangbaong';

/* ── selectors ── */
const $ = (id) => document.getElementById(id);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];

/* ── state ── */
const state = {
  catalog: {},
  cart: {},
  currentLetter: null,
  currentHero: null,
  isAdmin: false,
  isVip: false,
  vipDays: 0,
  totalHeroes: 0,
  totalSkins: 0,
  settings: loadSettings(),
  heroIcons: {},
  skinCodes: {},
};

const EXTRA_KEYS = new Set(['Cam Xa', 'HD Chiêu', 'Server']);
// Server mod — mỗi server = 1 thư mục Resources* trong BANNEI_SOURCE (khớp bot.py SERVER_LABELS).
const SERVERS = [
  { dir: 'Resources',    label: '🇻🇳 Việt Nam (Garena)' },
  { dir: 'Resources_EU', label: '🇪🇺 Châu Âu (EU)' },
  { dir: 'Resources_TH', label: '🇹🇭 Thái Lan (TH)' },
  { dir: 'Resources_TW', label: '🇹🇼 Đài Loan (TW)' },
];

/* ═══════════════════════════════════════════════════════════════
   WEB ↔ BOT API BRIDGE  (1 luồng: gửi lệnh + nhận phản hồi tại chỗ)
   - API_BASE: bot tự gắn qua ?api=<tunnel> khi mở Mini App
   - INIT_DATA: chuỗi gốc để bot xác thực (HMAC) chống giả mạo
   ═══════════════════════════════════════════════════════════════ */
const _urlp = new URLSearchParams(location.search);
let API_BASE = (_urlp.get('api') || '').replace(/\/+$/, '');
// Nhớ địa chỉ API: mở đúng 1 lần (qua nút có ?api=) thì lần sau nút menu cũ vẫn chạy
if (API_BASE) {
  try { localStorage.setItem('bannei_api', API_BASE); } catch {}
} else {
  try { API_BASE = (localStorage.getItem('bannei_api') || '').replace(/\/+$/, ''); } catch {}
}
const INIT_DATA = tg?.initData || '';
const API_READY = !!(API_BASE && INIT_DATA);
let _pollSeq = 0;
let _pollTimer = null;

// Tự kiểm tra & báo trạng thái kết nối bot (giúp chẩn đoán "không chạy")
async function checkApiConnection() {
  if (!INIT_DATA) {
    toast('⚠️ Hãy mở Mini App TRONG Telegram (nút bàn phím), không mở bằng trình duyệt.', 'error');
    return;
  }
  if (!API_BASE) {
    toast('⚠️ Chưa có địa chỉ bot. Gõ /start trong bot rồi mở lại Mini App.', 'error');
    return;
  }
  try {
    const r = await fetch(API_BASE + '/api/health', { cache: 'no-store' });
    const j = await r.json();
    if (j && j.ok) toast('🟢 Đã kết nối bot trực tiếp', 'success');
    else throw new Error('bad');
  } catch {
    toast('⚠️ Không kết nối được bot (tunnel có thể đã đổi). Gõ /start rồi mở lại.', 'error');
  }
}

async function apiSend(payload, silent) {
  try {
    const res = await fetch(API_BASE + '/api/cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: INIT_DATA, ...payload }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      if (!silent) toast('❌ Bot từ chối: ' + (j.error || res.status), 'error');
      return false;
    }
    return true;
  } catch (e) {
    if (!silent) toast('❌ Không gọi được bot: ' + e.message, 'error');
    return false;
  }
}

let _botUnread = 0;

function _chatVisible() {
  const p = $('botPanel');
  return p && !p.hidden;
}
function _setFabBadge() {
  const b = $('chatFabBadge');
  if (!b) return;
  if (_botUnread > 0) { b.textContent = _botUnread > 9 ? '9+' : String(_botUnread); b.classList.add('show'); }
  else { b.textContent = ''; b.classList.remove('show'); }
}

function _appendTyping() {
  const box = $('botLog');
  if (!box || $('chatTyping')) return;
  const t = document.createElement('div');
  t.id = 'chatTyping';
  t.className = 'chat-typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  box.appendChild(t);
  box.scrollTop = box.scrollHeight;
}
function _removeTyping() {
  const t = $('chatTyping');
  if (t) t.remove();
}

function _nowTime() {
  const d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// Tạo 1 dòng tin: bot có avatar + giờ, me căn phải + giờ
function _appendRow(kind, contentEl) {
  const box = $('botLog');
  if (!box) return;
  const row = document.createElement('div');
  row.className = 'chat-msg ' + (kind === 'me' ? 'me' : 'bot');

  if (kind !== 'me') {
    const av = document.createElement('div');
    av.className = 'chat-ava-sm';
    av.textContent = '🤖';
    row.appendChild(av);
  }
  const col = document.createElement('div');
  col.className = 'chat-col';
  col.appendChild(contentEl);
  const t = document.createElement('div');
  t.className = 'chat-time';
  t.textContent = _nowTime();
  col.appendChild(t);
  row.appendChild(col);

  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
  if (!_chatVisible()) { _botUnread++; _setFabBadge(); }
}

// kind: 'bot' (mặc định) | 'me' | 'sys'
function botLog(text, fileUrl, kind) {
  const box = $('botLog');
  if (!box) return;
  _removeTyping();

  if (text) {
    if (kind === 'sys') {
      const s = document.createElement('div');
      s.className = 'chat-sys';
      s.textContent = text;
      box.appendChild(s);
      box.scrollTop = box.scrollHeight;
    } else {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.textContent = text;
      _appendRow(kind, bubble);
    }
  }

  if (fileUrl) {
    const a = document.createElement('a');
    a.className = 'chat-file';
    a.href = API_BASE + fileUrl + '?initData=' + encodeURIComponent(INIT_DATA);
    a.innerHTML = '<span class="chat-file-ic">📦</span><span class="chat-file-tx"><b>MOD_LQ.zip</b><small>Chạm để tải về máy</small></span><span class="chat-file-dl">⬇️</span>';
    a.target = '_blank';
    a.rel = 'noopener';
    _appendRow('bot', a);
  }
}

// Nút liên kết (vd: 🔑 Lấy Key Kích Hoạt) — như bên Telegram
function botLink(url, label) {
  if (!url) return;
  _removeTyping();
  const a = document.createElement('a');
  a.className = 'chat-link';
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = label || '🔗 Mở liên kết';
  _appendRow('bot', a);
}

// Mở khung chat nổi (đè lên tab hiện tại)
function showBotChat(clear) {
  const p = $('botPanel');
  if (!p) return;
  if (clear) { const b = $('botLog'); if (b) b.innerHTML = ''; }
  const fab = $('chatFab'); if (fab) fab.hidden = true;
  _botUnread = 0; _setFabBadge();
  p.classList.remove('closing');
  p.hidden = false;
  refreshChatStatus();
  // lời chào khi mở khung trống
  const box = $('botLog');
  if (box && !box.children.length) {
    botLog('Xin chào! Mình là trợ lý BANNEI 🤖\nMọi tiến trình & file Mod sẽ hiện ngay tại đây.', null, 'bot');
  }
}

function minimizeChat() {
  const p = $('botPanel'); if (!p) return;
  p.hidden = true;
  const fab = $('chatFab'); if (fab) fab.hidden = false;
}

function closeChat() {
  stopPolling();
  const p = $('botPanel');
  if (p) { p.classList.add('closing'); setTimeout(() => { p.hidden = true; p.classList.remove('closing'); }, 260); }
  const fab = $('chatFab'); if (fab) fab.hidden = true;
  _botUnread = 0; _setFabBadge();
}

// Kéo di chuyển khung chat bằng header
function _initChatDrag() {
  const win = $('botPanel');
  const head = $('chatwHead');
  if (!win || !head) return;
  let sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.chatw-btn')) return;   // bỏ qua nút
    drag = true;
    const r = win.getBoundingClientRect();
    ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
    win.style.transition = 'none';
    try { head.setPointerCapture(e.pointerId); } catch {}
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    let nx = ox + (e.clientX - sx);
    let ny = oy + (e.clientY - sy);
    const mw = window.innerWidth - win.offsetWidth - 6;
    const mh = window.innerHeight - win.offsetHeight - 6;
    nx = Math.max(6, Math.min(nx, mw));
    ny = Math.max(6, Math.min(ny, mh));
    win.style.left = nx + 'px';
    win.style.top = ny + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  });
  const end = (e) => { drag = false; win.style.transition = ''; try { head.releasePointerCapture(e.pointerId); } catch {} };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

// Bỏ qua tin cũ còn trong hàng đợi bot (tránh hiện lại lịch sử/trùng lặp)
async function drainBaseline() {
  if (!API_READY) return;
  try {
    const r = await fetch(API_BASE + '/api/poll?after=0&initData=' + encodeURIComponent(INIT_DATA));
    const j = await r.json();
    if (j.ok && Array.isArray(j.msgs)) for (const m of j.msgs) if (m.seq > _pollSeq) _pollSeq = m.seq;
  } catch {}
}

async function refreshChatStatus() {
  const el = $('chatStatus');
  if (!el) return;
  if (!INIT_DATA) { el.innerHTML = '<span class="chat-dot off"></span> Mở trong Telegram'; return; }
  if (!API_BASE) { el.innerHTML = '<span class="chat-dot off"></span> Chưa kết nối · gõ /start'; return; }
  try {
    const r = await fetch(API_BASE + '/api/health', { cache: 'no-store' });
    const j = await r.json();
    el.innerHTML = (j && j.ok)
      ? '<span class="chat-dot"></span> Trực tuyến'
      : '<span class="chat-dot off"></span> Mất kết nối';
  } catch {
    el.innerHTML = '<span class="chat-dot off"></span> Mất kết nối · /start lại';
  }
}

function startPolling() {
  if (!API_READY) return;
  stopPolling();
  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch(API_BASE + '/api/poll?after=' + _pollSeq +
        '&initData=' + encodeURIComponent(INIT_DATA));
      const j = await res.json().catch(() => ({}));
      if (j.ok && Array.isArray(j.msgs)) {
        for (const m of j.msgs) {
          if (m.seq > _pollSeq) _pollSeq = m.seq;
          if (m.text || m.file) botLog(m.text, m.file);
          if (m.link) botLink(m.link.url, m.link.label);
        }
      }
    } catch { /* im lặng, thử lại nhịp sau */ }
  }, 1500);
}

function stopPolling() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

/* ═══════════════════════════════════════════════════════════════
   TELEGRAM LOGIN + VIP / ADMIN DETECTION
   ═══════════════════════════════════════════════════════════════ */
// Lấy user: ưu tiên initDataUnsafe, fallback parse từ initData thô.
// Nhờ vậy nút menu / nút bàn phím đều nhận diện được, không kẹt "login gate".
function getTgUser() {
  if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user;
  try {
    const raw = tg?.initData || '';
    if (raw) {
      const us = new URLSearchParams(raw).get('user');
      if (us) return JSON.parse(us);
    }
  } catch {}
  return null;
}

function loginTelegram() {
  const u = getTgUser();
  if (!u) {
    $('userName').textContent = 'Mở qua Telegram';
    $('userId').textContent = 'Chưa đăng nhập';
    $('avatar').textContent = '?';
    $('vipText').textContent = 'N/A';
    $('vipPill').classList.add('none');
    showWebLoginGate();
    return;
  }

  hideWebLoginGate();
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'User';
  $('userName').textContent = name;
  $('userId').textContent = `ID: ${u.id}`;
  $('myidVal').textContent = u.id;

  if (u.photo_url) {
    $('avatar').innerHTML = `<img src="${u.photo_url}" alt="">`;
  } else {
    $('avatar').textContent = (u.first_name || '?')[0].toUpperCase();
  }

  // parse start_param: vip:<days> | admin:1 | vip:<days>+admin:1
  // Source priority: Telegram start_param → URL query (?s=...) → empty
  const urlParams = new URLSearchParams(location.search);
  const sp =
    tg.initDataUnsafe?.start_param ||
    urlParams.get('s') ||
    urlParams.get('start_param') ||
    urlParams.get('tgWebAppStartParam') ||
    '';
  const vipMatch = /vip:(\d+)/.exec(sp);
  if (vipMatch) {
    const days = parseInt(vipMatch[1], 10);
    state.vipDays = days;
    if (days > 0) {
      state.isVip = true;
      $('vipText').textContent = `VIP · ${days} ngày`;
      $('vipPill').className = 'vip-pill';
    } else {
      $('vipText').textContent = 'VIP hết hạn';
      $('vipPill').className = 'vip-pill expired';
    }
  } else {
    $('vipText').textContent = 'Free';
    $('vipPill').className = 'vip-pill none';
  }

  // admin detection: by ID OR start_param flag
  const isAdminParam = /admin:1/.test(sp);
  if (u.id === ADMIN_ID || isAdminParam) {
    state.isAdmin = true;
    qsa('.admin-only').forEach((el) => (el.hidden = false));
    $('tabsBar').classList.add('with-admin');
    $('vipText').textContent = '👑 ADMIN';
    $('vipPill').className = 'vip-pill admin';
  }
}

/* ── Web Login Gate (non-Telegram access) ── */
function showWebLoginGate() {
  let gate = $('webLoginGate');
  if (!gate) {
    gate = document.createElement('div');
    gate.id = 'webLoginGate';
    gate.className = 'web-login-gate';
    gate.innerHTML = `
      <div class="wlg-card">
        <div class="wlg-logo">🛡️</div>
        <h2>BANNEI MOD LQ</h2>
        <p>Mini App này chạy <b>bên trong Telegram</b>.</p>
        <div class="wlg-buttons">
          <a class="wlg-btn primary" href="https://t.me/">🤖 Mở Bot Telegram</a>
        </div>
        <p class="wlg-hint">Trong bot: gõ <b>/start</b> → bấm <b>☰ MOD LQ</b> (hoặc nút 🚀 Mở Mini App).</p>
      </div>
    `;
    document.body.appendChild(gate);
  }
  gate.style.display = 'flex';
}

function hideWebLoginGate() {
  const gate = $('webLoginGate');
  if (gate) gate.style.display = 'none';
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG LOADER
   ═══════════════════════════════════════════════════════════════ */
async function loadCatalog() {
  showLoader('Đang tải catalog…');
  try {
    const res = await fetch('catalog.json?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.catalog = await res.json();
    const folders = Object.keys(state.catalog);
    if (!folders.length) throw new Error('catalog rỗng');

    state.totalHeroes = folders.length;
    state.totalSkins = folders.reduce((n, f) => n + (state.catalog[f]?.length || 0), 0);
    $('stHeroes').textContent = state.totalHeroes;
    $('stSkins').textContent = state.totalSkins;

    hideLoader();
    renderAlphabet();
  } catch (e) {
    $('loaderText').innerHTML =
      '❌ Lỗi tải catalog<br><small style="opacity:.6">' + e.message + '</small>';
    toast('Không tải được catalog: ' + e.message, 'error');
  }
}

function showLoader(text) {
  $('loaderText').textContent = text;
  $('loader').hidden = false;
}
function hideLoader() { $('loader').hidden = true; }

/* ═══════════════════════════════════════════════════════════════
   HERO ICON HELPERS
   ═══════════════════════════════════════════════════════════════ */

// Static hero prefix map (fallback if hero_icons.json fails to load)
const HERO_PREFIX = {"Airi":"130","Aleister":"156","Alice":"118","Allain":"537","Amily":"193","Annette":"519","Aoi":"536","Arduin":"126","Arthur":"166","Arum":"187","Astrid":"502","Ata":"511","Aya":"543","Azzen'Ka":"127","Baldum":"505","Bijan":"548","Billow":"599","Biron":"597","Bolt Baron":"598","Bonnie":"541","Bright":"540","Butterfly":"116","Capheny":"524","Celica":"192","Charlotte":"206","Chaugnar":"113","Cresht":"171","D'Arcy":"523","Dextra":"534","Dirak":"530","EX":"159","Eland'orr":"199","Elsu":"196","Enzo":"195","Erin":"567","Errol":"522","Fennik":"173","Florentino":"521","Gildur":"108","Goverra":"596","Grakk":"175","Hayate":"132","Heino":"563","Helen":"184","Iggy":"538","Ignis":"124","Ilumia":"136","Ishar":"526","Jinna":"115","Kahlii":"110","Kaine":"153","Keera":"531","Kil'Groth":"139","Kriknak":"162","Krixi":"106","Krizzix":"189","Lauriel":"141","Laville":"533","Liliana":"510","Lindis":"177","Lorion":"539","Lumburr":"168","Lữ Bố":"128","Maloch":"123","Marja":"121","Max":"180","Mganga":"119","Mina":"120","Ming":"568","Moren":"170","Murad":"131","Nakroth":"150","Natalya":"142","Ngộ Không":"167","Omega":"114","Omen":"506","Ormarr":"117","Paine":"137","Preyta":"148","Qi":"528","Quillen":"518","Raz":"157","Richter":"515","Rouie":"191","Rourke":"512","Roxie":"514","Ryoma":"163","Sephera":"527","Sinestrea":"535","Skud":"134","Slimz":"169","Stuart":"174","Superman":"140","Taara":"144","Tachi":"542","TeeMee":"186","Teeri":"546","Tel'Annas":"501","Thane":"135","The Flash":"507","Thorne":"532","Toro":"105","Triệu Vân":"129","Tulen":"190","Valhein":"133","Veera":"109","Veres":"520","Violet":"111","Volkath":"529","Wisp":"508","Wonder Woman":"504","Xeniel":"149","Y'bneth":"509","Yan":"544","Yena":"154","Yorn":"112","Yue":"545","Zata":"513","Zephys":"107","Zill":"146","Zip":"525","Zuka":"503","Điêu Thuyền":"152"};

async function loadHeroIcons() {
  // Try fetching extended data first, fall back to static HERO_PREFIX
  try {
    const res = await fetch('hero_icons.json?t=' + Date.now());
    if (res.ok) { state.heroIcons = await res.json(); return; }
  } catch {}
  // Build minimal structure from static data
  for (const [name, prefix] of Object.entries(HERO_PREFIX)) {
    state.heroIcons[name] = { prefix: prefix };
  }
}
async function loadSkinCodes() {
  try {
    const res = await fetch('skin_codes.json?t=' + Date.now());
    if (res.ok) state.skinCodes = await res.json();
  } catch {}
}

function getHeroIconUrl(heroName, skinName) {
  const info = state.heroIcons[heroName];
  if (!info || !info.prefix) return '';
  const CDN = '30'; // fixed game-version CDN prefix
  if (skinName) {
    const skinCode = state.skinCodes[heroName + '|' + skinName];
    if (skinCode && skinCode.length >= 5) {
      // Skin code format: XXXYY — hero prefix (3) + variant (2)
      // CDN URL uses variant as integer (no leading zero): 08→8, 15→15
      const variant = parseInt(skinCode.slice(-2), 10);
      return 'https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/' + CDN + info.prefix + variant + 'head.jpg';
    }
    // fallback: hero portrait
    return 'https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/' + CDN + info.prefix + 'head.jpg';
  }
  // hero portrait (no skin)
  return 'https://dl.ops.kgvn.garenanow.com/hok/VN/HeroHeadPath/' + CDN + info.prefix + 'head.jpg';
}

function heroIconImg(heroName, skinName, cls) {
  const url = getHeroIconUrl(heroName, skinName);
  if (!url) return '';
  return `<img class="${cls || 'hi-avatar'}" src="${url}" alt="" loading="lazy" onerror="this.outerHTML=''">`;
}

/* ═══════════════════════════════════════════════════════════════
   TABS
   ═══════════════════════════════════════════════════════════════ */
qsa('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    qsa('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    qsa('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${tab}`));
    haptic('light');
    if (tab === 'cart') renderCart();
    if (tab === 'more') refreshSettingsLabels();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* ═══════════════════════════════════════════════════════════════
   ALPHA / HERO / SKIN PAGES
   ═══════════════════════════════════════════════════════════════ */
function renderAlphabet() {
  const folders = Object.keys(state.catalog);
  const letters = [...new Set(folders.map((f) => f[0].toUpperCase()))].sort();
  const grid = $('alphaGrid');
  grid.innerHTML = '';
  letters.forEach((L) => {
    const count = folders.filter((f) => f[0].toUpperCase() === L).length;
    const cell = document.createElement('button');
    cell.className = 'alpha-cell';
    cell.innerHTML = `${L}<span class="ac-count">${count}</span>`;
    cell.addEventListener('click', () => openLetter(L));
    grid.appendChild(cell);
  });
}

function openLetter(L) {
  state.currentLetter = L;
  haptic('medium');
  const folders = Object.keys(state.catalog)
    .filter((f) => f[0].toUpperCase() === L)
    .sort();
  $('heroListTitle').textContent = `Chữ "${L}"`;
  $('heroListSub').textContent = `${folders.length} tướng`;
  const grid = $('heroGrid');
  grid.innerHTML = '';
  folders.forEach((f, i) => {
    const skins = state.catalog[f] || [];
    const cell = document.createElement('button');
    cell.className = 'hero-cell';
    if (state.cart[f]) cell.classList.add('has-skin');
    const iconHtml = heroIconImg(f, null, 'hc-icon') || '<span class="hc-icon-fb">🎭</span>';
    cell.innerHTML = `${iconHtml}${escapeHtml(f)}<span class="hc-skins">${skins.length} skin</span>`;
    cell.style.animationDelay = `${Math.min(i, 30) * 0.025}s`;
    cell.addEventListener('click', () => openHero(f));
    grid.appendChild(cell);
  });
  switchHeroesPane('list');
}

function openHero(folder) {
  state.currentHero = folder;
  haptic('medium');
  const skins = state.catalog[folder] || [];
  $('skinListTitle').textContent = folder;
  $('skinListSub').textContent = skins.length ? `${skins.length} skin có sẵn` : 'Chưa có skin';
  const grid = $('skinGrid');
  grid.innerHTML = '';
  grid.className = 'skin-grid icon-mode';
  if (!skins.length) {
    grid.innerHTML = `<div class="empty"><div class="empty-icon">🎭</div><p>Tướng này chưa có skin trong catalog.</p></div>`;
  } else {
    skins.forEach((s, i) => {
      const cell = document.createElement('button');
      cell.className = 'skin-icon-cell';
      if (state.cart[folder] === s) cell.classList.add('selected');
      const skIcon = heroIconImg(folder, s, 'sk-portrait');
      const shortName = s.replace(folder + ' ', '');
      cell.innerHTML = `
        ${skIcon || `<span class="sk-portrait-fb">🎭</span>`}
        <span class="sk-label">${escapeHtml(shortName)}</span>
        <span class="sk-check">✓</span>
      `;
      cell.style.animationDelay = `${Math.min(i, 20) * 0.03}s`;
      cell.addEventListener('click', () => pickSkin(folder, s, cell));
      grid.appendChild(cell);
    });
  }
  switchHeroesPane('skin');
}

function switchHeroesPane(which) {
  $('alphaPane').hidden = which !== 'alpha';
  $('heroListPane').hidden = which !== 'list';
  $('skinListPane').hidden = which !== 'skin';
}

$('heroBack').addEventListener('click', () => { switchHeroesPane('alpha'); haptic('light'); });
$('skinBack').addEventListener('click', () => { switchHeroesPane('list'); haptic('light'); });

function pickSkin(folder, skin, cellEl) {
  state.cart[folder] = skin;
  saveCart();
  qsa('.skin-cell, .skin-icon-cell', $('skinGrid')).forEach((c) => c.classList.remove('selected'));
  cellEl.classList.add('selected');
  haptic('success');
  toast(`✓ ${folder} → ${shorten(skin, 26)}`, 'success');
  updateBadge();
}

/* ═══════════════════════════════════════════════════════════════
   HERO/SKIN SEARCH (heroes page)
   ═══════════════════════════════════════════════════════════════ */
let searchDebounce = 0;
$('heroSearch').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  $('heroSearchClr').hidden = !q;
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => doHeroSearch(q), 180);
});
$('heroSearchClr').addEventListener('click', () => {
  $('heroSearch').value = '';
  $('heroSearchClr').hidden = true;
  doHeroSearch('');
});

function doHeroSearch(qRaw) {
  const wrap = $('heroSearchResults');
  if (qRaw.length < 2) {
    wrap.hidden = true;
    wrap.innerHTML = '';
    $('alphaGrid').hidden = false;
    return;
  }
  $('alphaGrid').hidden = true;
  const q = qRaw.toLowerCase();
  const hits = [];
  for (const [folder, skins] of Object.entries(state.catalog)) {
    const folderHit = folder.toLowerCase().includes(q);
    if (folderHit) {
      hits.push({ type: 'hero', folder });
    }
    for (const s of skins) {
      if (s.toLowerCase().includes(q)) {
        hits.push({ type: 'skin', folder, skin: s });
      }
      if (hits.length > 60) break;
    }
    if (hits.length > 60) break;
  }
  wrap.innerHTML = '';
  if (!hits.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><p>Không tìm thấy "<b>${escapeHtml(qRaw)}</b>"</p></div>`;
  } else {
    hits.slice(0, 50).forEach((h, i) => {
      const row = document.createElement('div');
      row.className = 'search-row';
      row.style.animationDelay = `${Math.min(i, 20) * 0.02}s`;
      if (h.type === 'hero') {
        const srIcon = heroIconImg(h.folder, null, 'sr-icon');
        row.innerHTML = `${srIcon}<div><b>${highlight(h.folder, qRaw)}</b><div class="meta">🎭 Mở danh sách skin</div></div><span class="chev">›</span>`;
        row.addEventListener('click', () => {
          $('heroSearch').value = '';
          $('heroSearchClr').hidden = true;
          doHeroSearch('');
          openHero(h.folder);
        });
      } else {
        const srIcon2 = heroIconImg(h.folder, h.skin, 'sr-icon');
        row.innerHTML = `${srIcon2}<div><b>${escapeHtml(h.folder)}</b><div class="meta">${highlight(h.skin, qRaw)}</div></div><span class="chev">+</span>`;
        row.addEventListener('click', () => {
          state.cart[h.folder] = h.skin;
          saveCart();
          updateBadge();
          haptic('success');
          toast(`✓ ${h.folder} → ${shorten(h.skin, 22)}`, 'success');
        });
      }
      wrap.appendChild(row);
    });
  }
  wrap.hidden = false;
}

/* ═══════════════════════════════════════════════════════════════
   EXTRAS
   ═══════════════════════════════════════════════════════════════ */
qsa('.extra-card').forEach((card) => {
  card.addEventListener('click', () => {
    const e = card.dataset.extra;
    haptic('medium');
    if (e === 'camxa') return openZoomPicker();
    if (e === 'hdchieu') return toggleExtra('HD Chiêu', 'HD', card);
    if (e === 'server')  return openServerPicker();
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

function syncExtraCardsState() {
  qsa('.extra-card').forEach((c) => {
    const e = c.dataset.extra;
    const key = ({
      camxa: 'Cam Xa', hdchieu: 'HD Chiêu', server: 'Server',
    })[e];
    c.classList.toggle('selected', !!state.cart[key]);
  });
}

function openZoomPicker() {
  const grid = $('zoomGrid');
  grid.innerHTML = '';
  let i = 0;
  for (let z = 105; z < 300; z += 5) {
    const b = document.createElement('button');
    b.className = 'zoom-cell';
    b.textContent = `${z}%`;
    if (state.cart['Cam Xa'] === `${z}%`) b.classList.add('selected');
    b.style.animationDelay = `${i++ * 0.012}s`;
    b.addEventListener('click', () => {
      state.cart['Cam Xa'] = `${z}%`;
      saveCart();
      haptic('success');
      toast(`✓ Cam Xa ${z}%`, 'success');
      syncExtraCardsState();
      switchExtrasPane('list');
      updateBadge();
    });
    grid.appendChild(b);
  }
  switchExtrasPane('zoom');
}

function openServerPicker() {
  const grid = $('serverGrid');
  grid.innerHTML = '';
  SERVERS.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'zoom-cell';
    b.textContent = s.label;
    if ((state.cart['Server'] || 'Resources') === s.dir) b.classList.add('selected');
    b.style.animationDelay = `${i * 0.03}s`;
    b.addEventListener('click', () => {
      if (s.dir === 'Resources') delete state.cart['Server'];  // VN = mặc định, không cần lưu
      else state.cart['Server'] = s.dir;
      saveCart();
      haptic('success');
      toast(`✓ Server: ${s.label}`, 'success');
      syncExtraCardsState();
      switchExtrasPane('list');
      updateBadge();
    });
    grid.appendChild(b);
  });
  switchExtrasPane('server');
}

function switchExtrasPane(which) {
  $('extrasPane').hidden = which !== 'list';
  $('zoomPicker').hidden = which !== 'zoom';
  $('serverPicker').hidden = which !== 'server';
}

$('zoomBack').addEventListener('click', () => { switchExtrasPane('list'); haptic('light'); });
$('serverBack').addEventListener('click', () => { switchExtrasPane('list'); haptic('light'); });

/* ═══════════════════════════════════════════════════════════════
   CART
   ═══════════════════════════════════════════════════════════════ */
function renderCart() {
  const list = $('cartList');
  const empty = $('cartEmpty');
  const summaryWrap = $('cartSummaryWrap');
  const entries = Object.entries(state.cart);
  list.innerHTML = '';

  if (!entries.length) {
    empty.hidden = false;
    summaryWrap.hidden = true;
    return;
  }
  empty.hidden = true;
  summaryWrap.hidden = false;

  // summary
  const heroCount = entries.filter(([k]) => !EXTRA_KEYS.has(k)).length;
  const extraCount = entries.length - heroCount;
  $('csVal').textContent = entries.length;
  $('csMeta').textContent = `${heroCount} Skin · ${extraCount} Bổ trợ`;
  $('csVipBadge').hidden = !state.isVip;

  entries.forEach(([k, v], i) => {
    const isExtra = EXTRA_KEYS.has(k);
    const div = document.createElement('div');
    div.className = 'cart-item' + (isExtra ? ' extra' : '');
    div.style.animationDelay = `${Math.min(i, 15) * 0.04}s`;
    const cartIconHtml = isExtra
      ? '<div class="cart-icon">🛠️</div>'
      : (heroIconImg(k, v, 'cart-avatar') || '<div class="cart-icon">🎭</div>');
    div.innerHTML = `
      ${cartIconHtml}
      <div>
        <div class="cart-name">${escapeHtml(k)}</div>
        <div class="cart-source">${escapeHtml(v)}</div>
      </div>
      <button class="cart-del" data-key="${escapeAttr(k)}" aria-label="Remove">✕</button>
    `;
    list.appendChild(div);
  });

  qsa('.cart-del', list).forEach((b) => {
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
        syncExtraCardsState();
      }, 300);
    });
  });
}

$('clearBtn').addEventListener('click', () => {
  if (!Object.keys(state.cart).length) return;
  if (!confirm('Xoá toàn bộ giỏ?')) return;
  state.cart = {};
  clearCartStorage();
  updateBadge();
  renderCart();
  syncExtraCardsState();
  haptic('warning');
  toast('🧹 Đã xoá sạch giỏ', 'success');
});

$('runBtn').addEventListener('click', () => {
  const entries = Object.entries(state.cart);
  if (!entries.length) { toast('Giỏ trống!', 'error'); haptic('error'); return; }

  // validation: Cam Xa only — must have ≥1 skin
  const onlyExtras = entries.every(([k]) => EXTRA_KEYS.has(k));
  const hasSkin = entries.some(([k]) => !EXTRA_KEYS.has(k));
  if (state.cart['Cam Xa'] && !hasSkin && onlyExtras) {
    if (!confirm('⚠️ Cam Xa cần ít nhất 1 Skin để áp dụng. Vẫn gửi?')) return;
  }

  haptic('success');
  if (state.settings.confetti) fireConfetti();

  if (API_READY) {
    // Luồng chính: gửi qua API, phản hồi hiện trong khung chat nổi
    showBotChat(false);
    const n = entries.length;
    botLog(`🚀 Chạy Mod cho ${n} mục:\n${entries.map(([k]) => '• ' + k).join('\n')}`, null, 'me');
    botLog('Đã gửi tới hệ thống · đang xử lý', null, 'sys');
    startPolling();
    _appendTyping();
    apiSend({ type: 'chaymod', items: state.cart });
  } else if (getTgUser()) {
    // Dự phòng: mở qua nút bàn phím → sendData
    const payload = { type: 'chaymod', items: state.cart, ts: Date.now(), vip: state.isVip, admin: state.isAdmin };
    try {
      tg.sendData(JSON.stringify(payload));
    } catch (e) {
      toast('Lỗi gửi: ' + e.message, 'error');
      return;
    }
    showRunOverlay(entries.length);
  } else {
    // Ngoài Telegram: deep link (chỉ hợp giỏ nhỏ)
    const cartJson = JSON.stringify(state.cart);
    const encoded = btoa(unescape(encodeURIComponent(cartJson))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    const deepLink = 'https://t.me/MODSKINin1_bot?start=mod_' + encoded;
    toast('📤 Đang chuyển sang Telegram...', 'success');
    setTimeout(() => { window.open(deepLink, '_blank'); }, 500);
    showRunOverlayWeb(entries.length);
  }
});

function showRunOverlayWeb(itemCount) {
  $('runOverlay').hidden = false;
  $('runTitle').textContent = '🎉 Đã gửi yêu cầu!';
  $('runMsg').innerHTML = `Bot đang xử lý <b>${itemCount}</b> mục Mod.<br>📬 <b>Kiểm tra Telegram để nhận file ZIP!</b>`;
  $('runStatus').textContent = '✅ Đã chuyển sang Telegram';
  $('runStatus').classList.add('ok');
  $('runBar').style.width = '100%';
  $('runClose').textContent = 'Đi Telegram nhận file';
  $('runStay').textContent = 'Ở lại tiếp tục Mod';
}

function showRunOverlay(itemCount) {
  $('runOverlay').hidden = false;
  $('runTitle').textContent = '🎉 Đã gửi yêu cầu!';
  $('runMsg').innerHTML = API_READY
    ? `Bot đang xử lý <b>${itemCount}</b> mục Mod.<br>📥 Phản hồi & file sẽ hiện <b>ngay trong app</b>.`
    : `Bot đang xử lý <b>${itemCount}</b> mục Mod.<br>Quay lại chat để nhận file ZIP nhé!`;

  const steps = [
    { p: 15, t: '🔄 Đã nhận dữ liệu, đang khởi tạo...' },
    { p: 38, t: '🛠️ Đang ghép mã Mod...' },
    { p: 65, t: '📦 Đang đóng gói file ZIP...' },
    { p: 92, t: '📤 Sắp gửi file vào chat của bạn...' },
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
      status.textContent = '✅ Hoàn tất. Mở chat để xem file Mod!';
      status.classList.add('ok');
      return;
    }
    const s = steps[i++];
    bar.style.width = s.p + '%';
    status.textContent = s.t;
    setTimeout(tick, 1100 + Math.random() * 600);
  };
  setTimeout(tick, 450);
}

$('runClose').addEventListener('click', () => {
  haptic('light');
  $('runOverlay').hidden = true;
  state.cart = {};
  saveCart();
  updateBadge();
  renderCart();
  syncExtraCardsState();
  // Chế độ API: ở lại app để xem phản hồi bot, KHÔNG đóng Mini App
  if (!API_READY) setTimeout(() => tg?.close?.(), 180);
});

$('runStay').addEventListener('click', () => {
  haptic('light');
  $('runOverlay').hidden = true;
  toast('🛒 Tiếp tục chọn Mod!', 'success');
});

(() => {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
  on('chatMin',   () => { haptic('light'); minimizeChat(); });
  on('chatClose', () => { haptic('light'); closeChat(); });
  on('chatFab',   () => { haptic('light'); showBotChat(false); });
  _initChatDrag();
})();

/* ═══════════════════════════════════════════════════════════════
   ADMIN ACTIONS
   ═══════════════════════════════════════════════════════════════ */
function bindAdminButtons() {
  qsa('.admin-card button[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => onAdminClick(btn));
  });
}

function onAdminClick(btn) {
  const act = btn.dataset.act;
  const confirmMsg = btn.dataset.confirm;
  if (confirmMsg && !confirm(confirmMsg)) return;
  if (!getTgUser()) { showWebLoginGate(); toast('Cần mở qua Telegram!', 'error'); return; }
  if (!state.isAdmin) { toast('Bạn không phải Admin!', 'error'); haptic('error'); return; }

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
    case 'statuskey':
    case 'listvip':
    case 'capnhat':
      break;
  }

  if (!valid) { haptic('error'); return; }

  haptic('success');
  if (API_READY) {
    showBotChat(false);
    botLog('⚙️ Lệnh quản trị: ' + act, null, 'me');
    botLog('Đang thực thi', null, 'sys');
    startPolling();
    _appendTyping();
    apiSend({ type: 'admin', action: act, args });
  } else {
    const payload = { type: 'admin', action: act, args, ts: Date.now() };
    try {
      tg.sendData(JSON.stringify(payload));
    } catch (e) {
      toast('Lỗi gửi: ' + e.message, 'error');
      return;
    }
    toast('📤 Đã gửi → mở chat bot để xem kết quả', 'success');
  }
  // clear inputs after send
  if (['vipmember','congvipall','resetvip','ban','unban','guiall'].includes(act)) {
    ['adm_vip_uid','adm_vip_days','adm_all_days','adm_reset_uid','adm_ban_uid','adm_unban_uid','adm_broadcast']
      .forEach((id) => { const el = $(id); if (el) el.value = ''; });
  }
}

/* ═══════════════════════════════════════════════════════════════
   MORE / SETTINGS
   ═══════════════════════════════════════════════════════════════ */
function refreshSettingsLabels() {
  $('hapticVal').textContent = state.settings.haptic ? 'BẬT' : 'TẮT';
  $('confettiVal').textContent = state.settings.confetti ? 'BẬT' : 'TẮT';
}

qsa('.set-card').forEach((card) => {
  card.addEventListener('click', () => {
    const a = card.dataset.action;
    haptic('light');
    if (a === 'checkvip') {
      if (API_READY) {
        // Hỏi bot để có kết quả chính xác, hiện trong khung chat
        showBotChat(false);
        botLog('💎 Kiểm tra hạn VIP', null, 'me');
        startPolling();
        _appendTyping();
        apiSend({ type: 'checkvip' }, true).then((ok) => {
          if (ok) return;
          _removeTyping();
          if (state.isVip) botLog(`💎 Bạn còn ${state.vipDays} ngày VIP.`, null, 'bot');
          else if (state.isAdmin) botLog('👑 Bạn là ADMIN — quyền tối cao.', null, 'bot');
          else botLog('❌ Bạn chưa có VIP. Liên hệ Admin để mua nhé.', null, 'bot');
        });
      } else if (state.isVip) {
        toast(`💎 Bạn còn ${state.vipDays} ngày VIP`, 'success');
      } else if (state.isAdmin) {
        toast('👑 Bạn là ADMIN — quyền tối cao', 'success');
      } else {
        toast('❌ Bạn chưa có VIP. Liên hệ Admin để mua.', 'warn');
      }
    } else if (a === 'myid') {
      const id = getTgUser()?.id;
      if (!id) return toast('Không lấy được ID — hãy mở trong Telegram', 'error');
      copyText(String(id)).then((ok) =>
        toast(ok ? `📋 Đã copy ID: ${id}` : `🆔 ID của bạn: ${id}`, 'success'));
    } else if (a === 'haptic') {
      state.settings.haptic = !state.settings.haptic;
      saveSettings();
      refreshSettingsLabels();
      toast(`📳 Rung ${state.settings.haptic ? 'BẬT' : 'TẮT'}`, 'success');
    } else if (a === 'confetti') {
      state.settings.confetti = !state.settings.confetti;
      saveSettings();
      refreshSettingsLabels();
      toast(`🎉 Pháo bông ${state.settings.confetti ? 'BẬT' : 'TẮT'}`, 'success');
    } else if (a === 'contact') {
      try { tg?.openTelegramLink?.(ADMIN_CONTACT); } catch {}
      try { tg?.openLink?.(ADMIN_CONTACT); } catch {}
    } else if (a === 'donate') {
      copyText('109874557013').then((ok) =>
        toast(ok ? '📋 Đã copy STK: 109874557013 — VIETINBANK' : '🏦 STK: 109874557013 — VIETINBANK', 'success'));
    } else if (a === 'reset') {
      if (!confirm('Xoá cache + giỏ + cài đặt?')) return;
      try { localStorage.clear(); } catch {}
      clearCartStorage();                       // xoá luôn giỏ trên Telegram CloudStorage
      if (API_BASE) { try { localStorage.setItem('bannei_api', API_BASE); } catch {} }  // giữ kết nối bot
      state.cart = {};
      state.settings = defaultSettings();
      saveSettings();
      updateBadge();
      renderCart();
      syncExtraCardsState();
      refreshSettingsLabels();
      toast('♻️ Đã reset sạch (giỏ + cache)', 'success');
    } else if (a === 'about') {
      toast('BANNEI MOD LQ · Liquid Glass 6.0 · 2026', 'success');
    }
  });
});

function defaultSettings() { return { haptic: true, confetti: true }; }
function loadSettings() {
  try {
    const v = localStorage.getItem('bannei_settings');
    return v ? { ...defaultSettings(), ...JSON.parse(v) } : defaultSettings();
  } catch { return defaultSettings(); }
}
function saveSettings() {
  try { localStorage.setItem('bannei_settings', JSON.stringify(state.settings)); } catch {}
}
async function copyText(t) {
  // 1) Clipboard API (chỉ chạy trong secure context)
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {}
  // 2) Fallback execCommand (Telegram WebView cũ)
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════════
   UTIL
   ═══════════════════════════════════════════════════════════════ */
function saveCart() {
  const raw = JSON.stringify(state.cart);
  try { localStorage.setItem('bannei_cart', raw); } catch {}
  // Sync to Telegram CloudStorage (cross-device, cross-session)
  if (tg?.CloudStorage) {
    try { tg.CloudStorage.setItem('bannei_cart', raw); } catch {}
  }
}
// Xoá SẠCH giỏ ở cả localStorage lẫn Telegram CloudStorage (chống giỏ "sống lại")
function clearCartStorage() {
  try { localStorage.removeItem('bannei_cart'); } catch {}
  if (tg?.CloudStorage) {
    try { tg.CloudStorage.removeItem('bannei_cart', () => {}); } catch {}
  }
}
async function loadCartLocal() {
  // 1) CloudStorage (Telegram cloud, cross-device)
  if (tg?.CloudStorage) {
    try {
      const raw = await promisifyCS(tg.CloudStorage.getItem, 'bannei_cart');
      if (raw) { state.cart = JSON.parse(raw) || {}; updateBadge(); syncExtraCardsState(); return; }
    } catch {}
  }
  // 2) localStorage fallback
  try {
    const v = localStorage.getItem('bannei_cart');
    if (v) { state.cart = JSON.parse(v) || {}; updateBadge(); syncExtraCardsState(); }
  } catch {}
}
function promisifyCS(fn, key) {
  return new Promise((resolve) => {
    fn.call(tg.CloudStorage, key, (err, val) => {
      resolve(err ? null : val);
    });
  });
}
function updateBadge() {
  const n = Object.keys(state.cart).length;
  const el = $('cartBadge');
  el.textContent = n ? n : '';
  if (n) el.removeAttribute('data-zero'); else el.setAttribute('data-zero', '');
  $('stCart').textContent = n;
}
function toast(msg, type = '') {
  const t = $('toast');
  t.className = 'toast show ' + type;
  t.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.className = 'toast'; }, 2400);
}
function haptic(kind = 'light') {
  if (!state.settings.haptic) return;
  try {
    const h = tg?.HapticFeedback;
    if (!h) return;
    if (['success', 'warning', 'error'].includes(kind)) h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {}
}
function escapeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}
function escapeAttr(s){ return escapeHtml(s).replace(/'/g, '&#39;'); }
function shorten(s, n){ return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function highlight(text, q) {
  const safe = escapeHtml(text);
  if (!q) return safe;
  const re = new RegExp('(' + q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'ig');
  return safe.replace(re, '<mark style="background:rgba(108,140,255,.3);color:#fff;border-radius:3px;padding:0 2px">$1</mark>');
}

function fireConfetti() {
  const wrap = $('confetti');
  wrap.innerHTML = '';
  const colors = ['#6c8cff','#b16cff','#ffd25f','#ff6b9a','#34d399','#5ed5ff'];
  for (let i = 0; i < 72; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + '%';
    s.style.background = colors[i % colors.length];
    s.style.animationDelay = (Math.random() * 0.5) + 's';
    s.style.animationDuration = (1.4 + Math.random() * 1.3) + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    wrap.appendChild(s);
  }
  setTimeout(() => { wrap.innerHTML = ''; }, 2500);
}

/* ripple on buttons */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-primary, .btn-ghost, .btn-danger, .alpha-cell, .hero-cell, .zoom-cell');
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple-fx';
  const size = Math.max(r.width, r.height);
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - r.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - r.top - size / 2) + 'px';
  const pos = getComputedStyle(btn).position;
  if (pos === 'static') btn.style.position = 'relative';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}, true);

/* theme detection */
function applyTheme() {
  const scheme = tg?.colorScheme || 'dark';
  document.body.classList.toggle('tg-light', scheme === 'light');
}
tg?.onEvent?.('themeChanged', applyTheme);

/* ═══════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════ */
(async function boot() {
  loginTelegram();
  await loadCartLocal();
  updateBadge();
  syncExtraCardsState();
  bindAdminButtons();
  refreshSettingsLabels();
  applyTheme();
  await Promise.all([loadCatalog(), loadHeroIcons(), loadSkinCodes()]);

  checkApiConnection();
  drainBaseline();

  // sync cart from Telegram bot when inside Telegram
  if (getTgUser()) {
    try {
      tg.sendData(JSON.stringify({ type: 'synccart', ts: Date.now() }));
    } catch (e) {
      // silent — synccart will show reply in chat
    }
  }
})();

/* Telegram BackButton — auto handle */
function refreshBack() {
  if (!tg?.BackButton) return;
  const heroesActive = $('page-heroes').classList.contains('active');
  const onSubHeroes = heroesActive && (!$('alphaPane').hidden === false || !$('heroListPane').hidden || !$('skinListPane').hidden);
  const extrasActive = $('page-extras').classList.contains('active');
  const onSubExtras = extrasActive && (!$('zoomPicker').hidden || !$('serverPicker').hidden);
  const subOpen =
    (heroesActive && (!$('heroListPane').hidden || !$('skinListPane').hidden)) ||
    (extrasActive && (!$('zoomPicker').hidden));
  if (subOpen) tg.BackButton.show(); else tg.BackButton.hide();
}
tg?.BackButton?.onClick?.(() => {
  if (!$('skinListPane').hidden) { switchHeroesPane('list'); haptic('light'); refreshBack(); return; }
  if (!$('heroListPane').hidden) { switchHeroesPane('alpha'); haptic('light'); refreshBack(); return; }
  if (!$('zoomPicker').hidden || !$('serverPicker').hidden) { switchExtrasPane('list'); haptic('light'); refreshBack(); return; }
  refreshBack();
});

// re-eval back on every UI mutation hook
new MutationObserver(refreshBack).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden','class'] });
