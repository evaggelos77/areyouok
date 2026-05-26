# AreYouOK — PWA (mobile‑first)

Neon glass PWA (install to home screen) με service worker, offline shell, multi‑language (Ελληνικά/English), check-ins, SafeWalk, Κύκλο (2–5 άτομα), login με email OTP, και Stripe subscriptions.

---

## 1) Προαπαιτούμενα

- Node.js 18+ (συνιστάται 20)
- npm 9+
- Σε Ubuntu για production: `build-essential` + `python3` (για native deps όπως `better-sqlite3`)

---

## 2) Quick start (Local Dev)

1. **Install deps (monorepo / workspaces):**

```bash
cd areyouok-pwa
npm install
```

2. **Φτιάξε env για server:**

```bash
cp server/.env.example server/.env
```

3. **Run dev:**

```bash
npm run dev
```

- Client: `http://localhost:5173`
- API/Server: `http://localhost:8080`

> Στο dev, ο Vite proxy κάνει `/api` → `localhost:8080`.

---

## 3) Production build / run (single VPS)

1. Build client:

```bash
npm run build -w client
```

2. Run server:

```bash
npm run start -w server
```

Ο server σε production σερβίρει **και** το client (από `client/dist`).

---

## 4) Deploy σε Ubuntu VPS (ενδεικτικά)

### A) Packages

```bash
sudo apt update
sudo apt install -y build-essential python3
```

### B) Install + build

```bash
cd /var/www/areyouok-pwa
npm install
npm run build -w client
```

### C) Env

```bash
cp server/.env.example server/.env
nano server/.env
```

Ρύθμισε τουλάχιστον:

- `PUBLIC_BASE_URL=https://your-domain.com`
- `JWT_SECRET=...`

### D) Run με systemd (recommended)

`/etc/systemd/system/areyouok.service`

```ini
[Unit]
Description=AreYouOK Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/areyouok-pwa/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable areyouok
sudo systemctl start areyouok
sudo systemctl status areyouok
```

### E) Nginx reverse proxy (ενδεικτικό)

- Proxy προς `http://127.0.0.1:8080`
- TLS via Let’s Encrypt

---

## 5) Web Push (Check-ins / Alerts)

1. Generate VAPID keys:

```bash
cd server
node scripts/generate-vapid-keys.js
```

2. Βάλε τα keys στο `server/.env`:

- `VAPID_PUBLIC_KEY=...`
- `VAPID_PRIVATE_KEY=...`

3. Στο app: Settings → **Enable notifications**.

---

## 6) Stripe Subscriptions (Premium)

### A) Δημιουργία προϊόντων (στο υπάρχον Stripe account)

1. Βάλε `STRIPE_SECRET_KEY` στο `server/.env`
2. Τρέξε:

```bash
cd server
node scripts/stripe-setup.js
```

Θα εμφανίσει:
- `PRICE_ID_MONTHLY`
- `PRICE_ID_YEARLY`

Βάλ’ τα στο `server/.env`.

### B) Webhook

Webhook endpoint:

- `https://your-domain.com/api/stripe/webhook`

Events (minimum):
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Βάλε το `STRIPE_WEBHOOK_SECRET` στο `server/.env`.

---

## 7) Notes / Αρχές

- **Privacy-first:** δεν υπάρχει 24/7 tracking. Location στέλνεται μόνο σε SOS / SafeWalk / explicit share / no-response.
- **No mixed-language UI:** όλο το UI ακολουθεί τη γλώσσα επιλογής.
- **Offline shell:** ανοίγει UI ακόμη και offline (οι αποστολές θέλουν σύνδεση).

---

## 8) Project Structure

- `client/` React + Vite (PWA assets: `public/manifest.webmanifest`, `public/sw.js`)
- `server/` Express API + SQLite (better-sqlite3)

