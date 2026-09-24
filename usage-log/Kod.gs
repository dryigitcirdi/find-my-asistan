/**
 * Find My Asistan — kullanan kişiler listesi
 *
 * Amaç yalnızca "bu paneli kimler kullanıyor" sorusunu yanıtlamak.
 * Giriş kaydı TUTULMAZ: kim ne zaman açtı, kaç kez açtı yazılmaz.
 * Kişi başına tek satır vardır; aynı kişi tekrar bildirirse satırı güncellenir.
 */
const SAYFA = 'Kullananlar';

function doPost(e) {
  try {
    kaydet(JSON.parse((e && e.postData && e.postData.contents) || '{}'));
    return cikti({ ok: true });
  } catch (err) {
    return cikti({ ok: false, hata: String(err) });
  }
}

function doGet() {
  return cikti({ ok: true, servis: 'Find My Asistan — kullanan kişiler' });
}

function cikti(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Türkçe'ye duyarlı karşılaştırma — "Ayşe" ile "ayşe" aynı kişi */
function anahtar(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
}

function kaydet(v) {
  const ad = String(v.ad || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (ad.length < 2) return;
  const hastane = String(v.hastane || '').trim().slice(0, 40);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (err) { /* kilit alınamazsa yine de dene */ }

  try {
    let s = ss.getSheetByName(SAYFA);
    if (!s) {
      s = ss.insertSheet(SAYFA);
      s.appendRow(['Ad', 'Hastane', 'Eklendiği tarih']);
      s.getRange(1, 1, 1, 3).setFontWeight('bold');
      s.setFrozenRows(1);
      s.setColumnWidth(1, 220);
      s.setColumnWidth(2, 140);
    }

    const veriler = s.getDataRange().getValues();
    const hedef = anahtar(ad);
    for (let i = 1; i < veriler.length; i++) {
      if (anahtar(veriler[i][0]) === hedef) {
        // Zaten listede: yalnızca hastanesi değiştiyse güncelle, tarihe dokunma
        if (hastane && String(veriler[i][1]) !== hastane) {
          s.getRange(i + 1, 2).setValue(hastane);
        }
        return;
      }
    }
    s.appendRow([ad, hastane, new Date()]);
  } finally {
    try { lock.releaseLock(); } catch (err) { /* yoksay */ }
  }
}
