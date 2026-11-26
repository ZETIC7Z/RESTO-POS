# AGENT.md — Project Memory: EL Farm Cafe (`RESTO-POS` Cloud System)

## 1. Project Identity & Store Details
- **Store Name**: **EL Farm Cafe**
- **Store Address**: **Lamitan City, Basilan, Philippines**
- **Currency**: Philippine Peso (`₱ PHP`, formatted via `Intl.NumberFormat('en-PH')`)
- **Timezone**: `Asia/Manila` (`UTC+8`)
- **Payroll Wage Order**: **Wage Order No. BARMM-05** (`₱54.50/hr` / `₱436.00/day`, Dec 1, 2026 preset `₱57.63/hr` / `₱461.00/day`, Overtime `1.25x`)
- **Developer**: **Sam Pangilinan** (`ZETICUZ` — `https://www.zeticuz.xyz/`)

## 2. Cloud Backend (Supabase + Vercel SPA)
- **Supabase Cloud**: PostgreSQL + Auth + Storage + Realtime (`VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` configured in local gitignored `.env` and Vercel project env)
- **Environment File**: [`.env.example`](file:///c:/Users/ZETICUZ/Music/pos%20resto/.env.example) (template for local `.env`)
- **Database Setup Script**: [`supabase/schema.sql`](file:///c:/Users/ZETICUZ/Music/pos%20resto/supabase/schema.sql)
- **Vercel SPA Routing**: [`vercel.json`](file:///c:/Users/ZETICUZ/Music/pos%20resto/vercel.json) rewrites all routes to `/index.html`
- **Storage Bucket**: `menu-images` (public bucket for menu dish photography; deleted automatically when a dish is deleted)
- **Official Menu Categories (7)**: `Signature Coffee`, `Matcha & Smoothies`, `Silogs & Goto`, `Non-Pork Specials`, `Pork Favorites`, `Snacks & Delicacies`, `Salu-Salo Feasts` (synced with the 49-item EL Farm Cafe official menu catalog in Supabase `products` & `menu-images` Storage)
- **Realtime Publication Tables**: `profiles`, `attendance_logs`, `products`, `orders`

### Database Tables & Key RPC Functions
- **Tables**: `profiles`, `attendance_logs`, `products`, `customers`, `orders`, `order_items`, `store_settings`
- **RPC Functions**:
  - `resolve_login_profile(p_identifier text)` (`anon, authenticated`) — resolves username or email for `/login`
  - `process_checkout(...)` — creates `orders` + `order_items`, generates daily resetting `order_number` (`#01`, `#02`) and monotonic `OR-xxxxxx`, deducts `products.stock_qty`, updates `customers` visit stats
  - `update_submitted_order(...)` — reconciles `products.stock_qty` delta, updates `order_items`, recalculates order totals & `receipt_snapshot`
  - `cancel_order(p_order_id uuid)` — restores `products.stock_qty` and marks order `'cancelled'`
  - `admin_upsert_cashier_profile(...)` / `admin_create_cashier_account(...)` — Admin-only cashier provisioning RPCs keeping Admin session intact

### Row Level Security (RLS) Rules
- Cashiers can read/insert/update only their own `attendance_logs` shifts and process/edit/void POS orders (`orders`, `order_items`, `customers`), plus read `products` and `store_settings`.
- Only authenticated `admin` (`is_admin()`) accounts can access all employee `profiles`, rates, all `attendance_logs`, Payroll calculation, `products` CRUD, and `store_settings` updates.
- Public `SELECT` policies (`"Public view queue orders"`, `"Public view queue order_items"`, `"Public view store_settings"`) enable unauthenticated Smart TV `/display` queue rendering and `/login` store branding.

## 3. Multi-Device Routes (`react-router-dom` v6)
- [`/login`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/LoginScreen.tsx) — Unified Fast-Food Staff Login (Admin vs Cashier role cards, Username or Email, Device QR Connect modal, Fullscreen toggle, and automatic Cashier Time-In on `attendance_logs`).
- [`/cashier`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/pages/CashierPage.tsx) — Touch-first POS Register (`48px–64px` targets), live Supabase `products` & stock badges, Customer CRM quick-add/lookup, `None` vs `Senior & PWD (RA 9994)` VAT-exempt discount toggle, `Cash`/`GCash`/`Maya`/`Card` checkout via `process_checkout` RPC + auto 80mm thermal `window.print()`, Today's Submitted Orders drawer (Reprint, Edit, Void), and **`Log Out / End Shift`** (records `logout_time`).
- [`/crew`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/pages/CrewKitchenPage.tsx) — Kitchen Display System (KDS) subscribed via Supabase Realtime to today's `preparing` and `ready` orders with 1-tap **"Mark Ready (Call Queue)"** and **"Complete (Claimed)"**.
- [`/display`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/pages/QueueDisplayPage.tsx) — Public Smart TV / Android TV split-screen queue monitor (**"PREPARING"** left, glowing emerald **"NOW SERVING"** right) with Web Audio API chime and `navigator.wakeLock` keep-awake.
- [`/admin`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/pages/AdminDashboardPage.tsx) — Admin-only Management Dashboard (Live Today Overview banner + 5 tabs:
  - [`SalesCalendarView`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/SalesCalendarView.tsx) — Monthly sales calendar, Z-Reading thermal print, CSV export, Reprint / Edit / Cancel / Delete orders
  - [`MenuManagerView`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/MenuManagerView.tsx) — `products` CRUD + Supabase Storage `menu-images` photo upload/deletion
  - [`EmployeesAttendanceView`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/EmployeesAttendanceView.tsx) — Create/Deactivate/Remove cashiers via secondary non-persisted Supabase client, per-employee Attendance Calendar with automatic `ABSENT` highlights, and Year-End Christmas Bonus Leaderboard
  - [`PayrollView`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/PayrollView.tsx) — Semi-monthly cutoff (`1st–15th` / `16th–End`) BARMM-05 calculator, manual Overtime Hours entry by exact date, and 80mm thermal/QMS **Payslip Printer**
  - [`StoreSettingsView`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/StoreSettingsView.tsx) — Store branding, TIN, BARMM-05 hourly rate presets (`₱54.50/hr` & `₱57.63/hr`), OT multiplier, and Device QR codes).

## 4. Core Source Files
- [`src/lib/supabase.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/lib/supabase.ts) — Primary client, secondary non-persisted signup client, and `menu-images` Storage helpers
- [`src/lib/AuthContext.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/lib/AuthContext.tsx) — Supabase Auth session, `profiles` verification, `store_settings`, and automatic Cashier `attendance_logs` Time-In / Time-Out
- [`src/data/posData.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/data/posData.ts) — Cloud database interfaces, Philippine Peso formatters, BARMM-05 presets, and `Asia/Manila` date/calendar helpers
- [`src/lib/pricing.ts`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/lib/pricing.ts) — Philippine 12% VAT-inclusive & Senior Citizen/PWD (RA 9994) engine
- [`src/components/ReceiptModal.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/ReceiptModal.tsx) — 80mm Official Receipt, Daily Z-Reading, and 80mm BARMM-05 Payslip printer
- [`src/components/OrderEditorModal.tsx`](file:///c:/Users/ZETICUZ/Music/pos%20resto/src/components/OrderEditorModal.tsx) — Live submitted-order editor calling `update_submitted_order` RPC
