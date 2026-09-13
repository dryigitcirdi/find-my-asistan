// Veri dosyasini yukler. Kullanici duzeltmesi yok: kadro, rotasyon, nobet ve
// mesai duzeni Drive'dan geliyor ve herkes ayni veriyi gormeli.
let raw = null;

export async function load() {
  if (!raw) {
    const res = await fetch(new URL('../data/schedule.json', import.meta.url), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Veri yüklenemedi (${res.status})`);
    raw = await res.json();
  }
  return raw;
}

export const db = () => raw;
export const opts = () => ({});
export const resident = (id) => raw.residents.find((r) => r.id === id);
export const hospital = (id) => raw.hospitals.find((h) => h.id === id);
