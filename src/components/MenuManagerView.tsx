import React, { useMemo, useState } from 'react';
import {
  AddonItem,
  AddonScope,
  CATEGORIES,
  CategoryId,
  encodeAddonCategory,
  isAddonProduct,
  parseAddonProduct,
  peso,
  Product,
} from '../data/posData';
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

interface AddonFormState {
  id?: string;
  name: string;
  price: number;
  stock_qty: number;
  is_available: boolean;
  image_url: string | null;
  categories: CategoryId[];
  productIds: string[];
  excludedProductIds: string[];
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

  // Regular Dish / Drink Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>({
    name: '',
    category: 'Signature Coffee',
    price: 120,
    stock_qty: 50,
    is_available: true,
    image_url: null,
  });
  const [itemAddonMap, setItemAddonMap] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Extra / Add-On Modal
  const [addonModalOpen, setAddonModalOpen] = useState(false);
  const [addonForm, setAddonForm] = useState<AddonFormState>({
    name: '',
    price: 20,
    stock_qty: 200,
    is_available: true,
    image_url: null,
    categories: [],
    productIds: [],
    excludedProductIds: [],
  });
  const [addonFile, setAddonFile] = useState<File | null>(null);
  const [addonPreviewUrl, setAddonPreviewUrl] = useState<string | null>(null);
  const [addonSaving, setAddonSaving] = useState(false);
  const [addonErr, setAddonErr] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const menuProducts = useMemo(
    () => products.filter((p) => !isAddonProduct(p)),
    [products]
  );

  const addonItems = useMemo<AddonItem[]>(
    () => products.filter(isAddonProduct).map(parseAddonProduct),
    [products]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuProducts
      .filter((p) => (catFilter === 'ALL' ? true : p.category === catFilter))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true));
  }, [menuProducts, catFilter, search]);

  const computeInitialAddonSelection = (cat: CategoryId, productId?: string) => {
    const map: Record<string, boolean> = {};
    for (const a of addonItems) {
      if (productId) {
        map[a.id] =
          !a.scope.excludedProductIds.includes(productId) &&
          (a.scope.productIds.includes(productId) || a.scope.categories.includes(cat));
      } else {
        map[a.id] = a.scope.categories.includes(cat);
      }
    }
    return map;
  };

  const openAdd = () => {
    const defCat: CategoryId = 'Signature Coffee';
    setForm({
      name: '',
      category: defCat,
      price: 120,
      stock_qty: 50,
      is_available: true,
      image_url: null,
    });
    setItemAddonMap(computeInitialAddonSelection(defCat));
    setSelectedFile(null);
    setPreviewUrl(null);
    setErr('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    const cat = (CATEGORIES.some((c) => c.id === p.category)
      ? p.category
      : 'Signature Coffee') as CategoryId;
    setForm({
      id: p.id,
      name: p.name,
      category: cat,
      price: Number(p.price),
      stock_qty: Number(p.stock_qty),
      is_available: p.is_available,
      image_url: p.image_url,
    });
    setItemAddonMap(computeInitialAddonSelection(cat, p.id));
    setSelectedFile(null);
    setPreviewUrl(p.image_url);
    setErr('');
    setModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) setPreviewUrl(URL.createObjectURL(file));
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

      let savedId = form.id;
      if (form.id) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', form.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('products')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        savedId = inserted?.id;
      }

      // Sync per-item add-on assignments without touching other items
      if (savedId && addonItems.length > 0) {
        for (const addon of addonItems) {
          const wantChecked = Boolean(itemAddonMap[addon.id]);
          const byCategory = addon.scope.categories.includes(form.category);
          const nextProductIds = new Set(addon.scope.productIds);
          const nextExcluded = new Set(addon.scope.excludedProductIds);

          if (wantChecked) {
            nextExcluded.delete(savedId);
            if (!byCategory) nextProductIds.add(savedId);
            else nextProductIds.delete(savedId);
          } else {
            nextProductIds.delete(savedId);
            if (byCategory) nextExcluded.add(savedId);
            else nextExcluded.delete(savedId);
          }

          const updatedCategory = encodeAddonCategory({
            categories: addon.scope.categories,
            productIds: Array.from(nextProductIds),
            excludedProductIds: Array.from(nextExcluded),
          });
          const origCategory = encodeAddonCategory(addon.scope);
          if (updatedCategory !== origCategory) {
            await supabase
              .from('products')
              .update({ category: updatedCategory })
              .eq('id', addon.id);
          }
        }
      }

      setModalOpen(false);
      await onRefresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  // Add / Edit Add-On Extra
  const openAddAddon = () => {
    setAddonForm({
      name: '',
      price: 20,
      stock_qty: 200,
      is_available: true,
      image_url: null,
      categories: ['Silogs & Goto'],
      productIds: [],
      excludedProductIds: [],
    });
    setAddonFile(null);
    setAddonPreviewUrl(null);
    setAddonErr('');
    setAddonModalOpen(true);
  };

  const openEditAddon = (a: AddonItem) => {
    setAddonForm({
      id: a.id,
      name: a.name,
      price: a.price,
      stock_qty: a.stock_qty,
      is_available: a.is_available,
      image_url: a.image_url,
      categories: [...a.scope.categories],
      productIds: [...a.scope.productIds],
      excludedProductIds: [...a.scope.excludedProductIds],
    });
    setAddonFile(null);
    setAddonPreviewUrl(a.image_url);
    setAddonErr('');
    setAddonModalOpen(true);
  };

  const handleSaveAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addonForm.name.trim()) return;
    setAddonSaving(true);
    setAddonErr('');
    try {
      let nextImageUrl = addonForm.image_url;
      if (addonFile) {
        nextImageUrl = await uploadMenuImage(addonFile);
        if (addonForm.image_url && addonForm.image_url !== nextImageUrl) {
          await deleteMenuImageByUrl(addonForm.image_url);
        }
      }

      const scope: AddonScope = {
        categories: addonForm.categories,
        productIds: addonForm.productIds,
        excludedProductIds: addonForm.excludedProductIds,
      };
      const payload = {
        name: addonForm.name.trim(),
        category: encodeAddonCategory(scope),
        price: Number(addonForm.price),
        stock_qty: Math.max(0, Math.floor(Number(addonForm.stock_qty))),
        is_available: addonForm.is_available,
        image_url: nextImageUrl,
      };

      if (addonForm.id) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', addonForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }

      setAddonModalOpen(false);
      await onRefresh();
    } catch (error) {
      setAddonErr(error instanceof Error ? error.message : 'Failed to save Add-On.');
    } finally {
      setAddonSaving(false);
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

  const handleDelete = async (id: string, imageUrl: string | null) => {
    setBusyId(id);
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      if (imageUrl) await deleteMenuImageByUrl(imageUrl);
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete item.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Main Menu Grid */}
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Cloud Menu &amp; Stock Manager ({menuProducts.length} items)
            </h2>
            <p className="text-xs text-white/55">
              Upload dish photos directly to Supabase Storage (<span className="font-mono">menu-images</span>) and manage live prices, stock &amp; per-item extras.
            </p>
          </div>
          <Btn size="lg" variant="success" icon="add_circle" onClick={openAdd}>
            Add Menu Item
          </Btn>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCatFilter('ALL')}
              className={cx(
                'h-9 rounded-xl border px-3 text-xs font-extrabold transition',
                catFilter === 'ALL' ? 'chip-active' : 'border-white/10 bg-white/[0.04] text-white/65'
              )}
            >
              All ({menuProducts.length})
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id)}
                className={cx(
                  'h-9 rounded-xl border px-3 text-xs font-extrabold transition',
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
            className="input !h-10 !w-64 text-xs"
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
                      onClick={() => void handleDelete(p.id, p.image_url)}
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

      {/* Menu Add-Ons & Extras Section */}
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Menu Add-Ons &amp; Extras ({addonItems.length})
            </h3>
            <p className="text-xs text-white/55">
              Official Cashier <span className="font-mono">+Extras</span> popup options with custom name, image, price &amp; category rules.
            </p>
          </div>
          <Btn size="md" variant="primary" icon="add_box" onClick={openAddAddon}>
            Add Extra / Add-On
          </Btn>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {addonItems.map((a) => (
            <div
              key={a.id}
              className="glass-card flex items-center justify-between gap-3 rounded-2xl p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {a.image_url ? (
                  <img
                    src={a.image_url}
                    alt={a.name}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon name="add_circle" className="text-xl text-amber-300" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-white">{a.name}</p>
                  <p className="text-xs font-extrabold text-amber-300">+{peso(a.price)}</p>
                  <p className="truncate text-[10px] text-white/50">
                    {a.scope.categories.length > 0
                      ? a.scope.categories.join(', ')
                      : `${a.scope.productIds.length} item(s)`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Btn
                  size="md"
                  variant="soft"
                  icon="edit"
                  onClick={() => openEditAddon(a)}
                  className="!h-9 !px-2"
                />
                {confirmDeleteId === a.id ? (
                  <Btn
                    size="md"
                    variant="danger"
                    icon="delete_forever"
                    disabled={busyId === a.id}
                    onClick={() => void handleDelete(a.id, a.image_url)}
                    className="!h-9 !px-2 text-xs"
                  >
                    Yes
                  </Btn>
                ) : (
                  <Btn
                    size="md"
                    variant="danger"
                    icon="delete"
                    onClick={() => setConfirmDeleteId(a.id)}
                    className="!h-9 !px-2"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Menu Item Modal */}
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
                  onChange={(e) => {
                    const nextCat = e.target.value as CategoryId;
                    setForm({ ...form, category: nextCat });
                    if (!form.id) setItemAddonMap(computeInitialAddonSelection(nextCat));
                  }}
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

            {addonItems.length > 0 && (
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-white/60">
                  Available Add-Ons / Extras on This Item
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {addonItems.map((addon) => (
                    <label
                      key={addon.id}
                      className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(itemAddonMap[addon.id])}
                          onChange={(e) =>
                            setItemAddonMap((prev) => ({
                              ...prev,
                              [addon.id]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 accent-orange-500"
                        />
                        {addon.name}
                      </span>
                      <span className="text-amber-300">+{peso(addon.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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

      {/* Add / Edit Extra Add-On Modal */}
      {addonModalOpen && (
        <Modal
          title={addonForm.id ? `Edit Extra / Add-On · ${addonForm.name}` : 'Add Extra / Add-On'}
          subtitle="Set add-on name, photo, price & applicable menu categories"
          onClose={() => setAddonModalOpen(false)}
        >
          <form onSubmit={handleSaveAddon} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Add-On Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra Rice, Add Egg, Oat Milk Add-on"
                  value={addonForm.name}
                  onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Price (₱)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={addonForm.price}
                  onChange={(e) =>
                    setAddonForm({ ...addonForm, price: Number(e.target.value) })
                  }
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Upload Add-On Photo (Supabase Storage)
              </label>
              <div className="glass-card flex items-center gap-4 rounded-2xl p-3">
                {addonPreviewUrl ? (
                  <img
                    src={addonPreviewUrl}
                    alt="Add-on Preview"
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon name="add_a_photo" className="text-2xl text-white/40" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setAddonFile(f);
                    if (f) setAddonPreviewUrl(URL.createObjectURL(f));
                  }}
                  className="w-full text-xs text-white/75 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-500 file:px-3.5 file:py-2 file:text-xs file:font-extrabold file:text-white hover:file:brightness-110"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/60">
                Show Automatically On Categories
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CATEGORIES.map((c) => {
                  const checked = addonForm.categories.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...addonForm.categories, c.id]
                            : addonForm.categories.filter((x) => x !== c.id);
                          setAddonForm({ ...addonForm, categories: next });
                        }}
                        className="h-4 w-4 accent-orange-500"
                      />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm font-bold text-white">
              <input
                type="checkbox"
                checked={addonForm.is_available}
                onChange={(e) =>
                  setAddonForm({ ...addonForm, is_available: e.target.checked })
                }
                className="h-5 w-5 accent-orange-500"
              />
              Active on Cashier +Extras Popup
            </label>

            {addonErr && (
              <div className="rounded-2xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-200">
                {addonErr}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Btn size="lg" variant="ghost" onClick={() => setAddonModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" size="lg" variant="success" icon="save" disabled={addonSaving}>
                {addonSaving ? 'Saving Add-On...' : 'Save Add-On'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
