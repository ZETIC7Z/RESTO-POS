// ─────────────────────────────────────────────────────────────
// Ligaya Kusina Express — POS data model, constants & helpers
// ─────────────────────────────────────────────────────────────

export type Role = 'admin' | 'cashier';
export type CategoryId =
  | 'Silog & Rice'
  | 'Chicken'
  | 'Burgers'
  | 'Noodles'
  | 'Drinks'
  | 'Desserts';
export type OrderType = 'Dine-In' | 'Take-Out' | 'Delivery';
export type PaymentMethod = 'Cash' | 'GCash' | 'Maya' | 'Card';
export type KitchenStatus = 'New' | 'Cooking' | 'Ready' | 'Served';
export type ExpenseCategory =
  | 'Ingredients'
  | 'Utilities'
  | 'Packaging'
  | 'Salaries'
  | 'Other';

export interface Addon {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  image: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: CategoryId;
  available: boolean;
  popular?: boolean;
  updatedAt: number;
  deleted?: boolean;
}

export interface OrderLine {
  id: string;
  menuId: string;
  title: string;
  image: string;
  price: number;
  qty: number;
  addons: Addon[];
}

export interface Discount {
  id: string;
  code: string;
  label: string;
  percent?: number;
  fixed?: number;
  minOrder: number;
  statutory?: boolean;
}

export interface Totals {
  subTotal: number;
  lessVat: number;
  discount: number;
  vatableSales: number;
  vat: number;
  vatExempt: number;
  total: number;
}

export interface Order extends Totals {
  id: string;
  receiptNo: string;
  queueNo: number;
  createdAt: number;
  updatedAt: number;
  orderType: OrderType;
  table: string;
  customerName: string;
  cashier: string;
  items: OrderLine[];
  discountCode?: string;
  tendered: number;
  change: number;
  payment: PaymentMethod;
  paymentRef?: string;
  kitchenStatus: KitchenStatus;
  status: 'paid' | 'void';
  voidReason?: string;
  deleted?: boolean;
}

export interface TableTab {
  id: string;
  table: string;
  orderType: OrderType;
  customerName: string;
  items: OrderLine[];
  discountId?: string | null;
  kitchenStatus: KitchenStatus;
  openedAt: number;
  updatedAt: number;
  cashier: string;
  deleted?: boolean;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  createdAt: number;
  updatedAt: number;
  recordedBy: string;
  deleted?: boolean;
}

export interface Account {
  username: string;
  password: string;
  role: Role;
  name: string;
}

export interface Settings {
  storeName: string;
  address: string;
  tin: string;
  vatRate: number;
  tableCount: number;
  receiptFooter: string;
  accounts: Account[];
  updatedAt: number;
}

export interface PosDb {
  version: number;
  menuItems: MenuItem[];
  orders: Order[];
  tabs: TableTab[];
  expenses: Expense[];
  settings: Settings;
  counters: { receipt: number; queueDate: string; queue: number };
}

export interface Patch {
  menuItems?: MenuItem[];
  orders?: Order[];
  tabs?: TableTab[];
  expenses?: Expense[];
  settings?: Settings;
}

export interface Session {
  username: string;
  role: Role;
  name: string;
  loginAt: number;
}

// ── Constants ────────────────────────────────────────────────

export const CATEGORIES: { id: CategoryId; label: string; icon: string }[] = [
  { id: 'Silog & Rice', label: 'Silog & Rice', icon: 'rice_bowl' },
  { id: 'Chicken', label: 'Chicken', icon: 'kebab_dining' },
  { id: 'Burgers', label: 'Burgers', icon: 'lunch_dining' },
  { id: 'Noodles', label: 'Pancit', icon: 'ramen_dining' },
  { id: 'Drinks', label: 'Drinks', icon: 'local_cafe' },
  { id: 'Desserts', label: 'Desserts', icon: 'icecream' },
];

export const ADDONS: Addon[] = [
  { id: 'addon-rice', name: 'Extra Garlic Rice', price: 25 },
  { id: 'addon-egg', name: 'Fried Egg', price: 20 },
  { id: 'addon-gravy', name: 'Extra Gravy', price: 15 },
  { id: 'addon-cheese', name: 'Cheese Slice', price: 20 },
  { id: 'addon-upsize', name: 'Upsize Drink', price: 25 },
];

export const DISCOUNTS: Discount[] = [
  {
    id: 'sc-pwd',
    code: 'SC/PWD',
    label: 'Senior / PWD 20%',
    percent: 20,
    minOrder: 0,
    statutory: true,
  },
  { id: 'barkada', code: 'BARKADA10', label: 'Barkada 10%', percent: 10, minOrder: 500 },
  { id: 'merienda', code: 'MERIENDA50', label: '₱50 Off', fixed: 50, minOrder: 300 },
  { id: 'staff', code: 'STAFF30', label: 'Staff 30%', percent: 30, minOrder: 0 },
];

export const PAYMENT_METHODS: { id: PaymentMethod; icon: string }[] = [
  { id: 'Cash', icon: 'payments' },
  { id: 'GCash', icon: 'account_balance_wallet' },
  { id: 'Maya', icon: 'qr_code_2' },
  { id: 'Card', icon: 'credit_card' },
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Ingredients',
  'Utilities',
  'Packaging',
  'Salaries',
  'Other',
];

export const IMAGE_PRESETS: { label: string; src: string }[] = [
  { label: 'Silog plate', src: '/items/ph-tapsilog.jpg' },
  { label: 'Grilled chicken', src: '/items/ph-inasal.jpg' },
  { label: 'Sisig', src: '/items/ph-sisig.jpg' },
  { label: 'Lechon kawali', src: '/items/ph-kawali.jpg' },
  { label: 'Stew', src: '/items/ph-karekare.jpg' },
  { label: 'Fried chicken', src: '/items/ph-friedchicken.jpg' },
  { label: 'Chicken bucket', src: '/items/ph-bucket.jpg' },
  { label: 'Lumpia', src: '/items/ph-lumpia.jpg' },
  { label: 'Soup', src: '/items/ph-sinigang.jpg' },
  { label: 'Spaghetti', src: '/items/ph-spaghetti.jpg' },
  { label: 'Palabok', src: '/items/ph-palabok.jpg' },
  { label: 'Pancit', src: '/items/ph-pancit.jpg' },
  { label: 'Noodle soup', src: '/items/ph-mami.jpg' },
  { label: 'Cold drink', src: '/items/ph-sagotgulaman.jpg' },
  { label: 'Iced tea', src: '/items/ph-calamansi.jpg' },
  { label: 'Shake', src: '/items/ph-bukopandan.jpg' },
  { label: 'Coffee', src: '/items/ph-barako.jpg' },
  { label: 'Soda', src: '/items/ph-soda.jpg' },
  { label: 'Halo-halo', src: '/items/ph-halohalo.jpg' },
  { label: 'Leche flan', src: '/items/ph-lecheflan.jpg' },
  { label: 'Turon', src: '/items/ph-turon.jpg' },
  { label: 'Pie', src: '/items/ph-mangopie.jpg' },
  ...Array.from({ length: 12 }, (_, i) => ({
    label: `Burger ${i + 1}`,
    src: `/items/${i + 1}.png`,
  })),
];

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Ligaya Kusina Express',
  address: 'Lamitan City, Basilan, Philippines',
  tin: 'VAT REG TIN: 000-000-000-000',
  vatRate: 12,
  tableCount: 12,
  receiptFooter: 'Maraming salamat po! Balik po kayo.',
  accounts: [
    { username: 'admin', password: 'admin', role: 'admin', name: 'Administrator' },
    { username: 'user', password: 'user', role: 'cashier', name: 'Cashier' },
  ],
  updatedAt: 0,
};

const m = (
  id: string,
  category: CategoryId,
  title: string,
  price: number,
  image: string,
  description: string,
  stock: number,
  popular = false
): MenuItem => ({
  id,
  category,
  title,
  price,
  image,
  description,
  stock,
  popular,
  available: true,
  updatedAt: 0,
});

export const INITIAL_MENU: MenuItem[] = [
  m('ph-silog-1', 'Silog & Rice', 'Beef Tapsilog', 145, '/items/ph-tapsilog.jpg', 'Beef tapa, garlic rice, fried egg & atchara', 80, true),
  m('ph-silog-2', 'Silog & Rice', 'Chicken Inasal Meal', 159, '/items/ph-inasal.jpg', 'Char-grilled lemongrass chicken with java rice', 80, true),
  m('ph-silog-3', 'Silog & Rice', 'Sizzling Pork Sisig', 165, '/items/ph-sisig.jpg', 'Crispy chopped pork, onion, chili & egg', 70, true),
  m('ph-silog-4', 'Silog & Rice', 'Lechon Kawali Meal', 169, '/items/ph-kawali.jpg', 'Crackling pork belly with liver sauce', 60),
  m('ph-silog-5', 'Silog & Rice', 'Beef Kare-Kare', 195, '/items/ph-karekare.jpg', 'Peanut stew, vegetables & bagoong', 40),
  m('ph-silog-6', 'Silog & Rice', 'Pork Tocilog', 125, '/items/ph-tapsilog.jpg', 'Sweet cured tocino, garlic rice & egg', 80),
  m('ph-chk-1', 'Chicken', '1-pc Fried Chicken w/ Rice', 99, '/items/ph-friedchicken.jpg', 'Crispy fried chicken, rice & gravy', 120, true),
  m('ph-chk-2', 'Chicken', '2-pc Fried Chicken Meal', 175, '/items/ph-friedchicken.jpg', 'Two pieces, rice, gravy & iced tea', 90, true),
  m('ph-chk-3', 'Chicken', '6-pc Barkada Bucket', 469, '/items/ph-bucket.jpg', 'Six pieces with three gravy tubs', 40, true),
  m('ph-chk-4', 'Chicken', 'Lumpiang Shanghai (8 pcs)', 119, '/items/ph-lumpia.jpg', 'Pork spring rolls with sweet chili', 80),
  m('ph-chk-5', 'Chicken', 'Pork Sinigang Bowl', 239, '/items/ph-sinigang.jpg', 'Sour tamarind broth with pork ribs', 30),
  m('burger-1', 'Burgers', 'Classic Burger', 69, '/items/1.png', 'Beef patty with house dressing', 100, true),
  m('burger-2', 'Burgers', 'Double Burger Overload', 165, '/items/2.png', 'Double patty, bacon & cheddar', 60, true),
  m('burger-3', 'Burgers', 'Cheese Burger Deluxe', 89, '/items/3.png', 'Double cheddar, lettuce & tomato', 80),
  m('burger-4', 'Burgers', 'Double Cheese Burger', 185, '/items/4.png', 'Two quarter-pound patties', 50),
  m('burger-5', 'Burgers', 'Spicy Burger', 135, '/items/5.png', 'Spicy glaze & jalapeño aioli', 50),
  m('burger-6', 'Burgers', 'Black Bun Burger', 149, '/items/6.png', 'Charcoal bun, crispy fillet & bacon', 50),
  m('burger-7', 'Burgers', 'BBQ Brisket Burger', 139, '/items/7.png', 'Pulled brisket & cheddar', 40),
  m('burger-8', 'Burgers', 'Jumbo Cheese Tower', 229, '/items/8.png', 'Triple patty with cheese sauce', 30),
  m('burger-12', 'Burgers', 'Crispy Chicken Burger', 119, '/items/12.png', 'Chicken fillet & honey mustard', 60),
  m('ph-noodle-1', 'Noodles', 'Pinoy Spaghetti', 85, '/items/ph-spaghetti.jpg', 'Sweet-style sauce with hotdog & cheese', 100, true),
  m('ph-noodle-2', 'Noodles', 'Pancit Palabok', 115, '/items/ph-palabok.jpg', 'Shrimp sauce, chicharon & egg', 60, true),
  m('ph-noodle-3', 'Noodles', 'Pancit Canton', 120, '/items/ph-pancit.jpg', 'Stir-fried noodles with pork & shrimp', 60),
  m('ph-noodle-4', 'Noodles', 'Special Lomi', 135, '/items/ph-mami.jpg', 'Thick noodles in rich egg broth', 50),
  m('ph-drink-1', 'Drinks', "Sago't Gulaman", 49, '/items/ph-sagotgulaman.jpg', 'Brown sugar cooler, sago & gulaman', 150, true),
  m('ph-drink-2', 'Drinks', 'Calamansi Iced Tea', 55, '/items/ph-calamansi.jpg', 'Brewed tea with calamansi & honey', 150),
  m('ph-drink-3', 'Drinks', 'Buko Pandan Shake', 75, '/items/ph-bukopandan.jpg', 'Young coconut & pandan jelly', 100, true),
  m('ph-drink-4', 'Drinks', 'Iced Kapeng Barako', 85, '/items/ph-barako.jpg', 'Batangas coffee over ice', 100),
  m('ph-drink-5', 'Drinks', 'Softdrinks (16oz)', 39, '/items/ph-soda.jpg', 'Coke, Sprite or Royal', 200),
  m('ph-dessert-1', 'Desserts', 'Halo-Halo Espesyal', 119, '/items/ph-halohalo.jpg', 'Ube, leche flan, beans & shaved ice', 80, true),
  m('ph-dessert-2', 'Desserts', 'Leche Flan', 129, '/items/ph-lecheflan.jpg', 'Classic caramel custard', 40),
  m('ph-dessert-3', 'Desserts', 'Turon w/ Langka (3)', 65, '/items/ph-turon.jpg', 'Banana & jackfruit spring rolls', 80),
  m('ph-dessert-4', 'Desserts', 'Mango Pie (2)', 75, '/items/ph-mangopie.jpg', 'Flaky pie with Guimaras mango', 60),
];

// ── Formatting & date helpers (all dates in Asia/Manila) ─────

export const TZ = 'Asia/Manila';

const fmtPeso = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const peso = (n: number) => `₱${fmtPeso.format(n || 0)}`;
export const pesoCompact = (n: number) => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `₱${(n / 1000).toFixed(1)}k`;
  return `₱${Math.round(n)}`;
};

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

/** YYYY-MM-DD in Manila time */
export const dayKey = (ts: number) => fKey.format(new Date(ts));
export const fmtDateTime = (ts: number) => fDateTime.format(new Date(ts));
export const fmtTime = (ts: number) => fTime.format(new Date(ts));
export const manilaHour = (ts: number) =>
  Number(fHour.format(new Date(ts))) % 24;
/** Manila midnight of a YYYY-MM-DD key, as a UTC instant */
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

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
