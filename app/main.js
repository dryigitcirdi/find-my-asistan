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

let current = null;   // secili hastane
let timer = null;

function goHospitals() {
  current = null;
  update({ hospitalId: null });
  stopTicking();
  UI.renderHospitals(db(), today(), opts(), goDay);
  UI.setTone('pick', null);
  UI.showScreen('hospitals');
  history.replaceState({ screen: 'hospitals' }, '', location.pathname + location.search);
}

function goDay(hospitalId) {
  current = hospitalId;
  update({ hospitalId });
  UI.renderDay(db(), hospitalId, today(), opts(), { onPerson });
  UI.showScreen('day');
  startTicking();
  history.replaceState({ screen: 'day', hospitalId }, '', location.pathname + location.search);
}

function onPerson(residentId) {
  Sheet.openResident(db(), residentId, today(), opts());
}

/* ---- Canlı saat + "şu an" imleci ---- */
function tickClock() {
  const el = document.getElementById('clock');
  if (el) {
    el.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
}

function startTicking() {
  stopTicking();
  tickClock();
  timer = setInterval(() => {
    tickClock();
    if (!current) return;
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
       (<code>python3 -m http.server</code>), doğrudan dosya olarak değil.</p></div>`;
    return;
  }

  document.getElementById('btn-back').addEventListener('click', goHospitals);
  document.getElementById('btn-settings').addEventListener('click', () => {
    // Ayarlar kapandığında ekranı güncel verilerle yeniden çiz
    Sheet.openSettings(db(), today(), () => { if (current) goDay(current); else goHospitals(); });
  });

  const last = params.get('h') || settings().hospitalId;
  const valid = db().hospitals.some((h) => h.id === last);
  if (valid) goDay(last); else goHospitals();

  // Sekmeye geri dönüldüğünde tarihi/saati tazele
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current) goDay(current);
  });

  // Çevrimdışı çalışma (yalnızca http/https üzerinden)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))
      .catch((e) => console.warn('Service worker kaydedilemedi:', e.message));
  }
})();
