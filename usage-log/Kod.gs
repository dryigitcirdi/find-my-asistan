/**
 * Find My Asistan — kullanım kaydı
 *
 * Panel her açıldığında "kim kullanıyor" bilgisini buraya yazar.
 * Amaç kısıtlamak değil, görünürlük: şifre yok, kimse engellenmiyor.
 *
 * İki sayfa tutulur:
 *   Kullananlar — kişi başına tek satır (ilk açılış, son açılış, kaç kez)
 *   Açılışlar   — her açılış ayrı satır (ne zaman, kim, hangi hastane)
 */
const OZET = 'Kullananlar';
const LOG = 'Açılışlar';

function doPost(e) {
  try {
    const veri = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    kaydet(veri);
    return cikti({ ok: true });
  } catch (err) {
    return cikti({ ok: false, hata: String(err) });
  }
}

function doGet() {
  return cikti({ ok: true, servis: 'Find My Asistan kullanım kaydı' });
}

function cikti(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Türkçe'ye duyarlı karşılaştırma anahtarı — "Ayşe" ile "ayşe" aynı kişi */
function anahtar(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
}

function sayfa(ss, ad, basliklar) {
  let s = ss.getSheetByName(ad);
  if (!s) {
    s = ss.insertSheet(ad);
    s.appendRow(basliklar);
    s.getRange(1, 1, 1, basliklar.length).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}

function kaydet(v) {
  const ad = String(v.ad || '').trim().replace(/\s+/g, ' ');
  if (!ad) return;

  const hastane = String(v.hastane || '').trim();
  const surum = String(v.surum || '').trim();
  const cihaz = String(v.cihaz || '').trim().slice(0, 60);
  const simdi = new Date();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (err) { /* kilit alınamazsa yine de dene */ }

  try {
    // --- her açılış ayrı satır ---
    sayfa(ss, LOG, ['Zaman', 'Ad', 'Hastane', 'Sürüm', 'Cihaz'])
      .appendRow([simdi, ad, hastane, surum, cihaz]);

    // --- kişi başına tek satır ---
    const ozet = sayfa(ss, OZET,
      ['Ad', 'Hastane', 'İlk açılış', 'Son açılış', 'Açılış sayısı', 'Sürüm', 'Cihaz']);
    const veriler = ozet.getDataRange().getValues();
    const hedef = anahtar(ad);
    let satir = -1;
    for (let i = 1; i < veriler.length; i++) {
      if (anahtar(veriler[i][0]) === hedef) { satir = i + 1; break; }
    }
    if (satir > 0) {
      const sayi = Number(ozet.getRange(satir, 5).getValue()) || 0;
      ozet.getRange(satir, 2).setValue(hastane);
      ozet.getRange(satir, 4).setValue(simdi);
      ozet.getRange(satir, 5).setValue(sayi + 1);
      ozet.getRange(satir, 6).setValue(surum);
      ozet.getRange(satir, 7).setValue(cihaz);
    } else {
      ozet.appendRow([ad, hastane, simdi, simdi, 1, surum, cihaz]);
    }
  } finally {
    try { lock.releaseLock(); } catch (err) { /* yoksay */ }
  }
}
