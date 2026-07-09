// src/types/clinic.ts — модель данных клиники

export interface Clinic {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  phone?: string;
  website?: string;
  latitude: number;
  longitude: number;
  siteType?: string;
  acceptsUninsured: boolean;
  slidingScale: boolean;
  services?: string[];
  placeId?: string;
  hoursJson?: string;
}

export interface ClinicWithDistance extends Clinic {
  distanceMiles: number;
}

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
  place_id: string | null;
  hours_json: string | null;
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
    placeId: r.place_id ?? undefined,
    hoursJson: r.hours_json ?? undefined,
  };
}
