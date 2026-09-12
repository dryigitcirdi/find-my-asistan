# Find My Asistan

iPhone ana ekranına kısayol olarak eklenebilen, tek sayfalık (PWA) asistan nöbet/izin paneli.
Yerel klasör `asistan-panel`, GitHub deposu `find-my-asistan` (isim sonradan değişti).
Acıbadem Üniversitesi Ortopedi ve Travmatoloji — 4 hastane, 6 asistan.

**Her oturumun başında `PROGRESS.md` dosyasını oku**, hangi fazda kalındığını oradan öğren ve
iş bitirdikçe oradaki kutucukları güncelle.

## İkon ve marka
Konum işareti: eş merkezli halkalar + ortada fildişi bir kemik (ortopedi göndermesi),
arkasında kehribar hale. `node tools/make-icons.js` 180/192/512 PNG üretir — bağımlılık yok,
geometri dosyanın başındaki `bone` nesnesinden ayarlanır.
Uygulama içindeki küçük işaret `index.html`'de satır içi SVG; küçük boyda okunurluk için
sadeleştirilmiş (tek halka + daha büyük kemik). İkonun iki hali kasıtlı olarak farklı.

## Kurallar
- **Derleme adımı yok.** Saf HTML + CSS + ES modülleri. Framework, bundler, npm bağımlılığı ekleme.
- Animasyonlar yalnızca `transform` ve `opacity` üzerinden — 60fps korunmalı.
- `prefers-reduced-motion` her animasyonda dikkate alınmalı.
- Arayüz dili Türkçe.
- Tıbbi klişe görsel yok (stok doktor, mavi-yeşil hastane teması vb.).

## Mimari
```
index.html            tek sayfa: seçim ekranı + yatay kaydırmalı hastane sayfaları
styles/app.css        tüm stil; renkler CSS değişkeni (--accent, --ambient-*)
app/data.js           schedule.json'u yükler + kullanıcı düzenlemelerini (localStorage) birleştirir
app/schedule.js       durum motoru — saf fonksiyonlar, DOM bilmez
app/ui.js             render — panelHTML() bir hastane sayfası üretir, renderPager() dördünü kurar
app/sheet.js          asistan detayı ve ayarlar alt sayfası
tools/make-icons.js   PWA ikonlarını üretir (bağımlılıksız PNG yazıcı)
app/main.js           yönlendirme + olaylar
data/schedule.json    Drive'dan aktarılan nöbet/izin/rotasyon verisi
```

## Çalışma düzeni (varsayılan, Ayarlar'dan değiştirilebilir)
- Mesai 08:00–18:00
- Nöbetçi asistan gündüz mesaisinden **16:00**'da çıkar, akşam nöbete kalır
- Nöbet ertesi gün izinli (kaynak tabloda açıkça listelenen günler esas alınır)

## Önizleme
```bash
node /Users/yigit/Desktop/cod/asistan-panel/serve.js 4173
```
ES modülleri `file://` üzerinden çalışmaz, mutlaka sunucu üzerinden aç.
Test için tarih/hastane zorlama: `?d=2026-09-16&h=maslak`

## Geliştirirken dikkat
Service worker kabuk dosyalarını önbelleğe alır. CSS/JS değişikliği tarayıcıda görünmüyorsa
`sw.js` içindeki `VERSION` sabitini artır ya da konsolda:
```js
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
(await caches.keys()).forEach(k => caches.delete(k));
```
