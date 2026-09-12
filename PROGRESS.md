# Asistan Paneli — İlerleme Takibi

> Bu dosya **oturum kesilirse kaldığı yerden devam** edebilmek için var.
> Yeni bir Claude Code oturumu açıldığında önce `CLAUDE.md` + bu dosya okunur.

## Durum: FAZ 7 / 7 — GitHub tarafı bekleniyor

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
- [ ] **Yayın** — karar verildi: GitHub Pages + noindex, tam isimlerle.
      Depo hazır, commit'lendi, remote tanımlı. `DEPLOY.md` içindeki 3 adım
      (depo oluştur → dağıtım anahtarını ekle → Pages'i aç) kullanıcıda.
      Sonrasında: `git -C . push -u origin main`
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

## Kararlar
- **16:00 kuralı** (kullanıcı onayladı 12.09.2026): nöbetçi asistan gündüz mesaisinden
  16:00'da çıkar, geceyi nöbette geçirir, ertesi gün izinlidir.
- **Barındırma** (kullanıcı seçti): GitHub Pages, public depo, `robots.txt` + `noindex`,
  isimler tam hâliyle. Anonim sürüm isteyen olursa `node tools/anonymize.js`.
