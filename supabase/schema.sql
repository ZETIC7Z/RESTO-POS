-- ============================================================================
-- RESTO-POS (EL Farm Cafe) — Complete Supabase Cloud POS Setup Script
-- Run this entire script inside your Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. Required Extensions
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- 2. Tables
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

-- Seed single default store configuration row (no demo orders or menu items)
insert into public.store_settings (id, store_name, address, tin, default_hourly_rate, ot_multiplier)
values (1, 'EL Farm Cafe', 'Lamitan City, Basilan, Philippines', '000-000-000-000', 54.50, 1.25)
on conflict (id) do nothing;

-- 3. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_settings enable row level security;

-- Helper: Check if logged-in user is an active Admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.profiles
     where id = auth.uid()
       and role = 'admin'
       and is_active = true
  );
$$;

-- 4. RLS Policies

-- profiles
drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admin full access profiles" on public.profiles;
create policy "Admin full access profiles" on public.profiles
  for all using (public.is_admin());

-- attendance_logs
drop policy if exists "Cashier view own attendance" on public.attendance_logs;
create policy "Cashier view own attendance" on public.attendance_logs
  for select using (auth.uid() = cashier_id);

drop policy if exists "Cashier log own attendance" on public.attendance_logs;
create policy "Cashier log own attendance" on public.attendance_logs
  for insert with check (auth.uid() = cashier_id);

drop policy if exists "Cashier update own logout" on public.attendance_logs;
create policy "Cashier update own logout" on public.attendance_logs
  for update using (auth.uid() = cashier_id);

drop policy if exists "Admin full access attendance" on public.attendance_logs;
create policy "Admin full access attendance" on public.attendance_logs
  for all using (public.is_admin());

-- products
drop policy if exists "Staff view products" on public.products;
create policy "Staff view products" on public.products
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admin manage products" on public.products;
create policy "Admin manage products" on public.products
  for all using (public.is_admin());

-- customers
drop policy if exists "Staff manage customers" on public.customers;
create policy "Staff manage customers" on public.customers
  for all using (auth.role() = 'authenticated');

-- orders & order_items (Authenticated staff full control + public read for /display Smart TV queue)
drop policy if exists "Staff manage orders" on public.orders;
create policy "Staff manage orders" on public.orders
  for all using (auth.role() = 'authenticated');

drop policy if exists "Public view queue orders" on public.orders;
create policy "Public view queue orders" on public.orders
  for select using (true);

drop policy if exists "Staff manage order_items" on public.order_items;
create policy "Staff manage order_items" on public.order_items
  for all using (auth.role() = 'authenticated');

drop policy if exists "Public view queue order_items" on public.order_items;
create policy "Public view queue order_items" on public.order_items
  for select using (true);

-- store_settings
drop policy if exists "Staff view settings" on public.store_settings;
create policy "Staff view settings" on public.store_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "Public view store_settings" on public.store_settings;
create policy "Public view store_settings" on public.store_settings
  for select using (true);

drop policy if exists "Admin update settings" on public.store_settings;
create policy "Admin update settings" on public.store_settings
  for update using (public.is_admin());

-- 5. Storage Bucket (`menu-images`) & Policy
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Menu Images Access" on storage.objects;
drop policy if exists "Public read menu images" on storage.objects;
create policy "Public read menu images" on storage.objects
  for select using (bucket_id = 'menu-images');

drop policy if exists "Admin manage menu images" on storage.objects;
create policy "Admin manage menu images" on storage.objects
  for insert with check (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "Admin update menu images" on storage.objects;
create policy "Admin update menu images" on storage.objects
  for update using (bucket_id = 'menu-images' and public.is_admin());

drop policy if exists "Admin delete menu images" on storage.objects;
create policy "Admin delete menu images" on storage.objects
  for delete using (bucket_id = 'menu-images' and public.is_admin());

-- 6. Supabase Realtime Publication
do $$
declare
  tbl text;
begin
  foreach tbl in array array['profiles', 'attendance_logs', 'products', 'orders'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;

-- 7. RPC Functions

-- Username or email lookup before signInWithPassword
create or replace function public.resolve_login_profile(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof record;
begin
  select id, email, username, full_name, role, is_active
    into v_prof
    from public.profiles
   where lower(username) = lower(trim(p_identifier))
      or lower(email) = lower(trim(p_identifier))
   limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_prof.id,
    'email', v_prof.email,
    'username', v_prof.username,
    'full_name', v_prof.full_name,
    'role', v_prof.role,
    'is_active', v_prof.is_active
  );
end;
$$;

revoke all on function public.resolve_login_profile(text) from public;
grant execute on function public.resolve_login_profile(text) to anon, authenticated;

-- Admin: Confirm email & upsert cashier profile after non-persisted client signUp
create or replace function public.admin_upsert_cashier_profile(
  p_user_id uuid,
  p_email text,
  p_username text,
  p_full_name text,
  p_hourly_rate numeric default 54.50
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required';
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = p_user_id;

  insert into public.profiles (id, email, username, full_name, role, hourly_rate, is_active)
  values (
    p_user_id,
    lower(trim(p_email)),
    lower(trim(p_username)),
    trim(p_full_name),
    'cashier',
    coalesce(p_hourly_rate, 54.50),
    true
  )
  on conflict (id) do update
  set email = excluded.email,
      username = excluded.username,
      full_name = excluded.full_name,
      role = 'cashier',
      hourly_rate = excluded.hourly_rate,
      is_active = true;
end;
$$;

revoke all on function public.admin_upsert_cashier_profile(uuid, text, text, text, numeric) from public;
grant execute on function public.admin_upsert_cashier_profile(uuid, text, text, text, numeric) to authenticated;

-- Admin fallback: Directly provision cashier auth + profile if email signup rate limit occurs
create or replace function public.admin_create_cashier_account(
  p_email text,
  p_password text,
  p_username text,
  p_full_name text,
  p_hourly_rate numeric default 54.50
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
  v_username text := lower(trim(p_username));
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin access required';
  end if;

  if v_email = '' or v_username = '' or length(coalesce(p_password, '')) < 6 then
    raise exception 'Email, username, and password (min 6 chars) are required';
  end if;

  if exists (select 1 from public.profiles where lower(username) = v_username) then
    raise exception 'Username "%" is already taken', v_username;
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Email "%" is already registered', v_email;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_sso_user, is_anonymous
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('email_verified', true, 'full_name', trim(p_full_name)),
    now(), now(), '', '', '', '', false, false
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(), now()
  );

  insert into public.profiles (id, email, username, full_name, role, hourly_rate, is_active)
  values (v_user_id, v_email, v_username, trim(p_full_name), 'cashier', coalesce(p_hourly_rate, 54.50), true);

  return v_user_id;
end;
$$;

revoke all on function public.admin_create_cashier_account(text, text, text, text, numeric) from public;
grant execute on function public.admin_create_cashier_account(text, text, text, text, numeric) to authenticated;

-- Atomic POS checkout with daily resetting queue numbers and monotonic OR numbers
create or replace function public.process_checkout(
  p_cashier_id uuid,
  p_cashier_name text,
  p_customer_id uuid,
  p_customer_name text,
  p_payment_method text,
  p_discount_type text,
  p_vatable_sales numeric,
  p_vat_amount numeric,
  p_discount_amount numeric,
  p_total_amount numeric,
  p_amount_paid numeric,
  p_change_due numeric,
  p_receipt_snapshot jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_next_number integer;
  v_next_or_num bigint;
  v_or_number text;
  v_manila_date date := (now() at time zone 'Asia/Manila')::date;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to process checkout';
  end if;

  select coalesce(max(order_number), 0) + 1
    into v_next_number
    from public.orders
   where order_date = v_manila_date;

  select coalesce(max(nullif(regexp_replace(or_number, '\D', '', 'g'), '')::bigint), 0) + 1
    into v_next_or_num
    from public.orders;

  v_or_number := 'OR-' || lpad(v_next_or_num::text, 6, '0');

  insert into public.orders (
    order_number, or_number, cashier_id, cashier_name, customer_id, customer_name,
    payment_method, discount_type, vatable_sales, vat_amount, discount_amount,
    total_amount, amount_paid, change_due, status, receipt_snapshot, order_date
  )
  values (
    v_next_number, v_or_number, p_cashier_id, p_cashier_name, p_customer_id,
    coalesce(nullif(p_customer_name, ''), 'Walk-in Customer'), p_payment_method,
    p_discount_type, p_vatable_sales, p_vat_amount, p_discount_amount,
    p_total_amount, p_amount_paid, p_change_due, 'preparing', p_receipt_snapshot, v_manila_date
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
    values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::integer,
      (v_item->>'unit_price')::numeric
    );

    update public.products
       set stock_qty = greatest(0, stock_qty - (v_item->>'quantity')::integer)
     where id = (v_item->>'product_id')::uuid;
  end loop;

  if p_customer_id is not null then
    update public.customers
       set total_spent = total_spent + p_total_amount,
           visit_count = visit_count + 1
     where id = p_customer_id;
  end if;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_next_number, 'or_number', v_or_number);
end;
$$;

revoke all on function public.process_checkout(uuid, text, uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb) from public, anon;
grant execute on function public.process_checkout(uuid, text, uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb) to authenticated;

-- Edit already-submitted order and automatically reconcile product stock deltas
create or replace function public.update_submitted_order(
  p_order_id uuid,
  p_new_items jsonb,
  p_new_total numeric,
  p_new_vatable numeric,
  p_new_vat numeric,
  p_new_discount numeric,
  p_new_change numeric,
  p_new_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_item record;
  v_new_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required';
  end if;

  for v_old_item in select product_id, quantity from public.order_items where order_id = p_order_id loop
    update public.products set stock_qty = stock_qty + v_old_item.quantity where id = v_old_item.product_id;
  end loop;

  delete from public.order_items where order_id = p_order_id;

  for v_new_item in select * from jsonb_array_elements(p_new_items) loop
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
    values (
      p_order_id,
      (v_new_item->>'product_id')::uuid,
      v_new_item->>'product_name',
      (v_new_item->>'quantity')::integer,
      (v_new_item->>'unit_price')::numeric
    );

    update public.products
       set stock_qty = greatest(0, stock_qty - (v_new_item->>'quantity')::integer)
     where id = (v_new_item->>'product_id')::uuid;
  end loop;

  update public.orders
     set total_amount = p_new_total,
         vatable_sales = p_new_vatable,
         vat_amount = p_new_vat,
         discount_amount = p_new_discount,
         change_due = p_new_change,
         receipt_snapshot = p_new_snapshot
   where id = p_order_id;
end;
$$;

revoke all on function public.update_submitted_order(uuid, jsonb, numeric, numeric, numeric, numeric, numeric, jsonb) from public, anon;
grant execute on function public.update_submitted_order(uuid, jsonb, numeric, numeric, numeric, numeric, numeric, jsonb) to authenticated;

-- Cancel / Void an order and restore inventory stock
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: Authentication required';
  end if;

  select status into v_status from public.orders where id = p_order_id;
  if v_status = 'cancelled' then
    return;
  end if;

  for v_item in select product_id, quantity from public.order_items where order_id = p_order_id loop
    update public.products set stock_qty = stock_qty + v_item.quantity where id = v_item.product_id;
  end loop;

  update public.orders set status = 'cancelled' where id = p_order_id;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;
