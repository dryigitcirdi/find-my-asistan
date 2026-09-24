// Uygulama yonlendirme + olay baglama
import { load, db, opts, hospitalsOrdered } from './data.js';
import { settings, update } from './store.js';
import * as S from './schedule.js';
import * as UI from './ui.js';
import * as Sheet from './sheet.js';
import { KULLANIM_KAYDI } from './config.js';

const params = new URLSearchParams(location.search);
const BOOT_AT = performance.now();
let surumNo = '';

// Emniyet: bir şey ters giderse açılış ekranı ekranı kilitlemesin
setTimeout(() => {
  const el = document.getElementById('launch');
  if (el && !el.hidden) { el.setAttribute('data-out', ''); el.hidden = true; }
}, 4000);

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

/* ---------------- Kim kullanıyor ---------------- */

/**
 * Kullanım kaydı — kısıtlama değil görünürlük.
 * Yanıtı okumaya gerek yok (no-cors), servis kapalıysa panel etkilenmez.
 */
function kullanimBildir() {
  const ad = (settings().kullanan || '').trim();
  if (!ad || !KULLANIM_KAYDI) return;
  // Aynı açılışta bir kez, ayrıca saatte birden sık gönderme
  const anahtar = 'asistan-panel/son-bildirim';
  try {
    const son = Number(localStorage.getItem(anahtar) || 0);
    if (Date.now() - son < 60 * 60 * 1000) return;
    localStorage.setItem(anahtar, String(Date.now()));
  } catch { /* gizli sekme: yine de gönder */ }

  const h = db().hospitals.find((x) => x.id === settings().homeHospitalId);
  const govde = JSON.stringify({
    ad,
    hastane: h ? h.name : '',
    surum: surumNo || '',
    cihaz: navigator.platform || ''
  });
  fetch(KULLANIM_KAYDI, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: govde,
    keepalive: true
  }).catch(() => { /* kayıt tutulamadıysa sessizce geç */ });
}

/** İsim sorulmadıysa önce onu sor; kaydedince devam et */
function isimSor(devam) {
  UI.showScreen('who');
  const form = document.getElementById('who-form');
  const alan = document.getElementById('who-name');
  if (!form || !alan) { devam(); return; }
  form.onsubmit = (e) => {
    e.preventDefault();
    const ad = alan.value.trim().replace(/\s+/g, ' ');
    if (ad.length < 2) { alan.focus(); return; }
    update({ kullanan: ad });
    devam();
    kullanimBildir();
  };
  setTimeout(() => { try { alan.focus(); } catch { /* yoksay */ } }, 500);
}

/* ---------------- Hastane seçim ekranı ---------------- */

function goHospitals() {
  onDayScreen = false;
  stopTicking();
  // Ana hastane yalnızca ilk açılışta burada belirlenir; sonrasında Ayarlar'dan.
  // Izgaraya sonradan girmek sadece o hastaneye bakmak demek, seçimi değiştirmez.
  UI.renderHospitals(db(), today(), opts(), (id) => {
    if (!settings().homeHospitalId) update({ homeHospitalId: id });
    goDay(id);
  }, hospitalsOrdered(), settings().homeHospitalId);
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
  UI.setActivePage(panels, index);
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
  UI.setActivePage(panels, i);
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
/**
 * Açılış çökerse bir kez kendini onar: önbelleği boşalt, service worker'ı kaldır,
 * yeniden yükle. Eski kabuk dosyalarıyla yeni kodun karışması (HTML eski, JS yeni)
 * uygulamayı açılış ekranında kilitliyordu. İkinci denemede de olursa hatayı göster.
 */
async function kendiniOnar(err) {
  const anahtar = 'asistan-panel/onarildi';
  let denendi = false;
  try { denendi = sessionStorage.getItem(anahtar) === '1'; } catch { /* gizli sekme */ }

  if (!denendi) {
    try { sessionStorage.setItem(anahtar, '1'); } catch { /* yoksay */ }
    try {
      for (const k of await caches.keys()) await caches.delete(k);
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch { /* desteklenmiyorsa yoksay */ }
    location.reload();
    return;
  }

  dismissLaunch();
  const shell = document.querySelector('.shell');
  if (shell) {
    shell.innerHTML = `<div class="card empty-state">
      <p class="eyebrow">Açılamadı</p>
      <p>${(err && err.message) || 'Bilinmeyen hata'}</p>
      <p style="font-size:12px;margin-top:12px;color:var(--text-3)">
        İnternet bağlantını kontrol edip tekrar dene. Sürerse uygulamayı tamamen kapatıp aç.
      </p></div>`;
  }
  document.querySelectorAll('.screen').forEach((x) => x.removeAttribute('data-active'));
  const picker = document.querySelector('[data-screen="hospitals"]');
  if (picker) picker.setAttribute('data-active', '');
}

(async function boot() {
  try {
    await load();

    // Öğe yoksa sessizce geç: önbellekte eski bir index.html kalmışsa
    // tek bir eksik düğme tüm uygulamayı düşürmemeli.
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('btn-grid', goHospitals);
    on('btn-grid-2', goHospitals);
    on('btn-settings', openSettings);

    const ac = () => {
      const last = params.get('h') || settings().homeHospitalId;
      if (db().hospitals.some((h) => h.id === last)) goDay(last); else goHospitals();
    };
    if (settings().kullanan) { ac(); kullanimBildir(); } else { isimSor(ac); }
  } catch (err) {
    await kendiniOnar(err);
    return;
  }
  dismissLaunch();
  try { sessionStorage.removeItem('asistan-panel/onarildi'); } catch { /* yoksay */ }

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
      if (v) {
        surumNo = v;
        document.querySelectorAll('[data-version]').forEach((n) => { n.textContent = `· sürüm ${v}`; });
      }
    })
    .catch(() => {});

  // Çevrimdışı çalışma (yalnızca http/https üzerinden)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))
      .catch((e) => console.warn('Service worker kaydedilemedi:', e.message));
  }
})();
