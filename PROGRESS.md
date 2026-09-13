# Find My Asistan — İlerleme Takibi

> Bu dosya **oturum kesilirse kaldığı yerden devam** edebilmek için var.
> Yeni bir Claude Code oturumu açıldığında önce `CLAUDE.md` + bu dosya okunur.

## Durum: CANLI — https://dryigitcirdi.github.io/find-my-asistan/

Yayına alındı 13.09.2026. Güncelleme: `git push` yeterli (Pages otomatik derler).
`sw.js` içindeki `VERSION` artırılmazsa telefonlardaki önbellek eskide kalır.

| # | Faz | Durum |
|---|-----|-------|
| 1 | Drive verisinin çekilmesi ve ayrıştırılması | ✅ Bitti |
| 2 | Veri modeli + `data/schedule.json` | ✅ Bitti |
| 3 | Durum motoru (`app/schedule.js`) | ✅ Bitti |
| 4 | Arayüz: hastane seçimi + bugün paneli | ✅ Bitti |
| 5 | Haftalık bar + asistan detayı + ayarlar | ✅ Bitti |
| 6 | PWA (manifest, ikon, service worker, offline) | ✅ Bitti |
| 7 | Yayına alma (GitHub Pages / Vercel) + iPhone kısayolu | ⬜ Bekliyor |

## Yapılacaklar (sıradaki)
- [x] ~~Yayın~~ — **canlı**. Depo `dryigitcirdi/find-my-asistan`, dağıtım anahtarı ekli,
      Pages `main`/`(root)` üzerinden yayında.
- [x] ~~Kadro tablosu bekleniyor~~ — **çözüldü**: kadro rotasyon takviminin renk kodlarından
      okunuyor, 101 ay için tanımlı (2021-12 → 2030-04). `tools/import-rotation.js` ile
      yeniden üretilebilir. Detay ve tuzaklar `CLAUDE.md` içinde.

- [ ] Ekim 2026 nöbet listesi çıkınca `data/schedule.json` güncellemesi
- [ ] İsteğe bağlı: Drive'dan otomatik senkron (şu an elle aktarım)

## Yerel çalıştırma
```bash
node /Users/yigit/Desktop/cod/asistan-panel/serve.js 4173
```
Test için tarih/hastane zorlama: `?d=2026-09-16&h=maslak`

## Kaynak veri
- Drive klasörü: `Üniversite / Asistan takip`
  - `Asistan Nöbet Tarihleri` (Sheets, id `1FKxsJKmOxqE2dlPU5rRyudSZq1uXbrBR1BX3mzrODUs`)
    - Sayfa 1 = Ağustos 2026, Sayfa 2 = Eylül 2026, Sayfa 3-5 boş şablon
  - `Asistan Rotasyon Takvimi` (Sheets, id `1Wjg4AtHUv4S1BbjmmCrvQzEbmYpuR6KDM2vcLvyFVPM`)
    - 2021-01 … 2030-12 aylık dış rotasyon matrisi + yıllık izin tablosu
- Veri **elle** `data/schedule.json` içine aktarıldı (otomatik senkron henüz yok).

## Veriden çıkan bilinen sorunlar (kaynakta düzeltilmeli)
1. **TKY** `13/06/2026` → Eylül sayfasında, `13/09/2026` olarak alındı.
2. **TKY** `10/09/2026` hem Altunizade nöbeti hem de nöbet ertesi izin.
3. **MOÇ** `02/09/2026` hem Atakent nöbeti hem de nöbet ertesi izin.
4. **MOÇ** Ağustos sayfasında Eylül tarihleri yazılı → Ağustos nöbeti yok sayıldı.
5. **TY** `5/082/2026` → `05/08/2026` olarak alındı.
6. Ataşehir sütunu her iki ayda da tamamen boş.
7. Rotasyon tablosunda **Can Eser** satırı yok (sadece izin tablosunda var).

## Veride OLMAYAN, kullanıcıdan alınacak bilgiler
- Hangi asistanın hangi hastanede **günlük kadroda** olduğu → şu an nöbet dağılımından tahmin
  ediliyor (`assignments`), uygulama içi Ayarlar'dan düzeltilebilir.
- Her hastanenin **asistan sorumlusu** → boş, Ayarlar'dan seçilecek.

## v2 — gözlemci odaklı sürüm (12.09.2026)
- Hastaneler arası **yatay kaydırma** (CSS scroll-snap): ilk sayfa hatırlanan hastane,
  yana kaydırınca diğerleri. Başlık, noktalar ve arka plan tonu kaydırmayla değişir.
- Her asistan kartında **"Yarın →" şeridi**: ertesi gün nöbetçi mi, izinli mi, gelmiyor mu.
- **Metehan Akdağ Ataşehir kadrosunda** (kullanıcı düzeltmesi). Ataşehir'de nöbet
  tutulmuyor; Ataşehir asistanı nöbetlerini diğer hastanelerde tutuyor.
  → **Nöbet yeri kadroyu göstermez**; kalan 5 asistanın kadrosu hâlâ tahmin.
- Kadro doğrulanmadıysa panelde uyarı şeridi çıkar; Ayarlar'dan "doğrula" ile kapanır.
- Asistan sorumlusu alanı "isteğe bağlı" olarak geri plana alındı.
- Anonimleştirme gerekmiyor: panel 18 hoca + 6 asistan tarafından kullanılacak,
  isimler açık kalacak. `tools/anonymize.js` yine de duruyor.

## v6 — otomatik senkron (13.09.2026)
- `find-my-asistan-sync` zamanlanmış görevi kuruldu: her ayın 29'u 09:00.
  Drive → içe aktar → doğrula → sw VERSION artır → commit + push.
- Nöbet ve izin verisi artık elle girilmiyor; `tools/import-duties.js` ve
  `tools/import-leaves.js` Drive metnini ayrıştırıyor. Doğrulama: ayrıştırıcı
  elle girilen Eylül verisini birebir üretti (44 nöbet, 26 ertesi izin, 0 fark).
- `tools/verify.js` yayın öncesi sağlık kontrolü yapıyor; hata varsa commit yok.
- **Ana hastane** artık kalıcı, yana kaydırmak değiştirmiyor.

## v5 — gözlemci odaklı düzen (12.09.2026)
- Panel artık **asistan kartıyla başlıyor**; büyük sayaç kartı tek satırlık duruma indi.
  Hoca uygulamayı açınca ilk ekranda kendi asistanının durumunu görüyor.
- Kartta düz cümleyle haftalık özet: "Bu hafta Çar yok · Sal ve Cum 16:00'da çıkar".
- **Pazar nöbeti → pazartesi nöbet ertesi izni** kuralı motora eklendi; kaynak listedeki
  kayıt esas, eksikse türetiliyor (kaynakta 2 pazar nöbetinin ertesi yazılmamış).

## v4 — kadro renk kodlarından okunuyor (12.09.2026)
Rotasyon takviminde gündüz kadrosu hücre dolgu rengiyle tutuluyormuş. Artık 101 ay için
kadro veride: Eylül 2026 → Müge Altunizade, Metehan Ataşehir, M. Oğuz Maslak,
Tarık Altunizade, Can Atakent, T. Koray Acil rotasyonunda. Kasım'da kadro kendiliğinden
değişiyor. Önceki tahminlerimden ikisi (M. Oğuz, Tarık) yanlışmış.
"Kadro tahmin edildi" uyarısı kaldırıldı; yerine "Bu ay klinik dışında" satırı geldi.
Can Eser'in rotasyon satırı ilk aktarımda atlanmıştı, artık var.

## v3 — açılış ekranı ve mevcut sayımı düzeltmeleri (12.09.2026)
- **Açılış ekranı:** uygulama her açılışta marka (kemik işareti + "Find My Asistan")
  gösterip panele çözülüyor. Önceden isim yalnızca seçim ekranında ve panelin
  en altında görünüyordu; kayıtlı hastaneyle açılınca hiç görünmüyordu.
- **Kaydırma hatası:** yerleşim hazır olmadan `scrollLeft` ayarlanınca sessizce iptal
  oluyor, üst bar "—" kalıyor ve ton ayarlanmıyordu. Artık başlık/nokta/ton kaydırma
  konumundan bağımsız ayarlanıyor, kaydırma ise yerleşim hazır olana kadar deneniyor.
- **Hafta sonu mevcudu:** kadrosu burada olup nöbeti başka hastanede olan kişi
  "sahada" sayılıyordu; burada nöbetçi olan misafir ise sayılmıyordu. İkisi de düzeltildi.
  Hafta sonu beklenen mevcut artık kadro değil, o günkü nöbetçi sayısı.
- Kadrodaki biri başka hastanede nöbetçiyse hero satırı bunu söylüyor.

## İkon kararı (12.09.2026)
Yüklü sürüm: **halka + ponçik kemik** (`--variant=rings`). Kemiğin yanına matkap/tornavida
eklemek denendi, vazgeçildi — gerekçe `CLAUDE.md` içinde.

## Kararlar
- **16:00 kuralı** (kullanıcı onayladı 12.09.2026): nöbetçi asistan gündüz mesaisinden
  16:00'da çıkar, geceyi nöbette geçirir, ertesi gün izinlidir.
- **Barındırma** (kullanıcı seçti): GitHub Pages, public depo, `robots.txt` + `noindex`,
  isimler tam hâliyle. Anonim sürüm isteyen olursa `node tools/anonymize.js`.
