# BANNEI MOD LQ — Telegram Mini App

UI 6.0 + animation + login Telegram tự động.

## Cấu trúc

```
webapp/
├── index.html      # giao diện
├── styles.css      # theme + animation (theo Telegram themeParams)
├── app.js          # logic + Telegram WebApp SDK
└── catalog.json    # data tướng + skin (generate từ Sources_Bot/)
```

## Build / Deploy (3 bước)

### 1) Generate catalog
```bash
py build_catalog.py
```
Mỗi lần thêm/xoá tướng hoặc skin → chạy lại.

### 2) Push lên GitHub Pages
```bash
# tạo repo public (vd: bannei-modlq-webapp)
cd webapp
git init
git add .
git commit -m "init mini app"
git remote add origin git@github.com:<USER>/bannei-modlq-webapp.git
git push -u origin main
```
Vào **Settings → Pages → Source: main / root → Save**.
URL hiện ra: `https://<user>.github.io/bannei-modlq-webapp/`

### 3) Cấu hình bot
Sửa `config/config.json`:
```json
{
  "BOT_TOKEN": "...",
  "WEBAPP_URL": "https://<user>.github.io/bannei-modlq-webapp/"
}
```
Khởi động lại bot:
```bash
py bot.py
```
Bot tự set Menu Button (nút ☰) trỏ Mini App.

## Sử dụng

**User**:
- Bấm nút **☰** trong chat → mở Mini App
- Hoặc gõ `/webapp` → bấm nút **🚀 Mở Mini App**
- Chọn tướng → skin → bổ trợ → bấm **🚀 Chạy Mod**
- Bot nhận data, chạy luồng cũ như `/chaymod`

**Telegram login**: tự động — Mini App đọc `Telegram.WebApp.initDataUnsafe.user`. Hiển thị avatar + tên + ID + VIP days còn lại (truyền qua `start_param`).

## Lưu ý

- HTTPS bắt buộc (GitHub Pages mặc định có).
- WebApp `sendData()` chỉ work khi mở qua **Reply Keyboard Button** hoặc **Menu Button** — KHÔNG work với inline button. Lệnh `/webapp` dùng Reply Keyboard nên OK.
- Theme tự đổi sáng/tối theo Telegram (CSS variables).
- Catalog static — search/list client-side, không hit bot.
- VIP days lấy lúc `/webapp` được gọi, encode vào URL query. Sau đó static.

## Animation list
- Aurora blur blobs background
- Avatar spinning conic gradient
- Tab switch page slide
- Alpha cells pop-in stagger
- Skin/hero cells slide-right stagger
- Toast slide-down
- Confetti khi bấm Chạy Mod
- Haptic feedback mọi tap (Telegram SDK)
