// src/types/mentalHealth.ts — модель данных MH-объекта (SAMHSA mh_facilities)

export interface MhFacility {
  id: string;
  name1: string;
  name2?: string;
  street1?: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  intakePhone?: string;
  website?: string;
  latitude: number | null;
  longitude: number | null;
  hasSlidingFee: boolean;
  hasPayAssist: boolean;
  acceptsSelfPay: boolean;
  languages?: string;
  ageGroups?: string;
  serviceSetting?: string;
  snapshotDate?: string;
}

export interface MhWithDistance extends MhFacility {
  distanceMiles: number;
}

// Сырая строка из expo-sqlite — snake_case, INTEGER вместо boolean, null вместо undefined.
export interface MhRow {
  id: string;
  name1: string;
  name2: string | null;
  street1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  intake_phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  has_sliding_fee: 0 | 1;
  has_pay_assist: 0 | 1;
  accepts_self_pay: 0 | 1;
  languages: string | null;
  age_groups: string | null;
  service_setting: string | null;
  snapshot_date: string | null;
}

export function rowToMh(r: MhRow): MhFacility {
  return {
    id:             r.id,
    name1:          r.name1,
    name2:          r.name2          ?? undefined,
    street1:        r.street1        ?? undefined,
    city:           r.city           ?? '',
    state:          r.state          ?? '',
    zip:            r.zip            ?? undefined,
    phone:          r.phone          ?? undefined,
    intakePhone:    r.intake_phone   ?? undefined,
    website:        r.website        ?? undefined,
    latitude:       r.latitude,
    longitude:      r.longitude,
    hasSlidingFee:  r.has_sliding_fee  === 1,
    hasPayAssist:   r.has_pay_assist   === 1,
    acceptsSelfPay: r.accepts_self_pay === 1,
    languages:      r.languages      ?? undefined,
    ageGroups:      r.age_groups     ?? undefined,
    serviceSetting: r.service_setting ?? undefined,
    snapshotDate:   r.snapshot_date  ?? undefined,
  };
}
