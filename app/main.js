// Uygulama yonlendirme + olay baglama
import { load, db, opts } from './data.js';
import { settings, update } from './store.js';
import * as S from './schedule.js';
import * as UI from './ui.js';
import * as Sheet from './sheet.js';

const params = new URLSearchParams(location.search);

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
  UI.renderHospitals(db(), today(), opts(), (id) => goDay(id));
  UI.setTone('pick', null);
  UI.showScreen('hospitals');
}

/* ---------------- Yatay kaydırmalı hastane sayfaları ---------------- */

function goDay(hospitalId, keepScroll = false) {
  const d = db();
  const index = Math.max(0, d.hospitals.findIndex((h) => h.id === hospitalId));

  panels = UI.renderPager(d, today(), opts(), {
    onPerson: (rid) => Sheet.openResident(db(), rid, today(), opts()),
    onSettings: openSettings,
    onGoto: (i) => scrollToPage(i, true)
  }, { kadroUnconfirmed: !settings().kadroConfirmed });

  onDayScreen = true;
  UI.showScreen('day');

  // Kaydırma konumu yerleşim hazır olduktan sonra ayarlanmalı
  requestAnimationFrame(() => {
    scrollToPage(index, false);
    active = -1;
    syncActive();
  });

  bindPagerScroll();
  startTicking();
}

function scrollToPage(i, smooth) {
  const el = pager();
  if (!el) return;
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
  window.addEventListener('resize', () => { if (onDayScreen && active >= 0) scrollToPage(active, false); });
}

function syncActive() {
  const el = pager();
  if (!el || !el.clientWidth) return;
  const i = Math.round(el.scrollLeft / el.clientWidth);
  if (i === active || !panels[i]) return;
  active = i;
  UI.setActivePage(panels, i);
  update({ hospitalId: panels[i].h.id });
}

function openSettings() {
  Sheet.openSettings(db(), today(), () => {
    if (onDayScreen) goDay(panels[active] ? panels[active].h.id : settings().hospitalId);
    else goHospitals();
  });
}

/* ---- Canlı saat + "şu an" imleci ---- */
function startTicking() {
  stopTicking();
  timer = setInterval(() => {
    const wd = db().meta.workday;
    const np = UI.nowPercent(wd);
    document.querySelectorAll('.now').forEach((n) => { n.style.left = `${np.value}%`; });
  }, 30000);
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
    document.querySelector('.shell').innerHTML =
      `<div class="card empty-state"><p class="eyebrow">Hata</p><p>${err.message}</p>
       <p style="font-size:12px;margin-top:12px">Sayfayı bir sunucu üzerinden açman gerekiyor
       (<code>node serve.js</code>), doğrudan dosya olarak değil.</p></div>`;
    return;
  }

  document.getElementById('btn-grid').addEventListener('click', goHospitals);
  document.getElementById('btn-settings').addEventListener('click', openSettings);

  const last = params.get('h') || settings().hospitalId;
  if (db().hospitals.some((h) => h.id === last)) goDay(last); else goHospitals();

  // Sekmeye geri dönüldüğünde tarih/saat tazelensin, konum korunsun
  let lastDate = today();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (today() !== lastDate) {                 // gün değişmiş
      lastDate = today();
      if (onDayScreen) goDay(panels[active] ? panels[active].h.id : settings().hospitalId);
      else goHospitals();
    }
  });

  // Çevrimdışı çalışma (yalnızca http/https üzerinden)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))
      .catch((e) => console.warn('Service worker kaydedilemedi:', e.message));
  }
})();
