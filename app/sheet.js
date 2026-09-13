// Alt sayfa (bottom sheet) — asistan detayi ve ayarlar.
import * as S from './schedule.js';
import { settings, update, setAssignment, setLead, reset } from './store.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Kaynak tablodaki kural: "HERKES 5 NÖBET TUTACAK, MAKSİMUM 8 NÖBET OLACAK"
const DUTY_MAX = 8;

let root = null;
let onCloseCb = null;

function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'sheet-root';
  root.innerHTML = '<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"></div>';
  document.body.appendChild(root);
  root.querySelector('.sheet-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return root;
}

function open(html, onClose) {
  const r = ensureRoot();
  onCloseCb = onClose || null;
  r.querySelector('.sheet').innerHTML = `<div class="sheet-grab"></div>${html}`;
  r.setAttribute('data-open', '');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => requestAnimationFrame(() => r.setAttribute('data-in', '')));
  const btn = r.querySelector('.sheet-close');
  if (btn) btn.addEventListener('click', close);
  return r.querySelector('.sheet');
}

export function close() {
  if (!root || !root.hasAttribute('data-open')) return;
  root.removeAttribute('data-in');
  document.body.style.overflow = '';
  setTimeout(() => {
    root.removeAttribute('data-open');
    if (onCloseCb) { const f = onCloseCb; onCloseCb = null; f(); }
  }, 420);
}

const closeBtn = `<button class="sheet-close" aria-label="Kapat">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;

/* ===================== Asistan detayı ===================== */

export function openResident(db, residentId, date, opts) {
  const r = db.residents.find((x) => x.id === residentId);
  const month = S.monthKey(date);
  const sum = S.monthSummary(db, residentId, month, opts);
  const rot = db.rotations.find((x) => x.r === residentId && x.month === month);
  const home = db.hospitals.find((h) => h.id === (db.assignments[month] || {})[residentId]);

  // Ayın 1'i haftanın hangi gününe denk geliyor (Pazartesi = 0)
  const offset = (S.parseIso(`${month}-01`).getDay() + 6) % 7;
  const total = Object.values(sum.byHospital).reduce((a, b) => a + b, 0);

  const split = db.hospitals
    .filter((h) => sum.byHospital[h.id])
    .map((h) => ({ h, n: sum.byHospital[h.id] }));

  open(`
    <div class="sheet-head">
      <span class="mono" style="--rh:${r.hue}">${esc(r.initials)}</span>
      <div style="min-width:0">
        <h2>${esc(r.name)}</h2>
        <p class="p-sub" style="margin-top:3px">
          ${home ? `<span>${esc(home.name)} kadrosu</span>` : '<span>Kadro atanmamış</span>'}
          ${rot ? `<i class="dotsep"></i><span>${esc(db.rotationNames[rot.name] || rot.name)} rotasyonu</span>` : ''}
        </p>
      </div>
      ${closeBtn}
    </div>

    ${sum.dutyCount > DUTY_MAX ? `<p class="p-sub" style="margin:-6px 0 14px">
      <span class="chip" data-warn>Kural dışı</span>
      <span>Kaynak tabloda “maksimum ${DUTY_MAX} nöbet” yazıyor, bu ay ${sum.dutyCount} nöbet görünüyor.</span>
    </p>` : ''}

    <div class="stat-row">
      <div class="stat"><b class="num">${sum.dutyCount}</b><span>Nöbet</span></div>
      <div class="stat"><b class="num">${sum.offCount}</b><span>Nöbet ertesi</span></div>
      <div class="stat"><b class="num">${sum.leaveCount}</b><span>İzin günü</span></div>
    </div>

    ${total ? `
      <p class="eyebrow">Nöbet dağılımı</p>
      <div class="split">
        ${split.map(({ h, n }) =>
          `<i style="flex:${n};background:hsl(${h.hue}deg 78% 58%)"></i>`).join('')}
      </div>
      <div class="split-key">
        ${split.map(({ h, n }) =>
          `<b><em style="background:hsl(${h.hue}deg 78% 58%)"></em>${esc(h.name)} · ${n}</b>`).join('')}
      </div>` : ''}

    <p class="eyebrow" style="margin-top:24px">${esc(S.AY_UZUN[Number(month.slice(5)) - 1])} ${month.slice(0, 4)}</p>
    <div class="cal">
      ${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => `<span class="cal-h">${d}</span>`).join('')}
      ${Array.from({ length: offset }, () => '<span></span>').join('')}
      ${sum.cells.map((c, i) => {
        const dh = c.duty && db.hospitals.find((h) => h.id === c.duty.h);
        const tint = dh
          ? `;background:linear-gradient(180deg,hsl(${dh.hue}deg 80% 60%),hsl(${dh.hue}deg 82% 48%));color:#fff`
          : '';
        const tip = `${S.formatLongDate(c.date)} — ${c.status.label}${dh ? ' · ' + dh.name : ''}`;
        return `<span class="cal-d" style="animation-delay:${i * 12}ms${tint}"
          data-s="${c.status.id}" ${c.date === date ? 'data-today' : ''}
          title="${esc(tip)}">${Number(c.date.slice(8))}</span>`;
      }).join('')}
    </div>
  `);
}

/* ===================== Ayarlar ===================== */

export function openSettings(db, date, onSaved) {
  const s = settings();
  const month = S.monthKey(date);
  const wd = db.meta.workday;
  const assigned = db.assignments[month] || {};
  const leads = db.leads[month] || {};

  open(`
    <div class="sheet-head">
      <div><h2>Ayarlar</h2>
        <p class="p-sub" style="margin-top:3px"><span>${esc(S.AY_UZUN[Number(month.slice(5)) - 1])} ${month.slice(0, 4)} dönemi</span></p>
      </div>
      ${closeBtn}
    </div>

    <div class="set">
      <p class="eyebrow">Ana hastane <span style="text-transform:none;letter-spacing:0">— uygulama hep burada açılır</span></p>
      <div class="set-row">
        <label>Ana hastanem</label>
        <select data-home>
          ${db.hospitals.map((h) =>
            `<option value="${h.id}"${s.homeHospitalId === h.id ? ' selected' : ''}>${esc(h.name)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="set">
      <p class="eyebrow">Mesai düzeni</p>
      <div class="set-row"><label>Mesai başlangıcı</label>
        <input type="time" data-wd="start" value="${wd.start}"></div>
      <div class="set-row"><label>Mesai bitişi</label>
        <input type="time" data-wd="end" value="${wd.end}"></div>
      <div class="set-row"><label>Nöbetçi çıkış saati<small>Nöbet tutacak asistanın gündüz çıkışı</small></label>
        <input type="time" data-wd="dutyLeave" value="${wd.dutyLeave}"></div>
      <div class="set-row"><label>Hafta sonu rutin mesai<small>Kapalıyken cumartesi–pazar yalnızca nöbet görünür</small></label>
        <button class="toggle" role="switch" id="tg-weekend" aria-checked="${s.weekendShift}"></button></div>
    </div>

    <div class="set">
      <p class="eyebrow">Kadro <span style="text-transform:none;letter-spacing:0">— rotasyon takviminden okunuyor, gerekirse değiştir</span></p>
      ${db.residents.map((r) => `
        <div class="set-row">
          <label>${esc(r.name)}</label>
          <select data-assign="${r.id}">
            <option value="">—</option>
            ${db.hospitals.map((h) =>
              `<option value="${h.id}"${assigned[r.id] === h.id ? ' selected' : ''}>${esc(h.name)}</option>`).join('')}
          </select>
        </div>`).join('')}
    </div>

    <div class="set">
      <p class="eyebrow">Asistan sorumluları <span style="text-transform:none;letter-spacing:0">(isteğe bağlı)</span></p>
      ${db.hospitals.map((h) => `
        <div class="set-row">
          <label>${esc(h.name)}</label>
          <select data-lead="${h.id}">
            <option value="">—</option>
            ${db.residents.map((r) =>
              `<option value="${r.id}"${leads[h.id] === r.id ? ' selected' : ''}>${esc(r.short)}</option>`).join('')}
          </select>
        </div>`).join('')}
    </div>

    <button class="btn-ghost" id="btn-reset">Tüm düzenlemeleri sıfırla</button>
  `, onSaved);

  const sheet = root.querySelector('.sheet');

  const homeSel = sheet.querySelector('[data-home]');
  if (homeSel) homeSel.addEventListener('change', () => update({ homeHospitalId: homeSel.value }));

  sheet.querySelectorAll('[data-wd]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const next = { ...(settings().workday || db.meta.workday), [inp.dataset.wd]: inp.value };
      update({ workday: next });
    });
  });

  const tg = sheet.querySelector('#tg-weekend');
  tg.addEventListener('click', () => {
    const on = tg.getAttribute('aria-checked') !== 'true';
    tg.setAttribute('aria-checked', String(on));
    update({ weekendShift: on });
  });

  sheet.querySelectorAll('[data-assign]').forEach((sel) => {
    sel.addEventListener('change', () => setAssignment(month, sel.dataset.assign, sel.value || null));
  });
  sheet.querySelectorAll('[data-lead]').forEach((sel) => {
    sel.addEventListener('change', () => setLead(month, sel.dataset.lead, sel.value || null));
  });

  sheet.querySelector('#btn-reset').addEventListener('click', () => {
    if (confirm('Mesai saatleri, kadro atamaları ve sorumlu seçimleri sıfırlansın mı?')) {
      reset();
      close();
    }
  });
}
