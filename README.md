# RESTO-POS · EL Farm Cafe Cloud POS

> **Full-Cloud Restaurant & Cafe Point of Sale, Live Smart TV Queue Display, Kitchen Display System (KDS), Employee Attendance Calendar, and Lamitan City (BARMM-05) Payroll System.**  
> Powered by **Supabase** (PostgreSQL, Auth, Storage, Realtime) & **Vercel SPA** for **EL Farm Cafe** — *Lamitan City, Basilan, Philippines*.

---

## 🔄 What Was Upgraded in Cloud v2.0

Previously a single-device local file POS, **RESTO-POS** is now a **100% cloud-synced multi-terminal platform** with zero hardcoded demo seed data or local JSON storage:

- **100% Live Cloud Persistence**: Removed local Express/Vite JSON file storage and hardcoded demo seed items — all products, images, orders, customers, shift logs, and store rates read and write directly to Supabase PostgreSQL + Storage.
- **Role-Routed Multi-Device Screens (`react-router-dom` v6)**: Dedicated terminals for Cashiers (`/cashier`), Kitchen Crew (`/crew`), Smart TV Queue Monitor (`/display`), and Admin Management (`/admin`), all guarded by `ProtectedRoute` and Supabase Row Level Security (RLS).
- **Dynamic Menu Image Upload & Storage**: Adding or editing dishes in `/admin` uploads photos directly from your device to the public `menu-images` Storage bucket and saves the dish + URL directly into `public.products` (deleting a dish also removes its Storage image).
- **Live Submitted-Order Editor & Voiding**: Cashiers and Admins can adjust quantities/items on already-submitted orders (`update_submitted_order` RPC) or void orders (`cancel_order` RPC) with automatic inventory stock reconciliation.
- **Automatic Cashier Attendance & Payroll**: Every Cashier sign-in automatically stamps Time-In in `attendance_logs`, and clicking **Log Out / End Shift** stamps Time-Out. Feeds directly into per-employee monthly calendars, an Absence tracker, a Year-End Christmas Bonus Leaderboard, and a Lamitan City **BARMM-05** (`₱54.50/hr` / Dec 1, 2026 `₱57.63/hr` · `1.25x` OT) 80mm thermal Payslip printer.

---

## 🌟 System Features by Terminal

### 1. 🔐 Unified Staff Login & Auto Shift Clock (`/login`)
- Modern 3D frosted-glass fast-food login screen with **Cashier** and **Admin** role selection cards.
- Supports signing in via **Username or Email** via Supabase Auth (`signInWithPassword`).
- **Automatic Shift Tracking**: Cashier login inserts an open shift in `attendance_logs` (`shift_date` in `Asia/Manila`, `login_time = now()`); logging out stamps `logout_time = now()`.
- Includes **Device QR Connect** (`react-qr-code`) for instant tablet/TV pairing and one-tap **Full Screen** mode.

### 2. 📱 Cashier POS Terminal (`/cashier`)
- Touch-friendly (`48px–64px` targets) menu grid showing live Supabase `products`, uploaded photos, Peso prices (`₱ PHP`), and `stock_qty` badges (out-of-stock dishes automatically disabled).
- **Customer CRM Modal**: Search existing loyal guests or quick-add new customers (`public.customers`).
- **Philippine Tax & Discounts**: Supports regular **12% VAT-inclusive** calculation and **Senior Citizen / PWD (RA 9994)** VAT-exempt + 20% statutory discounts.
- **Checkout & 80mm Thermal Receipt**: Calls `process_checkout` PostgreSQL RPC to issue a daily resetting Queue `#` (`#01`, `#02`, …) and monotonic Official Receipt (`OR-xxxxxx`), deduct stock atomically, and trigger `window.print()` for 80mm ESC/POS thermal receipt printers.
- **Today's Orders Drawer**: Reprint receipts, edit submitted items (`update_submitted_order` RPC), or cancel/void (`cancel_order` RPC).

### 3. 👨‍🍳 Kitchen Display System (`/crew`)
- Live Realtime queue for kitchen staff showing today's `preparing` and `ready` orders.
- Large 1-tap progression buttons: **`Mark Ready (Call Queue)`** → **`Complete (Claimed)`**.

### 4. 📺 Smart TV / Android TV Customer Queue Screen (`/display`)
- Zero-clutter, full-screen split monitor: **PREPARING** on the left and high-contrast emerald **NOW SERVING** on the right.
- Updates live via Supabase Realtime whenever kitchen staff press **Mark Ready**, plays a two-tone Web Audio API chime alert, and keeps the display awake via `navigator.wakeLock`.

### 5. 📊 Admin Management Dashboard (`/admin`)
- **Live Today Overview Banner**: Shows the active Cashier on duty today (with clock-in time), Today's Cashier Sales (`₱`), Clients/Orders Served, and Food Items Served.
- **Sales Calendar & Order Ledger**: Interactive monthly calendar showing daily order counts and revenue totals; click any date to view hourly activity, payment channels (`Cash`, `GCash`, `Maya`, `Card`), Z-Reading thermal printout, CSV export, or Edit/Cancel/Delete orders.
- **Cloud Menu & Stock Manager**: Full CRUD on `public.products` with `<input type="file" accept="image/*" />` upload to Supabase Storage `menu-images`, quick `+20` restock button, and availability toggles.
- **Employees & Attendance Calendar**: Create Cashier logins using a secondary non-persisted Supabase client (`persistSession: false`) so the Admin stays logged in, toggle active/inactive status, view individual monthly attendance calendars with automatic **ABSENT** indicators, and rank cashiers on the **Year-End Christmas Bonus Leaderboard**.
- **Cashier Payroll & 80mm Payslip Printer (BARMM-05)**: Semi-monthly cutoffs (`1st–15th` or `16th–End of Month` with automatic 28/29/30/31-day detection), manual Overtime Hours entry by exact date (`1.25x`), and 80mm Thermal / QMS Payslip printing centered under **EL Farm Cafe**.
- **Store Settings**: Edit store name, address, BIR TIN, default hourly rate (with 1-click **Wage Order BARMM-05** presets: `₱54.50/hr` now and `₱57.63/hr` Dec 1, 2026), and overtime multiplier.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend UI** | React 19, TypeScript 5.7, Tailwind CSS 3.4, Material Icons Round |
| **Routing & QR** | React Router DOM v6 (`BrowserRouter`), `react-qr-code` |
| **Cloud Backend** | Supabase (`@supabase/supabase-js`) — PostgreSQL, Auth, Row Level Security (RLS), Storage (`menu-images`), Realtime |
| **Localization & Tax** | `Asia/Manila` timezone, `en-PH` Philippine Peso (`₱`), 12% VAT & RA 9994 Senior/PWD engine, BARMM-05 payroll rules |
| **Build & Hosting** | Vite 6, Vercel (`vercel.json` SPA rewrites) |

---

## 🗄️ Step-by-Step Supabase Setup Guide

Follow these steps to set up your own clean Supabase backend from scratch.

### Step 1: Create a Supabase Project & Storage Bucket
1. Sign in to [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
2. Once provisioned, go to **Storage → New bucket**:
   - Name: `menu-images`
   - Toggle **Public bucket** → **ON**
   - Save.

### Step 2: Run the SQL Setup Script in Supabase SQL Editor
Open **SQL Editor → New Query** in your Supabase Dashboard, paste the full contents of [`supabase/schema.sql`](supabase/schema.sql) (also shown below), and click **Run**.

<details>
<summary><strong>Click to expand complete SQL setup script (Tables, RLS, Storage, Realtime & RPCs)</strong></summary>

```sql
-- 1. Extensions
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2. Core Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  username text unique not null,
  full_name text not null,
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  hourly_rate numeric default 54.50,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.attendance_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  cashier_id uuid not null references public.profiles (id) on delete cascade,
  shift_date date not null default ((now() at time zone 'Asia/Manila')::date),
  login_time timestamptz not null default now(),
  logout_time timestamptz,
  overtime_hours numeric default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  category text not null,
  price numeric not null,
  stock_qty integer not null default 0,
  image_url text,
  is_available boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  phone text unique,
  total_spent numeric default 0,
  visit_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_number integer not null,
  or_number text not null,
  cashier_id uuid references public.profiles (id) on delete set null,
  cashier_name text not null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text default 'Walk-in Customer',
  payment_method text default 'Cash',
  discount_type text default 'none' check (discount_type in ('none', 'senior_pwd', 'promo')),
  vatable_sales numeric default 0,
  vat_amount numeric default 0,
  discount_amount numeric default 0,
  total_amount numeric not null,
  amount_paid numeric not null,
  change_due numeric not null,
  status text not null default 'preparing' check (status in ('preparing', 'ready', 'completed', 'cancelled')),
  receipt_snapshot jsonb not null,
  order_date date default ((now() at time zone 'Asia/Manila')::date),
  created_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default extensions.uuid_generate_v4(),
  order_id uuid references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null,
  unit_price numeric not null
);

create table if not exists public.store_settings (
  id integer primary key default 1,
  store_name text default 'EL Farm Cafe',
  address text default 'Lamitan City, Basilan, Philippines',
  tin text default '000-000-000-000',
  default_hourly_rate numeric default 54.50,
  ot_multiplier numeric default 1.25
);

insert into public.store_settings (id, store_name, address, tin, default_hourly_rate, ot_multiplier)
values (1, 'EL Farm Cafe', 'Lamitan City, Basilan, Philippines', '000-000-000-000', 54.50, 1.25)
on conflict (id) do nothing;
```

> See [`supabase/schema.sql`](supabase/schema.sql) for the complete script including all RLS policies, Storage `menu-images` policies, Realtime publication setup, and PostgreSQL RPC functions (`is_admin`, `resolve_login_profile`, `admin_upsert_cashier_profile`, `admin_create_cashier_account`, `process_checkout`, `update_submitted_order`, and `cancel_order`).

</details>

---

### Step 3: How to Manually Create Your First Admin Account in Supabase
Because sign-up requires admin verification and databases start completely empty:

1. In Supabase Dashboard, go to **Authentication → Users**.
2. Click **Add user → Create new user**:
   - **Email**: e.g. `admin@yourcafe.com`
   - **Password**: choose a strong password
   - Check **Auto Confirm User** (`ON`) and click **Create user**.
3. Copy the generated **User UID** (`uuid`) from the Users table.
4. Go to **SQL Editor → New Query** and run:
   ```sql
   INSERT INTO public.profiles (id, email, username, full_name, role, hourly_rate, is_active)
   VALUES (
     'PASTE-YOUR-USER-UUID-HERE',
     'admin@yourcafe.com',
     'admin',
     'Store Owner',
     'admin',
     54.50,
     true
   );
   ```
5. You can now sign in at `/login` under the **Admin** card using either `admin` or `admin@yourcafe.com`, and create Cashier accounts directly from the **Employees** tab inside `/admin`!

---

### Step 4: Configure Environment Variables (`.env`)
Copy `.env.example` to `.env` in the project root and paste your own API credentials from **Supabase Dashboard → Project Settings → API**:

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key
```

> **Security Note:** Never commit `.env` or expose your `service_role` secret key in the frontend or GitHub repository. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in `.env`.

---

## 💻 Local Run & Vercel Deployment

### Run Locally
```bash
npm install
npm run dev
```

### Production Build & Vercel Deployment
The project includes [`vercel.json`](vercel.json) for SPA client-side route rewrites (`/` → `/index.html`).

1. Install Vercel CLI (optional) or connect your GitHub repo in the Vercel Dashboard:
   ```bash
   npm run build
   ```
2. In Vercel Project Settings → **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy:
   ```bash
   vercel --prod
   ```

---

## 📁 Project Structure

```text
RESTO-POS/
├── public/
│   ├── el-farm-logo.jpg              # EL Farm Cafe gold monogram logo
│   ├── manifest.webmanifest          # Fullscreen PWA configuration
│   └── zeticuz-logo.svg              # Developer signature mark
├── supabase/
│   └── schema.sql                    # Complete PostgreSQL schema, RLS, Storage & RPCs
├── src/
│   ├── components/
│   │   ├── EmployeesAttendanceView.tsx # Cashier CRUD, Attendance Calendar & Bonus Leaderboard
│   │   ├── LoginScreen.tsx           # Role-based /login portal
│   │   ├── MenuManagerView.tsx       # Menu CRUD + menu-images Storage upload/delete
│   │   ├── OrderEditorModal.tsx      # Post-submit order item/qty editor (reconciles stock)
│   │   ├── PayrollView.tsx           # Lamitan BARMM-05 cutoff calculator & OT logger
│   │   ├── QrModal.tsx               # Multi-device QR connect modal
│   │   ├── ReceiptModal.tsx          # 80mm Official Receipt, Z-Reading & BARMM-05 Payslip
│   │   ├── SalesCalendarView.tsx     # Monthly Sales Calendar & day order ledger
│   │   ├── StoreSettingsView.tsx     # Branding, TIN & BARMM-05 presets
│   │   └── ui.tsx                    # Touch buttons, modals, BrandLogo & fullscreen hooks
│   ├── data/
│   │   └── posData.ts                # Supabase types, BARMM-05 presets & Manila date helpers
│   ├── lib/
│   │   ├── AuthContext.tsx           # Session auth, RLS profile & auto attendance shift logs
│   │   ├── pricing.ts                # 12% VAT-inclusive & Senior/PWD (RA 9994) math
│   │   └── supabase.ts               # Supabase client, ephemeral signup client & Storage API
│   ├── pages/
│   │   ├── AdminDashboardPage.tsx    # /admin management dashboard & live today banner
│   │   ├── CashierPage.tsx           # /cashier touch register, CRM, checkout & order drawer
│   │   ├── CrewKitchenPage.tsx       # /crew real-time Kitchen Display System (KDS)
│   │   └── QueueDisplayPage.tsx      # /display Smart TV Preparing / Now Serving split board
│   ├── App.tsx                       # React Router DOM v6 routes & ProtectedRoute guards
│   ├── index.css                     # Glass UI utilities & 80mm thermal @media print styles
│   └── main.tsx                      # Entry point
├── .env.example                      # Safe environment template
├── vercel.json                       # Vercel SPA rewrite configuration
├── LICENSE                           # MIT License
└── README.md                         # Complete setup & system guide
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

---

## ⭐ Star History

<a href="https://star-history.com/#ZETIC7Z/RESTO-POS&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ZETIC7Z/RESTO-POS&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=ZETIC7Z/RESTO-POS&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=ZETIC7Z/RESTO-POS&type=Date" />
 </picture>
</a>
