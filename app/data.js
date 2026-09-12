// Veri dosyasini yukler ve kullanici duzeltmeleriyle birlestirir.
import { settings } from './store.js';

let raw = null;

export async function load() {
  if (!raw) {
    const res = await fetch(new URL('../data/schedule.json', import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Veri yüklenemedi (${res.status})`);
    raw = await res.json();
  }
  return db();
}

/** Kullanici duzeltmeleri uygulanmis veri */
export function db() {
  const s = settings();
  const assignments = { ...raw.assignments };
  for (const [month, map] of Object.entries(s.assignments || {})) {
    assignments[month] = { ...(assignments[month] || {}), ...map };
  }
  const leads = { ...raw.leads };
  for (const [month, map] of Object.entries(s.leads || {})) {
    leads[month] = { ...(leads[month] || {}), ...map };
  }
  return {
    ...raw,
    assignments,
    leads,
    meta: { ...raw.meta, workday: s.workday || raw.meta.workday }
  };
}

export const opts = () => ({ weekendShift: settings().weekendShift });

export const resident = (id) => db().residents.find((r) => r.id === id);
export const hospital = (id) => db().hospitals.find((h) => h.id === id);
