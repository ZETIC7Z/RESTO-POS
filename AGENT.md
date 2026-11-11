# AGENT.md — Project Memory: Ligaya Kusina Express (Smart Fast-Food & Restaurant POS)

## 1. Project Identity & Store Details
- **Store Name**: **Ligaya Kusina Express**
- **Store Address**: **Lamitan City, Basilan, Philippines**
- **Currency**: Philippine Peso (`₱ PHP`, formatted via `Intl.NumberFormat('en-PH')`)
- **Timezone**: `Asia/Manila` (`UTC+8`)
- **Developer**: **Sam Pangilinan** (`ZETICUZ` — `https://www.zeticuz.xyz/`)

## 2. Login Credentials & Role-Based Access Control
- **Administrator Account** (`Full Control`):
  - **Username**: `admin`
  - **Password**: `admin`
  - **Role**: `Admin`
  - **Access**: POS Register, Tables & Open Tabs, Kitchen Display (KDS), **Sales & Calendar (Income Dashboard)**, **Menu & Stock Manager**, **Store & Staff Settings**, and **Edit / Void Sales**.
- **Cashier Account** (`Standard Register Terminal`):
  - **Username**: `user`
  - **Password**: `user`
  - **Role**: `Cashier`
  - **Access**: POS Register, Tables & Open Tabs, Kitchen Display (KDS), and Official Receipt printing. Cannot view or edit Admin Income Analytics, Menu Manager, or Store Settings.

## 3. Core Architecture & File Map
- [`src/data/posData.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/data/posData.ts) — Complete TypeScript schema, 33 Philippine & fast-food menu items (`Silog & Rice`, `Chicken`, `Burgers`, `Noodles`, `Drinks`, `Desserts`), add-ons, promo/Senior Citizen discounts, and `Asia/Manila` date/calendar helpers.
- [`src/lib/pricing.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/lib/pricing.ts) — Philippine 12% VAT-inclusive & Senior Citizen / PWD (`RA 9994` VAT-exempt + 20% discount) calculation engine.
- [`src/lib/merge.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/lib/merge.ts) — Last-write-wins CRDT record merger and server-side Official Receipt (`OR-xxxxxx`) + daily queue number assignment.
- [`src/data/seed.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/data/seed.ts) — Deterministic 45-day sales & expense history generator so the Sales Calendar is immediately populated across current and previous months.
- [`server/posApi.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/server/posApi.ts) & [`vite.config.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/vite.config.ts) — Local LAN REST persistence plugin (`/api/pos/state`, `/api/pos/patch`, `/api/pos/reset`, `/api/pos/backup`) writing atomically to `data/ligaya-db.json` and auto-detecting the host machine's Wi-Fi IPv4 address (`192.168.254.105`).
- [`src/lib/usePosStore.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/lib/usePosStore.ts) — Real-time LAN sync hook with 3-second polling and offline local fallback.
- [`src/components/LoginScreen.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/LoginScreen.tsx) — Modern 3D glassy fast-food login screen with Username, Password, touchable Role cards (`Cashier` vs `Admin`), 1-tap quick-fill buttons, Full-Screen trigger, and Tablet QR Connect.
- [`src/components/QrModal.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/QrModal.tsx) — Renders a real scannable 260px QR code (`react-qr-code`) encoding the live LAN URL (`http://192.168.254.105:5173/`) so tablets/phones open the POS automatically on scan.
- [`src/components/SalesCalendarView.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/SalesCalendarView.tsx) — Interactive monthly calendar with daily order count & revenue badges, click-any-date inspection (Total Orders in Day, Gross Sales, Net Sales ex-VAT, 12% VAT, Discounts, Expenses, Net Profit), hourly peak chart, payment method breakdown, expense logger, Z-Reading report, CSV export, and Admin Edit/Void order controls.
- [`src/components/ReceiptModal.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/ReceiptModal.tsx) — 80mm thermal Official Receipt (`#printable-receipt`) and Daily Z-Reading thermal report with embedded scannable QR code.
- [`src/components/AdminPanels.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/AdminPanels.tsx) — Dining Floor Tables & Open Tabs manager, Kitchen Display System (KDS), Menu & Stock CRUD manager, and Store/Account Settings.

## 4. Running Locally & Across Restaurant Wi-Fi / LAN
- Start dev server with LAN host binding (`--host 0.0.0.0`):
  - `npm run dev`
- Local PC URL: `http://localhost:5173/`
- Tablet / Mobile Wi-Fi LAN URL: `http://192.168.254.105:5173/` (or click **View QR / Tablet QR Connect** inside the app and scan with any tablet/phone camera).
