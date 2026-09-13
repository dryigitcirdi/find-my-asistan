// Uygulama yonlendirme + olay baglama
import { load, db, opts, hospitalsOrdered } from './data.js';
import { settings, update } from './store.js';
import * as S from './schedule.js';
import * as UI from './ui.js';
import * as Sheet from './sheet.js';

const params = new URLSearchParams(location.search);
const BOOT_AT = performance.now();

/** Açılış ekranı: marka en az bu kadar görünsün, sonra çözülsün */
function dismissLaunch() {
  const el = document.getElementById('launch');
  if (!el || el.dataset.gone) return;
  el.dataset.gone = '1';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = reduce ? 0 : Math.max(0, 620 - (performance.now() - BOOT_AT));
  setTimeout(() => {
    el.setAttribute('data-out', '');
    setTimeout(() => { el.hidden = true; }, reduce ? 0 : 460);
  }, wait);
}

/** Bugün — ?d=YYYY-MM-DD ile test için değiştirilebilir */
function today() {
  const forced = params.get('d');
  return /^\d{4}-\d{2}-\d{2}$/.test(forced || '') ? forced : S.iso(new Date());
}

let panels = [];      // hastane sayfalari
let active = -1;      // gorunur sayfa
let timer = null;
let onDayScreen = false;

const pager = () => document.getElementById('pager');

/* ---------------- Hastane seçim ekranı ---------------- */

function goHospitals() {
  onDayScreen = false;
  stopTicking();
  // Izgaradan seçmek ana hastaneyi belirler; yana kaydırmak belirlemez.
  UI.renderHospitals(db(), today(), opts(), (id) => { update({ homeHospitalId: id }); goDay(id); },
                     hospitalsOrdered(), settings().homeHospitalId);
  UI.setTone('pick', null);
  UI.showScreen('hospitals');
}

/* ---------------- Yatay kaydırmalı hastane sayfaları ---------------- */

function goDay(hospitalId) {
  const d = db();
  const sirali = hospitalsOrdered();
  const index = Math.max(0, sirali.findIndex((h) => h.id === hospitalId));

  panels = UI.renderPager(d, today(), opts(), {
    onPerson: (rid) => Sheet.openResident(db(), rid, today(), opts()),
    onSettings: openSettings,
    onGoto: (i) => scrollToPage(i, true)
  }, sirali);

  onDayScreen = true;
  UI.showScreen('day');

  // Başlık/nokta/ton kaydırma konumuna bakmadan doğrudan ayarlanır.
  // (Yerleşim hazır değilken scrollLeft okunamıyor; buna güvenmek ekranı "—" bırakıyordu.)
  active = index;
  UI.setActivePage(panels, index, settings().homeHospitalId);
  settleScroll(index);

  bindPagerScroll();
  startTicking();
}

/** Yerleşim hazır olana kadar kaydırma konumunu ayarlamayı dener */
function settleScroll(index, tries = 0) {
  const el = pager();
  if (!el) return;
  if (!el.clientWidth) {
    if (tries < 60) requestAnimationFrame(() => settleScroll(index, tries + 1));
    return;
  }
  el.scrollTo({ left: index * el.clientWidth, behavior: 'auto' });
}

function scrollToPage(i, smooth) {
  const el = pager();
  if (!el || !el.clientWidth) return;
  el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
}

let scrollFrame = 0;
function bindPagerScroll() {
  const el = pager();
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1';
  el.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; syncActive(); });
  }, { passive: true });
  window.addEventListener('resize', () => { if (onDayScreen && active >= 0) settleScroll(active); });
}

function syncActive() {
  const el = pager();
  if (!el || !el.clientWidth) return;
  const i = Math.round(el.scrollLeft / el.clientWidth);
  if (i === active || !panels[i]) return;
  active = i;
  UI.setActivePage(panels, i, settings().homeHospitalId);
}

function openSettings() {
  Sheet.openSettings(db(), today(), () => {
    if (onDayScreen) goDay(panels[active] ? panels[active].h.id : settings().homeHospitalId);
    else goHospitals();
  });
}

/* ---- Canlı saat + "şu an" imleci ---- */
function startTicking() {
  stopTicking();
  const tick = () => {
    const wd = db().meta.workday;
    const np = UI.nowPercent(wd);
    document.querySelectorAll('.now').forEach((n) => { n.style.left = `${np.value}%`; });
    const saat = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('[data-clock]').forEach((n) => {
      n.textContent = np.inside ? saat : 'mesai dışı';
    });
  };
  tick();
  timer = setInterval(tick, 30000);
}

function stopTicking() {
  if (timer) clearInterval(timer);
  timer = null;
}

/* ---- Başlat ---- */
(async function boot() {
  try {
    await load();
  } catch (err) {
    dismissLaunch();
    document.querySelector('.shell').innerHTML =
      `<div class="card empty-state"><p class="eyebrow">Hata</p><p>${err.message}</p>
       <p style="font-size:12px;margin-top:12px">Sayfayı bir sunucu üzerinden açman gerekiyor
       (<code>node serve.js</code>), doğrudan dosya olarak değil.</p></div>`;
    return;
  }

  document.getElementById('btn-grid').addEventListener('click', goHospitals);
  document.getElementById('make-home').addEventListener('click', (e) => {
    update({ homeHospitalId: e.currentTarget.dataset.id });
    UI.setActivePage(panels, active, e.currentTarget.dataset.id);
  });
  document.getElementById('btn-settings').addEventListener('click', openSettings);

  const last = params.get('h') || settings().homeHospitalId;
  if (db().hospitals.some((h) => h.id === last)) goDay(last); else goHospitals();
  dismissLaunch();

  // Sekmeye geri dönüldüğünde tarih/saat tazelensin, konum korunsun
  let lastDate = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (today() !== lastDate) {                 // gün değişmiş
      lastDate = today();
      if (onDayScreen) goDay(panels[active] ? panels[active].h.id : settings().homeHospitalId);
      else goHospitals();
    }
  });

  // Yüklü sürümü altbilgide göster — "telefonumda hangi sürüm var?" sorusunun cevabı
  fetch(new URL('../sw.js', import.meta.url), { cache: 'no-store' })
    .then((r) => r.text())
    .then((t) => {
      const v = (t.match(/asistan-panel-v(\d+)/) || [])[1];
      if (v) document.querySelectorAll('[data-version]').forEach((n) => { n.textContent = `· sürüm ${v}`; });
    })
    .catch(() => {});

  // Çevrimdışı çalışma (yalnızca http/https üzerinden)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))
      .catch((e) => console.warn('Service worker kaydedilemedi:', e.message));
  }
})();
