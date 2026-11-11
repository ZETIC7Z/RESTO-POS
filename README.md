# RESTO-POS · Ligaya Kusina Express

> **Advanced Fast-Food & Restaurant Point of Sale (POS) System with Multi-Device Wi-Fi LAN Sync, Scannable QR Connect, Interactive Sales Calendar, and Official Receipt Printing.**  
> Built for **Ligaya Kusina Express** — *Lamitan City, Basilan, Philippines*.

---

## 🌟 Key Features

### 1. 📱 Instant Tablet & Mobile QR Connect
- **Zero-Typing Device Pairing**: Cashiers and servers do not need to type LAN IP addresses into mobile or tablet browsers.
- Clicking **"View QR"** or **"Tablet QR Connect"** opens a high-contrast modal with a live scannable QR code (`react-qr-code`) encoding the active restaurant Wi-Fi address (e.g. `http://192.168.254.105:5173/`).
- Point any iPad, Android tablet, or smartphone camera at the screen to launch the POS register instantly.

### 2. 🖥️ Full-Screen Touch-First Interface
- **Hand-Friendly Touch Targets**: Every button, quantity stepper (`−` / `+`), payment chip, and category pill is sized between **48px and 64px** height for fast, tactile one-hand operation on touchscreen terminals and tablets.
- **Hidden Browser URL Bar**: Includes automatic `requestFullscreen({ navigationUI: 'hide' })` upon signing in, a top header **Full Screen** toggle button, and a progressive web app manifest (`manifest.webmanifest`) with `"display": "fullscreen"`.

### 3. 🔐 Role-Based Access Control (Cashier vs. Admin)
- **Fast-Food Login Screen**: Modeled after modern quick-service POS terminals with one-tap credential quick-fill cards for instant terminal testing.
- **Admin (`admin` / `admin`)**:
  - Full access to POS Register, Tables & Tabs, Kitchen Display (KDS), **Sales Calendar & Income Analytics**, **Menu & Stock CRUD Manager**, and **Store & Staff Settings**.
  - Authorized to edit payment methods, customer names, or void transactions.
- **Cashier (`user` / `user`)**:
  - Dedicated register terminal access: punches customer orders, selects add-ons, manages dining room tables, sends tickets to the kitchen, and prints official receipts.
  - Financial income reports, menu price editing, and store settings are securely hidden.

### 4. 📅 Interactive Monthly Sales Calendar & Day Ledger
- **Visual Month-at-a-Glance**: Navigate across months with live daily order count badges (e.g. `31 ord`) and daily gross revenue pills (e.g. `₱14.1k`).
- **Deep Single-Day Breakdown**: Tap any previous or current day on the calendar to inspect:
  - **Total Orders in Day** (with paid vs. void count)
  - **Gross Sales (`₱ PHP`)** and average ticket size
  - **Net Sales (ex-VAT)** and **12% VAT Collected**
  - **Discounts Given** (Senior Citizen / PWD & promo vouchers)
  - **Day Expenses** and **Net Profit**
- **Hourly Sales Activity Chart**: Visual bar graph of order volumes throughout the day (7 AM – 9 PM Manila Time).
- **Payment Channel Breakdown**: Instant revenue totals across **Cash**, **GCash**, **Maya**, and **Card**.
- **Day Expense Logger**: Add ingredients, utilities, packaging, or salary payouts on specific days to compute true net profit.
- **Itemized Timestamped Order Ledger**: Every single order displays its exact Manila date & time, cashier name, customer name, order type, items ordered, and total.
- **CSV Data Export**: One-tap export to structured `.csv` format (`ligaya-kusina-sales-YYYY-MM-DD.csv`).
- **End-of-Day Z-Reading Report**: Thermal printable summary for daily cashier closing and BIR compliance.

### 5. 🧾 80mm Thermal Official Receipt Printing
- Formatted specifically for standard **80mm thermal ESC/POS receipt printers** (`@media print` clean layout).
- Contains store branding, address (*Lamitan City, Basilan, Philippines*), BIR TIN header, Official Receipt number (`OR-xxxxxx`), Queue number (`#001`), Manila timestamp, cashier name, itemized lines with extras, statutory Senior Citizen/PWD VAT-exempt breakdown, cash tendered, change (*sukli*), and verification QR code.

### 6. 🇵🇭 Philippine Pricing & Statutory Compliance
- **Currency**: Philippine Peso (`₱ PHP`), formatted via `Intl.NumberFormat('en-PH')`.
- **Timezone**: `Asia/Manila` (`UTC+8`) for all order timestamps, Z-readings, and calendar buckets.
- **12% VAT-Inclusive Engine**: Handles standard VATable transactions and Philippine **RA 9994** statutory discounts (VAT-exempt base with 20% discount for Senior Citizens and PWDs).

### 7. 🍽️ Dining Tables & Open Tabs Floor Map
- Manage dining tables with real-time visual status: **Available (Free)** vs. **Occupied (Active Tab)**.
- Hold open tabs for dine-in guests, add additional dishes as they order, and load tabs into the register for final settlement.

### 8. 👨‍🍳 Kitchen Display System (KDS)
- Real-time ticket pipeline for kitchen and line cooks.
- 1-tap ticket progression: **`New` ➔ `Cooking` ➔ `Ready` ➔ `Served`**.

### 9. 🍲 Philippine Fast-Food Menu & Stock Inventory
- Pre-populated with **33 Philippine & fast-food dishes** across 6 categories:
  - 🍚 **Silog & Rice**: *Beef Tapsilog, Chicken Inasal Meal, Sizzling Pork Sisig, Lechon Kawali, Kare-Kare, Pork Tocilog*
  - 🍗 **Chicken**: *1-pc & 2-pc Fried Chicken Meals, 6-pc Barkada Bucket, Lumpiang Shanghai, Sinigang Bowl*
  - 🍔 **Burgers**: *Classic Burger, Double Burger Overload, Cheese Burger Deluxe, Black Bun Burger, BBQ Brisket Burger*
  - 🍜 **Noodles (Pancit)**: *Pinoy Spaghetti, Pancit Palabok, Pancit Canton, Special Lomi*
  - 🥤 **Drinks**: *Sago't Gulaman, Calamansi Iced Tea, Buko Pandan Shake, Iced Kapeng Barako, Softdrinks*
  - 🍨 **Desserts**: *Halo-Halo Espesyal, Leche Flan, Turon w/ Langka, Mango Pie*
- Full menu CRUD: edit prices, restock quantities (+20 button), toggle availability, or add custom dishes with photo presets.

### 10. 🌐 Local Wi-Fi LAN Sync (No Cloud Dependency Required)
- Built-in local REST API plugin in Vite (`server/posApi.ts`) that persists state atomically to `data/ligaya-db.json`.
- Automatically detects the host PC's Wi-Fi IPv4 address.
- 3-second background polling with optimistic offline queuing: if the restaurant Wi-Fi drops, cashiers can continue taking orders offline; changes automatically flush and sync when reconnected.

---

## 🔑 Default Login Credentials

| Role | Username | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin` | **Full Control** (Register, Tables, Kitchen, Sales Calendar, Menu, Settings, Void Sales) |
| **Cashier** | `user` | `user` | **Register Terminal** (Register, Tables, Kitchen Queue, Receipt Printing) |

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/), Glassmorphism 3D utilities, [Material Icons Round](https://fonts.google.com/icons)
- **Tooling & Bundler**: [Vite 6](https://vitejs.dev/) with Node.js local LAN persistence plugin
- **QR Code Engine**: [react-qr-code](https://github.com/rosskhanas/react-qr-code)
- **Formatting**: Native `Intl.NumberFormat` (Philippine Peso `₱`) and `Intl.DateTimeFormat` (`Asia/Manila`)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation & Run

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ZETIC7Z/RESTO-POS.git
   cd RESTO-POS
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local POS server with LAN access**:
   ```bash
   npm run dev
   ```

4. **Access the POS**:
   - **On the host PC**: Open [http://localhost:5173/](http://localhost:5173/)
   - **On tablets or smartphones**: Connect to the same restaurant Wi-Fi, open the host PC screen, click **"View QR"**, and scan the QR code with your camera (or navigate to `http://<YOUR_LAN_IP>:5173/`).

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📁 Project Structure

```text
RESTO-POS/
├── public/                     # Static food assets, icons, manifest, and SVG logo
│   ├── items/                  # High-resolution Philippine dish photos & burger items
│   ├── manifest.webmanifest    # Fullscreen PWA configuration
│   └── zeticuz-logo.svg        # Developer signature logo
├── server/
│   └── posApi.ts               # Local LAN sync API (/api/pos/*) with atomic file storage
├── src/
│   ├── components/
│   │   ├── AdminPanels.tsx     # TablesView, KitchenView, MenuManagerView, SettingsView
│   │   ├── LoginScreen.tsx     # 3D Glassy Fast-Food Login with Role Selector
│   │   ├── QrModal.tsx         # Live Scannable Wi-Fi QR Code Modal
│   │   ├── ReceiptModal.tsx    # 80mm Thermal Official Receipt & Z-Reading Report
│   │   ├── SalesCalendarView.tsx # Interactive Monthly Sales Calendar & Day Ledger
│   │   └── ui.tsx              # Large touch buttons, modals, stat cards, fullscreen hook
│   ├── data/
│   │   ├── posData.ts          # Core types, Philippine menu items, Manila date helpers
│   │   └── seed.ts             # Deterministic 45-day sales & expense generator
│   ├── lib/
│   │   ├── merge.ts            # CRDT state merger & Official Receipt number assigner
│   │   ├── pricing.ts          # Philippine VAT-inclusive & Senior/PWD calculation engine
│   │   └── usePosStore.ts      # Multi-device sync hook with offline queueing
│   ├── App.tsx                 # Master POS application layout and navigation
│   ├── index.css               # 3D glass styles, touch utilities, and 80mm print rules
│   └── main.tsx                # React entry point
├── index.html                  # HTML5 shell with PWA fullscreen meta tags & Google fonts
├── package.json                # Dependencies and build scripts
├── vite.config.ts              # Vite configuration with posApiPlugin LAN endpoints
├── LICENSE                     # MIT License
└── README.md                   # Complete system documentation
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Developer & Attribution

```text
SITE DEVELOPED BY: Sam Pangilinan · © 2026
```

- **Portfolio**: [https://www.zeticuz.xyz/](https://www.zeticuz.xyz/)
- **GitHub**: [@ZETIC7Z](https://github.com/ZETIC7Z)
