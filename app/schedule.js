// Durum motoru — saf fonksiyonlar. DOM'a dokunmaz, test edilebilir.

export const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const GUN_UZUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const AY_UZUN = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const pad = (n) => String(n).padStart(2, '0');

/** Date -> "YYYY-MM-DD" (yerel saat, UTC kaymasi yok) */
export function iso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" -> Date (yerel gece yarisi) */
export function parseIso(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export const monthKey = (s) => s.slice(0, 7);
export const isWeekend = (s) => [0, 6].includes(parseIso(s).getDay());

/** Haftanin Pazartesi ile baslayan 7 gunu */
export function weekOf(s) {
  const d = parseIso(s);
  const shift = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - shift);
  return Array.from({ length: 7 }, (_, i) => iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)));
}

export function formatLongDate(s) {
  const d = parseIso(s);
  return `${d.getDate()} ${AY_UZUN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "16:00" -> 960 (gun icindeki dakika) */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export const STATUS = {
  nobetci:      { id: 'nobetci',      label: 'Nöbetçi',      present: true,  tone: 'duty'  },
  mesaide:      { id: 'mesaide',      label: 'Mesaide',      present: true,  tone: 'calm'  },
  nobetErtesi:  { id: 'nobetErtesi',  label: 'Nöbet ertesi', present: false, tone: 'off'   },
  izinli:       { id: 'izinli',       label: 'Yıllık izin',  present: false, tone: 'off'   },
  rotasyon:     { id: 'rotasyon',     label: 'Rotasyonda',   present: false, tone: 'away'  },
  haftaSonu:    { id: 'haftaSonu',    label: 'Hafta sonu',   present: false, tone: 'quiet' }
};

/**
 * Bir asistanin belirli bir gunku durumu.
 * Oncelik: yillik izin > nobet > nobet ertesi > dis rotasyon > hafta sonu > mesai
 */
/**
 * Nobet ertesi izni var mi?
 * Kaynak listedeki kayit esastir. Pazar nobeti tutulduysa ertesi pazartesi
 * izin kullanilir; liste bunu atlamis olabilir, o yuzden turetiliyor.
 */
export function postCallOn(db, residentId, date, opts = {}) {
  if (db.postCall.some((x) => x.d === date && x.r === residentId)) {
    return { off: true, derived: false };
  }
  const prev = addDays(date, -1);
  if (parseIso(date).getDay() === 1 && parseIso(prev).getDay() === 0 &&
      db.duties.some((x) => x.d === prev && x.r === residentId) &&
      !opts.weekendShift) {
    return { off: true, derived: true };
  }
  return { off: false, derived: false };
}

export function residentDay(db, residentId, date, opts = {}) {
  const settings = { weekendShift: false, ...opts };
  const duty = db.duties.find((x) => x.d === date && x.r === residentId) || null;
  const pc = postCallOn(db, residentId, date, settings);
  const post = pc.off;
  const leave = db.leaves.find((x) => x.r === residentId && x.from <= date && date <= x.to) || null;
  const rotation = db.rotations.find((x) => x.r === residentId && x.month === monthKey(date)) || null;
  const weekend = isWeekend(date);
  const home = (db.assignments[monthKey(date)] || {})[residentId] || null;

  // Hafta sonu, dis rotasyondan once gelir: o gun zaten kimse mesaide degil.
  let status;
  if (leave) status = STATUS.izinli;
  else if (duty) status = STATUS.nobetci;
  else if (post) status = STATUS.nobetErtesi;
  else if (weekend && !settings.weekendShift) status = STATUS.haftaSonu;
  else if (rotation) status = STATUS.rotasyon;
  else status = STATUS.mesaide;

  const wd = db.meta.workday;
  let leaveTime = null;
  if (status === STATUS.nobetci) leaveTime = wd.dutyLeave;
  else if (status === STATUS.mesaide) leaveTime = wd.end;

  return {
    residentId, date, home,
    duty, rotation, leave,
    postCall: post,
    postCallDerived: pc.derived,
    weekend,
    status,
    leaveTime,
    // Kaynak tabloda ayni gun hem nobet hem nobet ertesi izin yaziyorsa
    conflict: Boolean(duty && post),
    // Nobet ertesi izin gercekten listelenmis mi?
    nextDayOff: postCallOn(db, residentId, addDays(date, 1), settings).off
  };
}

/** Bir hastanenin o gunku tam tablosu */
export function hospitalDay(db, hospitalId, date, opts = {}) {
  const assigned = db.assignments[monthKey(date)] || {};
  const ids = new Set();
  db.residents.forEach((r) => { if (assigned[r.id] === hospitalId) ids.add(r.id); });
  db.duties.forEach((x) => { if (x.d === date && x.h === hospitalId) ids.add(x.r); });

  // Hafta sonu rutin mesai yok: o gun hastanede olan tek kisi nobetcidir.
  const restDay = isWeekend(date) && !opts.weekendShift;

  const rows = [...ids].map((id) => {
    const day = residentDay(db, id, date, opts);
    const dutyHere = Boolean(day.duty && day.duty.h === hospitalId);
    const basedHere = day.home === hospitalId;
    return {
      ...day,
      dutyHere,
      basedHere,
      // Bugun bu hastanede mi? Hafta sonu yalnizca buradaki nobetci sayilir;
      // kadrosu burada olsa da nobeti baska hastanedeyse burada degildir.
      onSiteDay: restDay ? dutyHere : (basedHere && day.status.present),
      // Sadece nobet icin bu hastaneye gelen misafir
      visiting: Boolean(dutyHere && !basedHere)
    };
  });

  const order = { nobetci: 0, mesaide: 1, nobetErtesi: 2, izinli: 3, rotasyon: 4, haftaSonu: 5 };
  rows.sort((a, b) => (order[a.status.id] - order[b.status.id]) || a.residentId.localeCompare(b.residentId));

  const kadro = rows.filter((r) => r.basedHere);
  const onSite = rows.filter((r) => r.onSiteDay);
  const onDuty = rows.filter((r) => r.dutyHere);

  // Hafta sonu beklenen mevcut = o gun nobetci olanlar
  const expected = restDay ? onDuty.length : kadro.length;

  // Ambiyans tonu: arka plan rengini bu belirler
  let tone;
  if (kadro.length === 0 && onDuty.length === 0) tone = 'empty';
  else if (onDuty.length) tone = 'duty';
  else if (restDay) tone = 'quiet';
  else if (onSite.length === 0) tone = 'critical';
  else if (onSite.length < kadro.length) tone = 'thin';
  else tone = 'calm';

  return { hospitalId, date, rows, kadro, onSite, onDuty, tone, restDay,
           expected, present: onSite.length };
}

/** Haftalik bar icin: asistan x 7 gun durum matrisi */
export function weekMatrix(db, hospitalId, date, opts = {}) {
  const days = weekOf(date);
  // Yalnizca bu hastanenin kadrosu. Nobet icin gelen misafirler baris karistiriyordu:
  // hoca kendi asistanini ariyor, baska hastanenin asistani listede olmamali.
  const ids = new Set();
  days.forEach((d) => {
    const assigned = db.assignments[monthKey(d)] || {};
    db.residents.forEach((r) => { if (assigned[r.id] === hospitalId) ids.add(r.id); });
  });

  return {
    days,
    rows: [...ids].map((id) => ({
      residentId: id,
      cells: days.map((d) => {
        const day = residentDay(db, id, d, opts);
        return { ...day, dutyHere: Boolean(day.duty && day.duty.h === hospitalId) };
      })
    }))
  };
}

/** Bir asistanin ay boyunca nobet/izin dagilimi */
export function monthSummary(db, residentId, month, opts = {}) {
  const first = parseIso(`${month}-01`);
  const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: len }, (_, i) => `${month}-${pad(i + 1)}`);
  const cells = days.map((d) => residentDay(db, residentId, d, opts));
  return {
    month, days, cells,
    dutyCount: cells.filter((c) => c.duty).length,
    offCount: cells.filter((c) => c.status.id === 'nobetErtesi').length,
    leaveCount: cells.filter((c) => c.status.id === 'izinli').length,
    byHospital: cells.reduce((acc, c) => {
      if (c.duty) acc[c.duty.h] = (acc[c.duty.h] || 0) + 1;
      return acc;
    }, {})
  };
}

/**
 * Bir asistanin haftalik ozeti — "hangi gun yok, hangi gun erken cikiyor".
 * Hafta sonlari sayilmaz: zaten rutin mesai yok.
 */
export function weekOutlook(db, residentId, date, opts = {}) {
  const days = weekOf(date);
  const yok = [], erken = [];
  for (const d of days) {
    if (isWeekend(d) && !opts.weekendShift) continue;
    const x = residentDay(db, residentId, d, opts);
    if (!x.status.present) yok.push({ d, label: GUN_KISA[parseIso(d).getDay()], why: x.status.label });
    else if (x.status.id === 'nobetci') erken.push({ d, label: GUN_KISA[parseIso(d).getDay()], at: x.leaveTime });
  }
  return { days, yok, erken, tam: yok.length === 0 && erken.length === 0 };
}
