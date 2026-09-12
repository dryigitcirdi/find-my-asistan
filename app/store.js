// Kullanici tercihleri ve veri duzeltmeleri — localStorage.
const KEY = 'asistan-panel/v1';

const DEFAULTS = {
  hospitalId: null,        // son secilen hastane
  weekendShift: false,     // hafta sonu rutin mesai var mi?
  workday: null,           // { start, end, dutyLeave } — null ise veri dosyasindaki kullanilir
  assignments: {},         // { 'YYYY-MM': { residentId: hospitalId } } — kadro duzeltmeleri
  leads: {},               // { 'YYYY-MM': { hospitalId: residentId } } — asistan sorumlulari
  reducedMotion: false
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
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn(state));
  return state;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setAssignment(month, residentId, hospitalId) {
  const next = { ...state.assignments, [month]: { ...(state.assignments[month] || {}), [residentId]: hospitalId } };
  return update({ assignments: next });
}

export function setLead(month, hospitalId, residentId) {
  const next = { ...state.leads, [month]: { ...(state.leads[month] || {}), [hospitalId]: residentId } };
  return update({ leads: next });
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* yoksay */ }
  state = { ...DEFAULTS };
  listeners.forEach((fn) => fn(state));
}
