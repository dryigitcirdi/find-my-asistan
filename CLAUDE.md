# Find My Asistan

iPhone ana ekranına kısayol olarak eklenebilen, tek sayfalık (PWA) asistan nöbet/izin paneli.
Yerel klasör `asistan-panel`, GitHub deposu `find-my-asistan` (isim sonradan değişti).
Acıbadem Üniversitesi Ortopedi ve Travmatoloji — 4 hastane, 6 asistan.

**Her oturumun başında `PROGRESS.md` dosyasını oku**, hangi fazda kalındığını oradan öğren ve
iş bitirdikçe oradaki kutucukları güncelle.

## İkon ve marka
Konum işareti: eş merkezli halkalar + ortada tombul fildişi bir kemik (ortopedi göndermesi),
arkasında kehribar hale. `node tools/make-icons.js` 180/192/512 PNG üretir — bağımlılık yok,
geometri `bone` nesnesinden ayarlanır.

Kemik oranlarını değiştirirken üç kuralı bozma, yoksa kemik okunmaz hale gelir:
- **Orta boşluk:** `halfSpan - lobeR > lobeR` (iki uç birbirine yapışmasın)
- **Bel:** `2*shaftH / (2*(lobeDy+lobeR))` ≈ 0.35–0.45 (gövde topuzlardan belirgin ince olsun)
- **Topuz çentiği:** `lobeDy / lobeR` ≈ 0.65–0.75 (uçtaki iki topuz ayrışsın ama sertleşmesin)
Fazla tombullaştırınca (kısa + kalın gövde) şekil buluta dönüyor — bir kez oldu.

Kemiğin yanına alet (matkap/tornavida) eklemek denendi ve **vazgeçildi**: bir matkabın
silueti gövde–sap birleşiminden tanınır, çapraz düzende orayı kemik kapatıyor ve
180 pikselde tanınmaz bir lekeye dönüyor. Üreticide `--variant=screw|screwring|tools`
seçenekleri duruyor ama yüklü sürüm `rings` (halka + kemik). Tekrar denemeye gerek yok.
Uygulama içindeki küçük işaret `index.html`'de satır içi SVG; küçük boyda okunurluk için
sadeleştirilmiş (tek halka + daha büyük kemik). İkonun iki hali kasıtlı olarak farklı.

## Kurallar
- **Derleme adımı yok.** Saf HTML + CSS + ES modülleri. Framework, bundler, npm bağımlılığı ekleme.
- Animasyonlar yalnızca `transform` ve `opacity` üzerinden — 60fps korunmalı.
- `prefers-reduced-motion` her animasyonda dikkate alınmalı.
- Arayüz dili Türkçe.
- Tıbbi klişe görsel yok (stok doktor, mavi-yeşil hastane teması vb.).

## Haftalık bardaki renk dili
Kutu = bir günün mesaisi, dikey olarak 08:00 (alt) → 18:00 (üst).
- **Düz yeşil** — tam gün mesaide
- **Yeşil + üstte sarı şerit** — o gün burada ama nöbet çıkışı nedeniyle erken gidiyor.
  Şeridin yüksekliği çıkamadığı sürenin oranı (`--duty-gap`, 08–18 / 16:00 → %20),
  mesai saatleri değişirse kendiliğinden uyar.
- **Düz sarı** — hafta sonu nöbeti: rutin mesai yok, tüm gün nöbette
- **Kırmızı** — o gün yok (nöbet ertesi). Kliniği en çok etkileyen durum, en uyarıcı renk.
- Taralı — yıllık izin / dış rotasyon

Nöbetin hangi hastanede olduğu barda **gösterilmez**: gözlemci için önemli olan
"burada mı, kaçta çıkıyor". Nöbet yeri asistan kartının metninde yazıyor.
Eskiden sarı çerçeve + gri iç kullanılıyordu; "o gün yok" izlenimi verdiği için kaldırıldı.

## Ekran düzeni — neden böyle
Panel, **asistan kartıyla başlar**. Kullanıcılar (18 hoca) kendi hastanesinin tek-iki
asistanını görmek için açıyor; toplam sayaç onları aşağı itiyordu. Üstteki büyük sayaç
kartı tek satırlık duruma indirildi. Kartın kendisi dört soruyu sırayla cevaplar:
bugün nerede / kaçta çıkar → yarın ne olacak → bu hafta hangi gün yok.

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

## Aylık otomatik senkron
Zamanlanmış görev: `find-my-asistan-sync` (her ayın 29'u, 09:00).
Tanım: `~/.claude/scheduled-tasks/find-my-asistan-sync/SKILL.md`

Yaptığı: Drive'dan nöbet + yıllık izin tablolarını metin olarak çeker,
`tools/import-duties.js` ve `tools/import-leaves.js` ile veriye işler,
`tools/verify.js` ile doğrular, `sw.js` VERSION'ını artırır, commit + push eder.
Doğrulama hata verirse commit etmez.

**Kadroya ve rotasyona dokunmaz** — onlar renk kodlarından geliyor ve 2030'a kadar dolu.
Rotasyon değişirse elle: `node tools/import-rotation.js <xlsx>`

Görev yalnızca Claude uygulaması açıkken çalışır; kapalıysa bir sonraki açılışta çalışır.

## Gündüz kadrosu nereden geliyor
Kadro, `Asistan Rotasyon Takvimi` sayfasında **yazıyla değil hücre dolgu rengiyle** tutuluyor.
Renk anahtarı sayfanın kendi içinde, 20-23. satırlarda:
yeşil `00FF00` Altunizade · teal `00FFFF` Atakent · sarı `FFFF00` Ataşehir · magenta `FF00FF` Maslak ·
kırmızı `FF0000` dış rotasyon · turuncu `FF9900` tez dönemi.

Sütun–ay hizası: **BJ(62) = 2026-01**, her yıl 12 sütun (B(2) = 2021-01).
Satır 10'daki yıl etiketleri birleştirme yüzünden bir sütun kaymış görünür — onlara güvenme,
satır 11'deki ay numaralarını ve bu hizayı kullan.

Sayfa güncellenince yeniden içe aktarma:
```bash
# Drive → Asistan Rotasyon Takvimi → Dosya → İndir → .xlsx
node tools/import-rotation.js ~/Downloads/Asistan\ Rotasyon\ Takvimi.xlsx
```
Araç, çıkardığı sayıları sayfanın kendi özet sütunlarıyla (ATZ/ATK/ATA/MAS/ROT/TEZ)
karşılaştırıp farkları bildirir. M. Oğuz ve Can Eser'de birkaç hücrelik bilinen fark var;
toplamlar tuttuğu için bunlar özet hücrelerindeki elle yazım kayması sayıldı.

### xlsx okurken iki tuzak
1. `<c .../>` biçiminde kendini kapatan hücreler ayrı ele alınmalı. Tek regex'le okunursa
   **boş-ama-renkli** hücre kendinden sonrakini yutuyor — kadro hücreleri tam da bunlar.
   Bu hata yüzünden bir tur renkler "seyrek" görünüp yanlış sonuca götürdü.
2. Birleştirilmiş hücrelerde değer ve renk yalnızca sol üst hücrede durur; TEZ blokları böyle.

## Çalışma düzeni (varsayılan, Ayarlar'dan değiştirilebilir)
- Mesai 08:00–18:00
- Nöbetçi asistan gündüz mesaisinden **16:00**'da çıkar, akşam nöbete kalır
- Nöbet ertesi gün izinli. Kaynak tablodaki liste esastır; **pazar nöbeti tutulduysa
  ertesi pazartesi izni listede olmasa da türetilir** (`postCallOn` içinde). Kaynakta
  12 pazar nöbetinin 10'unda izin yazılı, 2'si atlanmış — kural bu boşluğu kapatıyor.
- Hafta sonu gündüz mesaisi yok; o gün hastanede olan tek kişi nöbetçidir.

## Önizleme
```bash
node /Users/yigit/Desktop/cod/asistan-panel/serve.js 4173
```
ES modülleri `file://` üzerinden çalışmaz, mutlaka sunucu üzerinden aç.
Test için tarih/hastane zorlama: `?d=2026-09-16&h=maslak`

## Service worker stratejisi
**Önce ağ, sonra önbellek** (2.5 sn zaman aşımı). Önceden "önce önbellek" idi ve
her güncelleme iki kez yenileme gerektiriyordu: ilk açılışta eski sürüm geliyor,
yeni sürüm ancak ikinci açılışta görünüyordu. Panel 18 kişiyle paylaşıldığı için
bu kabul edilemezdi. Artık çevrimiçiyken her zaman güncel, çevrimdışıyken önbellekten.
İkonlar istisna: önce önbellek (hiç değişmiyorlar).

`VERSION` sabitini yine de her yayında artır — çevrimdışı önbelleği tazeleyen şey o.

## Geliştirirken dikkat
CSS/JS değişikliği tarayıcıda görünmüyorsa `VERSION`'ı artır ya da konsolda:
```js
(await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
(await caches.keys()).forEach(k => caches.delete(k));
```
