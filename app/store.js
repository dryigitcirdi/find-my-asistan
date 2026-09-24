// Kullanici tercihi — yalnizca ana hastane.
// Mesai saatleri, kadro ve rotasyon Drive'dan okunuyor; uygulamadan degistirilmiyor.
// (Degistirilebilse bile localStorage'da kalirdi, yani yalnizca o telefonu etkilerdi.)
const KEY = 'asistan-panel/v1';

const DEFAULTS = {
  homeHospitalId: null,
  kullanan: null        // paneli kullanan kişinin adı — kim kullanıyor görünürlüğü için
};

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

let state = read();
const listeners = new Set();

export const settings = () => state;

export function update(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* gizli sekme */ }
  listeners.forEach((fn) => fn(state));
  return state;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
