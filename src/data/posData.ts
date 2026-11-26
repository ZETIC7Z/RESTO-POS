// ─────────────────────────────────────────────────────────────
// EL Farm Cafe — Cloud POS types, constants & Manila helpers
// ─────────────────────────────────────────────────────────────

export type Role = 'admin' | 'cashier';

export type CategoryId =
  | 'Signature Coffee'
  | 'Matcha & Smoothies'
  | 'Silogs & Goto'
  | 'Non-Pork Specials'
  | 'Pork Favorites'
  | 'Snacks & Delicacies'
  | 'Salu-Salo Feasts';

export type PaymentMethod = 'Cash' | 'GCash' | 'Maya' | 'Card';
export type DiscountType = 'none' | 'senior_pwd' | 'promo';
export type OrderStatus = 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: Role;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface AttendanceLog {
  id: string;
  cashier_id: string;
  shift_date: string; // YYYY-MM-DD (Asia/Manila)
  login_time: string; // ISO timestamptz
  logout_time: string | null;
  overtime_hours: number;
  notes: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock_qty: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
}

export interface AddonScope {
  categories: CategoryId[];
  productIds: string[];
  excludedProductIds: string[];
}

export interface AddonItem {
  id: string;
  name: string;
  price: number;
  stock_qty: number;
  image_url: string | null;
  is_available: boolean;
  scope: AddonScope;
}

export const ADDON_PREFIX = 'ADDON::';

export function isAddonProduct(product: Pick<Product, 'category'> | null | undefined): boolean {
  return Boolean(product?.category && product.category.startsWith(ADDON_PREFIX));
}

export function encodeAddonCategory(scope: AddonScope): string {
  return ADDON_PREFIX + JSON.stringify({
    categories: Array.from(new Set(scope.categories || [])),
    productIds: Array.from(new Set(scope.productIds || [])),
    excludedProductIds: Array.from(new Set(scope.excludedProductIds || [])),
  });
}

export function parseAddonProduct(product: Product): AddonItem {
  let parsed: Partial<AddonScope> = {};
  if (product.category?.startsWith(ADDON_PREFIX)) {
    try {
      parsed = JSON.parse(product.category.slice(ADDON_PREFIX.length)) as Partial<AddonScope>;
    } catch {
      parsed = {};
    }
  }
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price) || 0,
    stock_qty: Number(product.stock_qty) || 0,
    image_url: product.image_url,
    is_available: product.is_available,
    scope: {
      categories: Array.isArray(parsed.categories) ? (parsed.categories as CategoryId[]) : [],
      productIds: Array.isArray(parsed.productIds) ? parsed.productIds : [],
      excludedProductIds: Array.isArray(parsed.excludedProductIds) ? parsed.excludedProductIds : [],
    },
  };
}

export function getApplicableAddons(product: Product, addons: AddonItem[]): AddonItem[] {
  return addons.filter((a) => {
    if (!a.is_available || a.stock_qty <= 0) return false;
    if (a.scope.excludedProductIds.includes(product.id)) return false;
    if (a.scope.productIds.includes(product.id)) return true;
    return a.scope.categories.includes(product.category as CategoryId);
  });
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  total_spent: number;
  visit_count: number;
  created_at: string;
}

export interface ReceiptSnapshotItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
}

export interface ReceiptSnapshot {
  store_name?: string;
  address?: string;
  tin?: string;
  order_type?: string;
  table_label?: string;
  payment_ref?: string;
  discount_label?: string;
  sub_total?: number;
  less_vat?: number;
  vat_exempt?: number;
  items?: ReceiptSnapshotItem[];
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface OrderRow {
  id: string;
  order_number: number;
  or_number: string;
  cashier_id: string | null;
  cashier_name: string;
  customer_id: string | null;
  customer_name: string;
  payment_method: string;
  discount_type: DiscountType;
  vatable_sales: number;
  vat_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  change_due: number;
  status: OrderStatus;
  receipt_snapshot: ReceiptSnapshot;
  order_date: string; // YYYY-MM-DD (Asia/Manila)
  created_at: string;
  order_items?: OrderItemRow[];
}

export interface StoreSettings {
  id: number;
  store_name: string;
  address: string;
  tin: string;
  default_hourly_rate: number;
  ot_multiplier: number;
}

export interface CartLine {
  line_key: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  image_url: string | null;
  max_stock: number;
  selected_addons?: { id: string; name: string; price: number }[];
}

// ── Constants ────────────────────────────────────────────────

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'Signature Coffee', label: 'Signature Coffee', icon: 'local_cafe' },
  { id: 'Matcha & Smoothies', label: 'Matcha & Smoothies', icon: 'blender' },
  { id: 'Silogs & Goto', label: 'Silogs & Goto', icon: 'rice_bowl' },
  { id: 'Non-Pork Specials', label: 'Non-Pork Specials', icon: 'dinner_dining' },
  { id: 'Pork Favorites', label: 'Pork Favorites', icon: 'outdoor_grill' },
  { id: 'Snacks & Delicacies', label: 'Snacks & Delicacies', icon: 'bakery_dining' },
  { id: 'Salu-Salo Feasts', label: 'Salu-Salo Feasts', icon: 'restaurant' },
];

export const PAYMENT_METHODS: { id: PaymentMethod; icon: string }[] = [
  { id: 'Cash', icon: 'payments' },
  { id: 'GCash', icon: 'account_balance_wallet' },
  { id: 'Maya', icon: 'qr_code_2' },
  { id: 'Card', icon: 'credit_card' },
];

export const BARMM_05_PRESETS = [
  {
    id: 'current',
    label: 'BARMM-05 Current (₱436.00/day · ₱54.50/hr)',
    hourly: 54.5,
    daily: 436.0,
    note: 'Wage Order No. BARMM-05 — Lamitan City, Basilan',
  },
  {
    id: 'dec2026',
    label: 'Dec 1, 2026 Tranche (₱461.00/day · ₱57.63/hr)',
    hourly: 57.63,
    daily: 461.0,
    note: 'Effective Dec 1, 2026 — Lamitan City, Basilan',
  },
];

export const FALLBACK_STORE_SETTINGS: StoreSettings = {
  id: 1,
  store_name: 'EL Farm Cafe',
  address: 'Lamitan City, Basilan, Philippines',
  tin: '000-000-000-000',
  default_hourly_rate: 54.5,
  ot_multiplier: 1.25,
};

// ── Philippine Peso Formatting ───────────────────────────────

const fmtPeso = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const peso = (n: number) => `₱${fmtPeso.format(Number(n) || 0)}`;

export const pesoCompact = (n: number) => {
  const val = Number(n) || 0;
  if (val >= 1_000_000) return `₱${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1000) return `₱${(val / 1000).toFixed(1)}k`;
  return `₱${Math.round(val)}`;
};

// ── Date & Calendar Helpers (Asia/Manila UTC+8) ──────────────

export const TZ = 'Asia/Manila';

const fKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const fDateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: TZ,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const fTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
});

const fHour = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  hour12: false,
});

const fLong = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const fMonth = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

const toDate = (input: number | string | Date) =>
  input instanceof Date ? input : new Date(input);

/** YYYY-MM-DD in Manila time */
export const dayKey = (input: number | string | Date = Date.now()) =>
  fKey.format(toDate(input));

export const fmtDateTime = (input: number | string | Date) =>
  fDateTime.format(toDate(input));

export const fmtTime = (input: number | string | Date) =>
  fTime.format(toDate(input));

export const manilaHour = (input: number | string | Date) =>
  Number(fHour.format(toDate(input))) % 24;

export const dayStart = (key: string) => Date.parse(`${key}T00:00:00+08:00`);

export const addDays = (key: string, n: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

export const weekdayOf = (key: string) =>
  new Date(`${key}T00:00:00Z`).getUTCDay();

export const fmtDayLong = (key: string) =>
  fLong.format(new Date(`${key}T00:00:00Z`));

export const fmtMonth = (key: string) =>
  fMonth.format(new Date(`${key}T00:00:00Z`));

export const daysInMonth = (year: number, month1To12: number) =>
  new Date(Date.UTC(year, month1To12, 0)).getUTCDate();

/** Compute worked hours between login and logout timestamps. Returns 0 if still clocked in unless liveNow is passed. */
export function hoursBetween(
  loginIso: string,
  logoutIso: string | null,
  liveNowMs?: number
): number {
  const start = Date.parse(loginIso);
  const end = logoutIso ? Date.parse(logoutIso) : liveNowMs;
  if (!end || Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}
