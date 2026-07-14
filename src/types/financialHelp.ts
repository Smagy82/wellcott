// src/types/financialHelp.ts — модель данных для раздела «Финансовая помощь»

export type FinancialHelpCategory =
  | 'hospital_bills'          // счета из больницы
  | 'prescriptions'          // лекарства
  | 'local_referral'         // локальная навигация (211)
  | 'find_care'              // помощь найти клинику
  | 'free_clinics'           // бесплатные/благотворительные клиники
  | 'government'             // госпрограммы (Medicaid, ACA)
  | 'copay_disease_specific' // copay-фонды под болезнь (нужна страховка)
  | 'medical_debt';          // списание меддолга

export type FinancialHelpAction = 'apply' | 'call' | 'info' | 'directory';

export interface FinancialHelpOrg {
  id: string;
  category: FinancialHelpCategory;
  /** Подходит ли нашему ядру (нет денег, нет страховки).
   *  false = осторожно: нужна страховка/диагноз, полную стоимость не оплачивает. */
  bestForUninsured: boolean;
  actionType: FinancialHelpAction;
  url: string;
  phone: string;                  // '' если нет
  scope: 'national' | string;    // 'national' или 2-буквенный код штата
}

export interface FinancialHelpData {
  version: string;
  note: string;
  organizations: FinancialHelpOrg[];
}
