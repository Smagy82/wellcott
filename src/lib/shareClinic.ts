import { Share } from 'react-native';

type ShareableClinic = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone?: string | null;
};

export async function shareClinic(
  clinic: ShareableClinic,
  t: (key: string) => string,
  onSheetOpen?: () => void,
): Promise<void> {
  const parts = [
    clinic.name,
    `${clinic.address}, ${clinic.city}, ${clinic.state} ${clinic.zip}`,
  ];
  if (clinic.phone) parts.push(clinic.phone);
  parts.push(t('share.acceptsLine'), '', t('clinicDetail.shareFooter'));
  onSheetOpen?.(); // синхронно ДО открытия sheet — метка ставится гарантированно раньше ghost touch
  try { await Share.share({ message: parts.join('\n') }); } catch { /* cancelled */ }
}
