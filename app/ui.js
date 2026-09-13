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

    // Hafta sonu "beklenen mevcut" nöbetçi sayısıdır; kadronun kendisi ayrı.
    let meta;
    if (!d.kadro.length && !d.onDuty.length) meta = 'Bu ay kadro tanımlanmamış';
    else if (d.restDay && !d.onDuty.length) meta = `Hafta sonu · ${d.kadro.length} kişilik kadro`;
    else meta = `<strong>${d.present}</strong> asistan sahada` +
        (d.onDuty.length ? ` · <strong>${d.onDuty.length}</strong> nöbetçi` : '') +
        (d.kadro.length ? ` · ${d.kadro.length} kişilik kadro` : '');

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

/** Türkçe bulunma hâli eki: Maslak'ta, Atakent'te, Altunizade'de, Ataşehir'de */
function locative(name) {
  const vowels = 'aeıioöuüAEIİOÖUÜ';
  const back = 'aıouAIOU';
  const hard = 'fçhkpsştFÇHKPSŞT';
  const last = [...name].reverse().find((c) => vowels.includes(c)) || 'e';
  const ek = (back.includes(last) ? 'a' : 'e');
  const d = hard.includes(name[name.length - 1]) ? 't' : 'd';
  return `${name}'${d}${ek}`;
}

function subtitle(db, p, hospitalId) {
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
  // Kadrosu burada ama nöbeti başka hastanede
  if (p.duty && p.duty.h !== hospitalId) {
    const other = db.hospitals.find((h) => h.id === p.duty.h);
    if (other) bits.unshift(`nöbeti ${locative(other.name)}`);
  }
  if (p.rotation && p.status.id !== 'rotasyon' && p.status.id !== 'izinli') {
    bits.push(`${db.rotationNames[p.rotation.name] || p.rotation.name} rotasyonunda`);
  }
  if (p.visiting) {
    // Rotasyondaki asistanın bu ay hiçbir kadrosu yok; "kadrosu başka hastane" demek yanlış olur
    const home = db.hospitals.find((h) => h.id === p.home);
    if (home) bits.push(`kadrosu ${home.name}`);
  }
  return bits;
}

/* ---- Yarın ne olacak? Gözlemci için en kritik bilgi ---- */
function tomorrowHTML(db, residentId, date, opts, hospitalId) {
  const t = S.residentDay(db, residentId, S.addDays(date, 1), opts);
  let extra = '';
  if (t.status.id === 'nobetci') {
    const h = db.hospitals.find((x) => x.id === t.duty.h);
    extra = h && h.id !== hospitalId ? `nöbeti ${locative(h.name)}` : `${db.meta.workday.dutyLeave}’da çıkar`;
  } else if (t.status.id === 'mesaide') {
    extra = `${db.meta.workday.start} – ${t.leaveTime}`;
  } else if (t.status.id === 'nobetErtesi') {
    extra = 'izinli, gelmiyor';
  } else if (t.status.id === 'rotasyon') {
    extra = db.rotationNames[t.rotation.name] || t.rotation.name;
  }
  return `<div class="tomorrow">
    <span>Yarın</span>
    <svg class="tomorrow-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    <span class="chip" data-s="${t.status.id}">${t.status.label}</span>
    ${extra ? `<span>${esc(extra)}</span>` : ''}
  </div>`;
}

/** "Bu hafta: Çar yok · Sal ve Cum 16:00'da çıkar" */
function outlookHTML(db, residentId, date, opts, label) {
  const w = S.weekOutlook(db, residentId, date, opts);
  const liste = (arr) => arr.length === 1 ? arr[0].label
    : arr.slice(0, -1).map((x) => x.label).join(', ') + ' ve ' + arr[arr.length - 1].label;
  const mesaiGunu = w.days.filter((d) => !S.isWeekend(d)).length;
  const bits = [];
  if (w.yok.length >= mesaiGunu) {
    // Tüm hafta yoksa günleri tek tek saymak yerine sebebini yaz
    const sebep = [...new Set(w.yok.map((x) => x.why))];
    bits.push(`<b>hiç yok</b>${sebep.length === 1 ? ' · ' + sebep[0].toLocaleLowerCase('tr') : ''}`);
  } else if (w.yok.length) {
    bits.push(`<b>${liste(w.yok)}</b> yok`);
  }
  if (w.erken.length) bits.push(`<b>${liste(w.erken)}</b> ${w.erken[0].at}’da çıkar`);
  return `<p class="outlook">${label} ${bits.length ? bits.join(' · ') : '<b>tam gün</b> burada'}</p>`;
}

function personHTML(db, p, hospitalId, wd, np, date, opts, leadId) {
  const r = db.residents.find((x) => x.id === p.residentId);
  const t = leaveLabel(p);
  const subs = subtitle(db, p, hospitalId);
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
            ${subs.map((x) => `<span>${esc(x)}</span>`).join('<i class="dotsep"></i>')}
          </p>
        </span>
        ${p.status.present ? `<span class="p-time"><b>${esc(t.big)}</b><span>${esc(t.small)}</span></span>` : ''}
      </div>
      <div class="p-rail">${rail(wd, { ...p, hue: r.hue }, p.status.present, np)}</div>
      ${tomorrowHTML(db, r.id, date, opts, hospitalId)}
      ${outlookHTML(db, r.id, date, opts, 'Bu hafta')}
      ${outlookHTML(db, r.id, S.addDays(date, 7), opts, 'Gelecek hafta')}
    </button>`;
}

/** Tek bir hastanenin sayfası. HTML metni döner, DOM'a yazmaz. */
export function panelHTML(db, hospitalId, date, opts) {
  const h = db.hospitals.find((x) => x.id === hospitalId);
  const d = S.hospitalDay(db, hospitalId, date, opts);
  const wd = db.meta.workday;
  const month = S.monthKey(date);
  const leadId = (db.leads[month] || {})[hospitalId] || null;
  const np = nowPercent(wd);

  const dutyNames = d.onDuty.map((r) => db.residents.find((x) => x.id === r.residentId).short);
  // Kadrosu burada ama nöbeti başka hastanede olanlar — gözlemci için önemli
  const awayDuty = d.rows.filter((r) => r.onSiteDay && r.duty && r.duty.h !== hospitalId);
  let note;
  if (d.tone === 'empty') note = 'Bu hastane için kadro tanımlanmamış. Ayarlar’dan atama yapabilirsin.';
  else if (d.onDuty.length) note = `${dutyNames.join(', ')} nöbetçi · mesaiden ${wd.dutyLeave}’da çıkar`;
  else if (awayDuty.length) {
    const names = awayDuty.map((r) => db.residents.find((x) => x.id === r.residentId).short);
    note = `${names.join(', ')} ${wd.dutyLeave}’da çıkar · nöbeti başka hastanede`;
  }
  else if (d.restDay) note = 'Hafta sonu — rutin mesai yok.';
  else if (d.present === 0) note = 'Bugün kadrodan kimse sahada değil.';
  else if (d.present < d.expected) note = `${d.expected - d.present} kişi izinli, nöbet ertesi ya da rotasyonda.`;
  else note = 'Kadronun tamamı sahada.';

  // Tek satırlık durum şeridi — asıl içerik asistan kartları, sayaç onları itmesin
  const hero = `
    <div class="strip">
      <i class="tone-dot" data-tone="${d.tone}"></i>
      <b>${TONE_LABEL[d.tone]}</b>
      ${d.expected ? `<span class="dotsep"></span><span class="num">${d.present} / ${d.expected} sahada</span>` : ''}
      <span class="strip-clock num" data-clock>${np.inside ? '' : 'mesai dışı'}</span>
    </div>
    ${note ? `<p class="strip-note">${esc(note)}</p>` : ''}`;

  // Bu ay hiçbir hastanenin kadrosunda olmayanlar (dış rotasyon / tez dönemi)
  const assignedIds = new Set(Object.keys(db.assignments[month] || {}));
  const outside = db.residents
    .filter((r) => !assignedIds.has(r.id))
    .map((r) => {
      const rot = db.rotations.find((x) => x.r === r.id && x.month === month);
      return rot ? { r, label: db.rotationNames[rot.name] || rot.name } : null;
    })
    .filter(Boolean);
  const banner = outside.length ? `
    <p class="outside">
      <span class="eyebrow">Bu ay klinik dışında</span>
      ${outside.map((o) => `<span><b style="color:hsl(${o.r.hue}deg 70% 78%)">${esc(o.r.short)}</b> · ${esc(o.label)}</span>`).join('<i class="dotsep"></i>')}
    </p>` : '';

  const people = d.rows.length
    ? `<div class="people stagger">${d.rows.map((p) => personHTML(db, p, hospitalId, wd, np, date, opts, leadId)).join('')}</div>`
    : `<div class="card empty-state"><p class="eyebrow">Kayıt yok</p>
       <p>Bu hastanede bu tarih için kadro ya da nöbet tanımlı değil.</p></div>`;

  /* --- Haftalık barlar: bu hafta + gelecek hafta --- */
  const week = weekCardHTML(db, hospitalId, date, opts, 'Bu hafta', date, false) +
               weekCardHTML(db, hospitalId, S.addDays(date, 7), opts, 'Gelecek hafta', date, true);

  const conflicts = d.rows.filter((p) => p.conflict)
    .map((p) => `${db.residents.find((x) => x.id === p.residentId).name} · ${S.formatLongDate(p.date)} hem nöbet hem nöbet ertesi izin.`);

  const idx = db.hospitals.findIndex((x) => x.id === hospitalId);
  const prev = db.hospitals[idx - 1], next = db.hospitals[idx + 1];
  const hint = (prev || next) ? `<div class="swipe-hint">
      ${prev ? `<span>← <b>${esc(prev.name)}</b></span>` : '<span></span>'}
      ${prev && next ? '<span>·</span>' : ''}
      ${next ? `<span><b>${esc(next.name)}</b> →</span>` : '<span></span>'}
    </div>` : '';

  return {
    tone: d.tone,
    hue: h.hue,
    html: `${hero}
      ${people}
      ${banner}
      ${week}
      <details class="card notes">
        <summary><span class="eyebrow">Veri notları</span>
          <span class="notes-count">${conflicts.length + db.dataNotes.length}</span></summary>
        <ul>${[...conflicts, ...db.dataNotes].map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
      </details>
      ${hint}
      <p class="foot"><b style="color:var(--text-2);font-weight:600">Find My Asistan</b>
        <span class="ver" data-version>·</span><br>
        ${esc(db.meta.source)}<br>Mesai ${wd.start}–${wd.end} · nöbetçi çıkışı ${wd.dutyLeave}</p>`
  };
}

/** Tek bir haftanın barı. `today` bugünü işaretlemek için (gelecek haftada eşleşmez). */
function weekCardHTML(db, hospitalId, anchor, opts, label, today, showLegend) {
  const wd0 = db.meta.workday;
  // Sarı şeridin yüksekliği = çıkamadığı sürenin mesaiye oranı (08–18 / 16:00 -> %20)
  const gap = Math.round(
    ((S.toMinutes(wd0.end) - S.toMinutes(wd0.dutyLeave)) /
     (S.toMinutes(wd0.end) - S.toMinutes(wd0.start))) * 100);
  const wm = S.weekMatrix(db, hospitalId, anchor, opts);
  if (!wm.rows.length) return '';
  const bas = S.parseIso(wm.days[0]).getDate();
  return `
    <div class="section-title"><h2>${label}</h2>
      <span class="eyebrow">${bas} – ${S.formatLongDate(wm.days[6])}</span></div>
    <div class="card week">
      <div class="week-head">
        <span class="eyebrow">Asistan</span>
        <div class="week-days">
          ${wm.days.map((dd) => `<span${dd === today ? ' data-today' : ''}>${S.GUN_KISA[S.parseIso(dd).getDay()]}</span>`).join('')}
        </div>
      </div>
      ${wm.rows.map((row) => {
        const r = db.residents.find((x) => x.id === row.residentId);
        return `<div class="week-row">
          <span class="week-name" style="color:hsl(${r.hue}deg 70% 78%)">${esc(r.short)}</span>
          <div class="week-cells">
            ${row.cells.map((c, i) => {
              // Hafta içi nöbetçi: gün boyu burada, yalnızca son 2 saat yok.
              // Hafta sonu: rutin mesai yok — buradaki nöbetçi tüm gün burada,
              // nöbeti başka hastanedeyse burada hiç yok.
              let durum = c.status.id, split = false;
              if (durum === 'nobetci') {
                if (!c.weekend) split = true;
                else if (!c.dutyHere) durum = 'haftaSonu';
              }
              const ipucu = `${S.formatLongDate(c.date)} — ${c.status.label}` +
                (split ? ` · ${db.meta.workday.dutyLeave}’da çıkar` : '');
              return `<i class="cell" style="animation-delay:${i * 28}ms${split ? `;--duty-gap:${gap}%` : ''}"
                data-s="${durum}" ${split ? 'data-split' : ''}
                ${c.date === today ? 'data-today' : ''} ${c.conflict ? 'data-conflict' : ''}
                title="${esc(ipucu)}"></i>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
      ${showLegend ? `<div class="legend">
        <b><i style="background:hsl(152 55% 50% / .4)"></i>Mesaide</b>
        <b><i style="background:linear-gradient(180deg,hsl(34 92% 64%) ${gap}%,hsl(152 55% 50% / .42) ${gap}%)"></i>Nöbetçi · ${wd0.dutyLeave}’da çıkar</b>
        <b><i style="background:linear-gradient(180deg,hsl(353 82% 60%),hsl(347 78% 50%))"></i>Nöbet ertesi · yok</b>
        <b><i style="background:repeating-linear-gradient(125deg,hsl(200 60% 62% / .5) 0 4px,transparent 4px 8px)"></i>Yıllık izin</b>
        <b><i style="background:repeating-linear-gradient(125deg,rgba(255,255,255,.25) 0 3px,transparent 3px 7px)"></i>Rotasyonda</b>
      </div>` : ''}
    </div>`;
}

/** Dört hastaneyi de yan yana kurar */
export function renderPager(db, date, opts, handlers) {
  const pager = $('#pager');
  const dots = $('#dots');

  const panels = db.hospitals.map((h) => ({ h, ...panelHTML(db, h.id, date, opts) }));
  pager.innerHTML = panels.map((p, i) =>
    `<div class="page" data-id="${p.h.id}" data-i="${i}"><div class="page-inner">${p.html}</div></div>`).join('');
  dots.innerHTML = db.hospitals.map((h, i) =>
    `<button data-i="${i}" role="tab" aria-label="${esc(h.name)}"></button>`).join('');

  $('#pager-date').textContent =
    `${S.formatLongDate(date)} · ${S.GUN_UZUN[S.parseIso(date).getDay()]}`;

  pager.onclick = (e) => {
    if (e.target.closest('[data-open-settings]')) { handlers.onSettings(); return; }
    const b = e.target.closest('.person');
    if (b) handlers.onPerson(b.dataset.id);
  };
  dots.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => handlers.onGoto(Number(b.dataset.i))));

  return panels;
}

/** Görünür sayfayı işaretler: başlık, noktalar ve arka plan tonu */
export function setActivePage(panels, index, homeId) {
  const p = panels[index];
  if (!p) return;
  const head = document.getElementById('pager-name');
  head.classList.toggle('is-home', p.h.id === homeId);
  const mk = document.getElementById('make-home');
  if (mk) {
    mk.hidden = p.h.id === homeId;
    mk.textContent = `${p.h.name} ana hastanem olsun`;
    mk.dataset.id = p.h.id;
  }
  const name = head;
  if (name.textContent !== p.h.name) {
    name.textContent = p.h.name;
    name.removeAttribute('data-swap');
    void name.offsetWidth;          // animasyonu yeniden tetikle
    name.setAttribute('data-swap', '');
  }
  $('#dots').querySelectorAll('button').forEach((b, i) => {
    if (i === index) b.setAttribute('data-on', ''); else b.removeAttribute('data-on');
  });
  setTone(p.tone, p.hue);
  const page = $('#pager').querySelector(`.page[data-i="${index}"]`);
  if (page && !page.dataset.counted) {
    page.dataset.counted = '1';
    countUp(page.querySelector('[data-count]'));
  }
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
