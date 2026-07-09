// src/types/clinic.ts — модель данных клиники

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;          // 2-буквенный код штата
  zip: string;
  county?: string;
  phone?: string;
  website?: string;
  latitude: number;
  longitude: number;
  siteType?: string;      // напр. "Federally Qualified Health Center"
  acceptsUninsured: boolean; // v1: у всех FQHC = true (обязаны по закону)
  slidingScale: boolean;     // оплата по шкале дохода
  services?: string[];    // medical / dental / mental health / substance use / ...
}

export interface ClinicWithDistance extends Clinic {
  distanceMiles: number;
}

// Как хранится в SQLite (booleans как 0/1). Хелпер для маппинга.
export interface ClinicRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string | null;
  phone: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  site_type: string | null;
  accepts_uninsured: 0 | 1;
  sliding_scale: 0 | 1;
}

export function rowToClinic(r: ClinicRow): Clinic {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    county: r.county ?? undefined,
    phone: r.phone ?? undefined,
    website: r.website ?? undefined,
    latitude: r.latitude,
    longitude: r.longitude,
    siteType: r.site_type ?? undefined,
    acceptsUninsured: r.accepts_uninsured === 1,
    slidingScale: r.sliding_scale === 1,
  };
}
