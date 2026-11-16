import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.'
  );
}

export const MENU_IMAGES_BUCKET = 'menu-images';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Secondary non-persisted client used when Admin provisions a new Cashier
 * via Supabase Auth so the Admin session stays logged in.
 */
export function createNonPersistedClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'ligaya-pos-ephemeral-signup',
    },
  });
}

/** Upload a menu item photo to Supabase Storage (`menu-images`) and return its public URL. */
export async function uploadMenuImage(file: File): Promise<string> {
  const rawExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg';
  const filePath = `dishes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  const { error: uploadError } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/** Delete an uploaded image from `menu-images` Storage when a product or image is removed. */
export async function deleteMenuImageByUrl(imageUrl?: string | null): Promise<void> {
  if (!imageUrl) return;
  const marker = `/storage/v1/object/public/${MENU_IMAGES_BUCKET}/`;
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return;

  const encodedPath = imageUrl.slice(idx + marker.length).split('?')[0];
  const objectPath = decodeURIComponent(encodedPath);
  if (!objectPath) return;

  await supabase.storage.from(MENU_IMAGES_BUCKET).remove([objectPath]);
}
