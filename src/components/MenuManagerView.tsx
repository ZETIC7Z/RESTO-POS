import React, { useMemo, useState } from 'react';
import { CATEGORIES, CategoryId, peso, Product } from '../data/posData';
import { deleteMenuImageByUrl, supabase, uploadMenuImage } from '../lib/supabase';
import { Btn, cx, Icon, Modal } from './ui';

interface ProductFormState {
  id?: string;
  name: string;
  category: CategoryId;
  price: number;
  stock_qty: number;
  is_available: boolean;
  image_url: string | null;
}

export function MenuManagerView({
  products,
  onRefresh,
}: {
  products: Product[];
  onRefresh: () => Promise<void>;
}) {
  const [catFilter, setCatFilter] = useState<'ALL' | CategoryId>('ALL');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>({
    name: '',
    category: 'Signature Coffee',
    price: 120,
    stock_qty: 50,
    is_available: true,
    image_url: null,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (catFilter === 'ALL' ? true : p.category === catFilter))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [products, catFilter, search]);

  const openAdd = () => {
    setForm({
      name: '',
      category: 'Signature Coffee',
      price: 120,
      stock_qty: 50,
      is_available: true,
      image_url: null,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setErr('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      category: (CATEGORIES.some((c) => c.id === p.category)
        ? p.category
        : 'Signature Coffee') as CategoryId,
      price: Number(p.price),
      stock_qty: Number(p.stock_qty),
      is_available: p.is_available,
      image_url: p.image_url,
    });
    setSelectedFile(null);
    setPreviewUrl(p.image_url);
    setErr('');
    setModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setErr('');
    try {
      let nextImageUrl = form.image_url;
      if (selectedFile) {
        nextImageUrl = await uploadMenuImage(selectedFile);
        if (form.image_url && form.image_url !== nextImageUrl) {
          await deleteMenuImageByUrl(form.image_url);
        }
      }

      const payload = {
        name: form.name.trim(),
        category: form.category,
        price: Number(form.price),
        stock_qty: Math.max(0, Math.floor(Number(form.stock_qty))),
        is_available: form.is_available,
        image_url: nextImageUrl,
      };

      if (form.id) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }

      setModalOpen(false);
      await onRefresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRestock = async (p: Product, addQty: number) => {
    setBusyId(p.id);
    try {
      const { error } = await supabase
        .from('products')
        .update({ stock_qty: Number(p.stock_qty) + addQty })
        .eq('id', p.id);
      if (error) throw error;
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update stock.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (p: Product) => {
    setBusyId(p.id);
    try {
      const { error } = await supabase.from('products').delete().eq('id', p.id);
      if (error) throw error;
      if (p.image_url) {
        await deleteMenuImageByUrl(p.image_url);
      }
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete product.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Cloud Menu &amp; Stock Manager ({products.length} items)
            </h2>
            <p className="text-xs text-white/55">
              Upload dish photos directly to Supabase Storage (<span className="font-mono">menu-images</span>) and manage live prices and stock.
            </p>
          </div>
          <Btn size="lg" variant="success" icon="add_circle" onClick={openAdd}>
            Add Menu Item
          </Btn>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCatFilter('ALL')}
              className={cx(
                'h-11 rounded-xl border px-3.5 text-xs font-extrabold transition',
                catFilter === 'ALL' ? 'chip-active' : 'border-white/10 bg-white/[0.04] text-white/65'
              )}
            >
              All Categories
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id)}
                className={cx(
                  'h-11 rounded-xl border px-3.5 text-xs font-extrabold transition',
                  catFilter === c.id ? 'chip-active' : 'border-white/10 bg-white/[0.04] text-white/65'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            placeholder="Search menu item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input !h-11 !w-64 text-xs"
          />
        </div>

        {visible.length === 0 ? (
          <div className="py-16 text-center text-white/45">
            <Icon name="restaurant_menu" className="text-5xl text-white/25" />
            <p className="mt-2 text-base font-extrabold text-white">No menu items yet</p>
            <p className="mt-1 text-xs">
              Click &ldquo;Add Menu Item&rdquo; above to add dishes with uploaded photos to Supabase.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((p) => (
              <div
                key={p.id}
                className="glass-card flex items-center justify-between gap-3 rounded-2xl p-3.5"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                      <Icon name="fastfood" className="text-2xl text-orange-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-extrabold text-white">{p.name}</p>
                      {!p.is_available && (
                        <span className="rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                          HIDDEN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">{p.category}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-sm font-extrabold text-orange-300 tabular-nums">
                        {peso(p.price)}
                      </span>
                      <span
                        className={cx(
                          'text-xs font-bold tabular-nums',
                          p.stock_qty <= 5 ? 'text-red-300' : 'text-emerald-300'
                        )}
                      >
                        Stock: {p.stock_qty}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-1.5">
                  <div className="flex gap-1.5">
                    <Btn
                      size="md"
                      variant="ghost"
                      disabled={busyId === p.id}
                      onClick={() => void handleQuickRestock(p, 20)}
                      className="!h-10 !px-2.5 text-xs"
                    >
                      +20
                    </Btn>
                    <Btn
                      size="md"
                      variant="soft"
                      icon="edit"
                      onClick={() => openEdit(p)}
                      className="!h-10 !px-2.5"
                    />
                  </div>
                  {confirmDeleteId === p.id ? (
                    <Btn
                      size="md"
                      variant="danger"
                      icon="delete_forever"
                      disabled={busyId === p.id}
                      onClick={() => void handleDelete(p)}
                      className="!h-9 !px-2 text-xs"
                    >
                      Confirm
                    </Btn>
                  ) : (
                    <Btn
                      size="md"
                      variant="danger"
                      icon="delete"
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="!h-9 !px-2 text-xs"
                    >
                      Delete
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal
          title={form.id ? `Edit Menu Item · ${form.name}` : 'Add New Menu Item'}
          subtitle="Photo uploads directly to Supabase Storage bucket: menu-images"
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Dish Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Chicken Inasal Meal"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as CategoryId })
                  }
                  className="input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#11141d] text-white">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Price (₱ PHP)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Stock Qty
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.stock_qty}
                  onChange={(e) => setForm({ ...form, stock_qty: Number(e.target.value) })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Upload Dish Photo (Supabase Storage)
              </label>
              <div className="glass-card flex items-center gap-4 rounded-2xl p-3">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon name="add_a_photo" className="text-2xl text-white/40" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-white/75 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-500 file:px-3.5 file:py-2 file:text-xs file:font-extrabold file:text-white hover:file:brightness-110"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-bold text-white">
              <input
                type="checkbox"
                checked={form.is_available}
                onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
                className="h-5 w-5 accent-orange-500"
              />
              Available on Cashier POS Register
            </label>

            {err && (
              <div className="rounded-2xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-200">
                {err}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Btn size="lg" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" size="lg" variant="success" icon="save" disabled={saving}>
                {saving ? 'Uploading & Saving...' : 'Save Menu Item'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
