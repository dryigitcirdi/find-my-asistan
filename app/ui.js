// Render katmani — DOM uretir, is mantigi schedule.js'te.
import * as S from './schedule.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TONE_LABEL = {
  calm: 'Kadro tam', duty: 'Nöbet günü', thin: 'Eksik kadro',
  critical: 'Sahada kimse yok', quiet: 'Sakin gün', empty: 'Kadro tanımsız'
};

/** Arka plan tonunu ve iOS durum cubugu rengini ayarlar */
export function setTone(tone, hue) {
  document.documentElement.dataset.tone = tone;
  if (hue != null) document.documentElement.style.setProperty('--hh', hue);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', tone === 'critical' ? '#150406' : '#05060a');
}

/* ============================ Hastane seçimi ============================ */

export function renderHospitals(db, today, opts, onPick) {
  $('#org-line').textContent = db.meta.org;
  $('#pick-date').textContent =
    `${S.formatLongDate(today)} · ${S.GUN_UZUN[S.parseIso(today).getDay()]}`;
  $('#pick-foot').innerHTML =
    `Kaynak: ${esc(db.meta.source)}<br>Veri ${esc(db.meta.coverage.join(' – '))} dönemini kapsıyor.`;

  const week = S.weekOf(today);
  const grid = $('#hospital-grid');
  grid.innerHTML = db.hospitals.map((h) => {
    const d = S.hospitalDay(db, h.id, today, opts);
    const bars = week.map((day) => {
      const hd = S.hospitalDay(db, h.id, day, opts);
      const lvl = hd.expected === 0 ? 0
        : hd.present >= hd.expected ? 3 : hd.present > 0 ? 2 : hd.onDuty.length ? 1 : 0;
      return `<i data-h="${lvl}"${hd.onDuty.length ? ' data-duty' : ''}${day === today ? ' data-today' : ''}></i>`;
    }).join('');

    const meta = d.expected === 0 && !d.onDuty.length
      ? 'Bu ay kadro tanımlanmamış'
      : `<strong>${d.present}</strong> asistan sahada` +
        (d.onDuty.length ? ` · <strong>${d.onDuty.length}</strong> nöbetçi` : '') +
        (d.expected ? ` · ${d.expected} kişilik kadro` : '');

    return `
      <button class="hospital-card" data-id="${h.id}" style="--hh:${h.hue}">
        <div class="hc-top">
          <h2 class="hc-name">${esc(h.name)}</h2>
          <span class="hc-code">${esc(h.short)}</span>
        </div>
        <p class="hc-meta">${meta}</p>
        <div class="hc-week" aria-hidden="true">${bars}</div>
        <div class="hc-foot">
          <span class="tone-pill"><i class="tone-dot" data-tone="${d.tone}"></i>${TONE_LABEL[d.tone]}</span>
          <span class="chev">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </span>
        </div>
      </button>`;
  }).join('');

  grid.querySelectorAll('.hospital-card').forEach((card) => {
    card.addEventListener('click', () => onPick(card.dataset.id));
    attachTilt(card);
  });
}

/** İmleci takip eden 3B eğim — sadece hassas işaretçide */
function attachTilt(card) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let frame = 0;
  card.addEventListener('pointermove', (e) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.style.transform =
        `perspective(900px) rotateX(${(0.5 - py) * 5}deg) rotateY(${(px - 0.5) * 6}deg) translateZ(0) scale(1.012)`;
    });
  });
  card.addEventListener('pointerleave', () => { card.style.transform = ''; });
}

/* ============================ Gün ekranı ============================ */

const pct = (mins, wd) => {
  const a = S.toMinutes(wd.start), b = S.toMinutes(wd.end);
  return Math.max(0, Math.min(100, ((mins - a) / (b - a)) * 100));
};

export function nowPercent(wd, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const a = S.toMinutes(wd.start), b = S.toMinutes(wd.end);
  if (mins < a) return { inside: false, value: 0 };
  if (mins > b) return { inside: false, value: 100 };
  return { inside: true, value: pct(mins, wd) };
}

function rail(wd, person, showNow, nowPos) {
  const end = person.leaveTime ? pct(S.toMinutes(person.leaveTime), wd) : 0;
  const parts = [];
  if (end > 0) parts.push(`<div class="track-fill" style="width:${end}%"></div>`);
  if (person.duty) parts.push(`<div class="track-duty" style="left:${end}%;right:0"></div>`);
  if (showNow && nowPos.inside) {
    parts.push(`<div class="now${nowPos.inside ? ' now--pulse' : ''}" style="left:${nowPos.value}%"></div>`);
  }
  return `<div class="track" style="--rh:${person.hue}">${parts.join('')}</div>`;
}

function leaveLabel(p) {
  if (p.status.id === 'nobetci') return { big: p.leaveTime, small: 'çıkış' };
  if (p.status.id === 'mesaide') return { big: p.leaveTime, small: 'çıkış' };
  if (p.status.id === 'nobetErtesi') return { big: '—', small: 'izinli' };
  if (p.status.id === 'izinli') return { big: '—', small: 'izinde' };
  if (p.status.id === 'rotasyon') return { big: '—', small: 'dışarıda' };
  return { big: '—', small: 'yok' };
}

function subtitle(db, p) {
  const bits = [];
  if (p.status.id === 'nobetci') {
    bits.push(`${p.leaveTime}'da çıkar`);
    if (p.nextDayOff) bits.push('yarın izinli');
    else bits.push('ertesi gün izni yok');
  } else if (p.status.id === 'mesaide') {
    bits.push(`${db.meta.workday.start} – ${p.leaveTime}`);
  } else if (p.status.id === 'nobetErtesi') {
    bits.push('dün nöbet tuttu');
  } else if (p.status.id === 'izinli') {
    bits.push(`${S.formatLongDate(p.leave.from)} – ${S.formatLongDate(p.leave.to)}`);
  } else if (p.status.id === 'rotasyon') {
    bits.push(`${db.rotationNames[p.rotation.name] || p.rotation.name} rotasyonunda`);
  }
  if (p.rotation && p.status.id !== 'rotasyon' && p.status.id !== 'izinli') {
    bits.push(`${db.rotationNames[p.rotation.name] || p.rotation.name} rotasyonunda`);
  }
  if (p.visiting) {
    const home = db.hospitals.find((h) => h.id === p.home);
    bits.push(`kadrosu ${home ? home.name : 'başka hastane'}`);
  }
  return bits;
}

export function renderDay(db, hospitalId, date, opts, handlers) {
  const h = db.hospitals.find((x) => x.id === hospitalId);
  const d = S.hospitalDay(db, hospitalId, date, opts);
  const wd = db.meta.workday;
  const month = S.monthKey(date);
  const leadId = (db.leads[month] || {})[hospitalId] || null;

  setTone(d.tone, h.hue);

  $('#day-date').textContent =
    `${S.formatLongDate(date)} · ${S.GUN_UZUN[S.parseIso(date).getDay()]}`;
  $('#day-hospital').textContent = h.name;

  /* --- Hero --- */
  const np = nowPercent(wd);
  const dutyNames = d.onDuty.map((r) => db.residents.find((x) => x.id === r.residentId).short);
  let note;
  if (d.tone === 'empty') note = 'Bu hastane için kadro tanımlanmamış. Ayarlar’dan atama yapabilirsin.';
  else if (d.onDuty.length) note = `${dutyNames.join(', ')} nöbetçi · mesaiden ${wd.dutyLeave}’da çıkar`;
  else if (d.restDay) note = 'Hafta sonu — rutin mesai yok.';
  else if (d.present === 0) note = 'Bugün kadrodan kimse sahada değil.';
  else if (d.present < d.expected) note = `${d.expected - d.present} kişi izinli, nöbet ertesi ya da rotasyonda.`;
  else note = 'Kadronun tamamı sahada.';

  $('#hero').innerHTML = `
    <div class="hero-head">
      <div>
        <p class="eyebrow">Şu an sahada</p>
        <div class="hero-count">
          <b class="num" data-count="${d.present}">0</b>
          <span>/ ${d.expected}</span>
        </div>
      </div>
      <span class="hero-badge">${TONE_LABEL[d.tone]}</span>
    </div>
    <p class="hero-note">${esc(note)}</p>
    <div class="daybar">
      <div class="daybar-scale"><span>${wd.start}</span><span>12:00</span><span>${wd.dutyLeave}</span><span>${wd.end}</span></div>
      <div class="track">
        ${np.inside ? `<div class="track-fill" style="width:${np.value}%"></div>
                       <div class="now now--pulse" style="left:${np.value}%"></div>` : ''}
      </div>
      ${np.inside ? '' : '<p class="hero-note" style="margin-top:9px;font-size:12.5px">Mesai dışı</p>'}
    </div>`;
  countUp($('#hero').querySelector('[data-count]'));

  /* --- Kişiler --- */
  $('#people-count').textContent = d.rows.length ? `${d.rows.length} kişi` : '';
  const people = $('#people');
  if (!d.rows.length) {
    people.innerHTML = `<div class="card empty-state">
      <p class="eyebrow">Kayıt yok</p>
      <p>Bu hastanede bu tarih için kadro ya da nöbet tanımlı değil.</p></div>`;
  } else {
    people.className = 'people stagger';
    people.innerHTML = d.rows.map((p) => {
      const r = db.residents.find((x) => x.id === p.residentId);
      const person = { ...p, hue: r.hue };
      const t = leaveLabel(p);
      const subs = subtitle(db, p);
      return `
        <button class="person" data-id="${r.id}" style="--rh:${r.hue}"${p.status.present ? '' : ' data-dim'}>
          <div class="p-row">
            <span class="mono">${esc(r.initials)}</span>
            <span class="p-main">
              <p class="p-name">${esc(r.name)}</p>
              <p class="p-sub">
                <span class="chip" data-s="${p.status.id}">${p.status.label}</span>
                ${leadId === r.id ? '<span class="chip" data-lead>Sorumlu</span>' : ''}
                ${p.conflict ? '<span class="chip" data-warn>Veri çakışması</span>' : ''}
                ${subs.map((s) => `<span>${esc(s)}</span>`).join('<i class="dotsep"></i>')}
              </p>
            </span>
            ${p.status.present ? `<span class="p-time">
              <b>${esc(t.big)}</b>
              <span>${esc(t.small)}</span>
            </span>` : ''}
          </div>
          <div class="p-rail">${rail(wd, person, p.status.present, np)}</div>
        </button>`;
    }).join('');
    people.querySelectorAll('.person').forEach((b) =>
      b.addEventListener('click', () => handlers.onPerson(b.dataset.id)));
  }

  /* --- Haftalık bar --- */
  const wm = S.weekMatrix(db, hospitalId, date, opts);
  $('#week-range').textContent =
    `${S.parseIso(wm.days[0]).getDate()} – ${S.formatLongDate(wm.days[6])}`;
  $('#week').innerHTML = `
    <div class="week-head">
      <span class="eyebrow">Asistan</span>
      <div class="week-days">
        ${wm.days.map((dd) => `<span${dd === date ? ' data-today' : ''}>${S.GUN_KISA[S.parseIso(dd).getDay()]}</span>`).join('')}
      </div>
    </div>
    ${wm.rows.map((row) => {
      const r = db.residents.find((x) => x.id === row.residentId);
      return `<div class="week-row">
        <span class="week-name" style="color:hsl(${r.hue}deg 70% 78%)">${esc(r.short)}</span>
        <div class="week-cells">
          ${row.cells.map((c, i) => `<i class="cell" style="animation-delay:${i * 28}ms"
              data-s="${c.status.id}"
              ${c.duty && !c.dutyHere ? 'data-away' : ''}
              ${c.date === date ? 'data-today' : ''}
              ${c.conflict ? 'data-conflict' : ''}
              title="${esc(S.formatLongDate(c.date))} — ${esc(c.status.label)}"></i>`).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="legend">
      <b><i style="background:linear-gradient(180deg,hsl(34 92% 62%),hsl(24 88% 54%))"></i>Nöbetçi</b>
      <b><i style="background:hsl(34 92% 62% / .2);box-shadow:inset 0 0 0 1.5px hsl(34 92% 62% / .7)"></i>Başka hastanede nöbet</b>
      <b><i style="background:hsl(152 55% 50% / .4)"></i>Mesaide</b>
      <b><i style="background:hsl(268 70% 60% / .4)"></i>Nöbet ertesi</b>
      <b><i style="background:repeating-linear-gradient(125deg,hsl(200 60% 62% / .5) 0 4px,transparent 4px 8px)"></i>Yıllık izin</b>
      <b><i style="background:repeating-linear-gradient(125deg,rgba(255,255,255,.25) 0 3px,transparent 3px 7px)"></i>Rotasyonda</b>
    </div>`;

  /* --- Notlar --- */
  const conflicts = d.rows.filter((p) => p.conflict)
    .map((p) => `${db.residents.find((x) => x.id === p.residentId).name} · ${S.formatLongDate(p.date)} hem nöbet hem nöbet ertesi izin.`);
  $('#notes').innerHTML = `
    <p class="eyebrow">Veri notları</p>
    <ul>${[...conflicts, ...db.dataNotes].map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
  $('#day-foot').innerHTML =
    `${esc(db.meta.source)}<br>Mesai ${wd.start}–${wd.end} · nöbetçi çıkışı ${wd.dutyLeave}`;
}

/** Sayı sayaç animasyonu */
function countUp(node) {
  if (!node) return;
  const target = Number(node.dataset.count);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || target === 0) {
    node.textContent = target; return;
  }
  const t0 = performance.now(), dur = 780;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    node.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => {
    if (s.dataset.screen === name) s.setAttribute('data-active', '');
    else s.removeAttribute('data-active');
  });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
