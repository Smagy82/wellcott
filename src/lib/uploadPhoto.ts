import { supabase } from './supabase';

export async function uploadBillPhoto(localUri: string): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;

  const path = `${uid}/${Date.now()}.jpg`;
  try {
    const arraybuffer = await fetch(localUri).then(res => res.arrayBuffer());
    const { error } = await supabase.storage
      .from('bills')
      .upload(path, arraybuffer, { contentType: 'image/jpeg' });
    if (error) {
      console.error('PHOTO upload error:', error);
      return null;
    }
    return path;
  } catch (e) {
    console.error('PHOTO upload error:', e);
    return null;
  }
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('bills')
    .createSignedUrl(path, 3600);
  if (error) {
    console.error('PHOTO signed url error:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}
