import { Linking } from 'react-native';

// Партнёрские ссылки. Заменить на реальную affiliate-ссылку SingleCare
// (получить через Impact / partners.singlecare.com), когда будет одобрена.
export const SINGLECARE_URL = 'https://www.singlecare.com'; // TODO: replace with affiliate link

export function openPrescriptionSavings() {
  Linking.openURL(SINGLECARE_URL);
}
