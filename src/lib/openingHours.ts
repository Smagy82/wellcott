// TODO: uses device local time — clinics in a different time zone will show incorrect status.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

type DaySlot = { opens: number; closes: number };
type WeekMap = Partial<Record<string, DaySlot | 'closed' | '24h'>>;

function parseTime12(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3].toUpperCase();
  if (mer === 'AM') { if (h === 12) h = 0; }
  else              { if (h !== 12) h += 12; }
  return h * 60 + min;
}

function minutesToAmPm(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const mer = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${dh} ${mer}`
    : `${dh}:${m.toString().padStart(2, '0')} ${mer}`;
}

function buildWeekMap(entries: string[]): WeekMap {
  const map: WeekMap = {};
  for (const entry of entries) {
    const colon = entry.indexOf(':');
    if (colon === -1) continue;
    const day = entry.slice(0, colon).trim();
    if (!(DAYS as readonly string[]).includes(day)) continue;
    const rest = entry.slice(colon + 1).trim();
    const lower = rest.toLowerCase();
    if (lower === 'closed') { map[day] = 'closed'; continue; }
    if (lower === 'open 24 hours') { map[day] = '24h'; continue; }
    // EN DASH (U+2013) separates open–close times
    const dash = rest.indexOf('–');
    if (dash === -1) continue;
    const opens = parseTime12(rest.slice(0, dash));
    const closes = parseTime12(rest.slice(dash + 1));
    if (opens === null || closes === null) continue;
    map[day] = { opens, closes };
  }
  return map;
}

function nextOpenTime(map: WeekMap, startDayIdx: number): string | undefined {
  for (let i = 0; i < 7; i++) {
    const name = DAYS[(startDayIdx + i) % 7];
    const slot = map[name];
    if (slot === '24h') return undefined; // always open — no specific time to show
    if (slot && slot !== 'closed') return minutesToAmPm(slot.opens);
  }
  return undefined;
}

export interface OpenStatus {
  open: boolean;
  nextChange?: string; // human-readable e.g. "8:30 AM" — opening time when closed
}

export function isOpenNow(
  hoursJson: string | null | undefined,
  now: Date = new Date(),
): OpenStatus | null {
  if (!hoursJson) return null;
  let arr: unknown;
  try { arr = JSON.parse(hoursJson); } catch { return null; }
  if (!Array.isArray(arr) || arr.length === 0) return null;

  const map = buildWeekMap(arr as string[]);
  if (Object.keys(map).length === 0) return null;

  const dayIdx = now.getDay(); // 0 = Sunday
  const cur = now.getHours() * 60 + now.getMinutes();
  const dayName = DAYS[dayIdx];
  const today = map[dayName];

  if (today === undefined) return null; // day not present — don't guess

  if (today === '24h') return { open: true };

  if (today === 'closed') {
    return { open: false, nextChange: nextOpenTime(map, (dayIdx + 1) % 7) };
  }

  if (cur >= today.opens && cur < today.closes) {
    return { open: true };
  }
  if (cur < today.opens) {
    return { open: false, nextChange: minutesToAmPm(today.opens) };
  }
  // After today's closing — find next opening day
  return { open: false, nextChange: nextOpenTime(map, (dayIdx + 1) % 7) };
}
