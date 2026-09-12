# Yayına alma — GitHub Pages

Hedef adres: **https://dryigitcirdi.github.io/asistan-panel/**

Depo hazır ve commit'lendi. Kalan 3 adım GitHub hesabında yapılmalı
(depo oluşturma ve anahtar yetkilendirme senin onayını gerektiriyor):

### 1. Depoyu oluştur
https://github.com/new adresinde:
- **Repository name:** `asistan-panel`
- **Public** seç (ücretsiz planda GitHub Pages yalnızca public depolarda çalışır)
- README / .gitignore / lisans **ekleme** — depo boş kalsın

### 2. Dağıtım anahtarını ekle
`https://github.com/dryigitcirdi/asistan-panel/settings/keys/new` adresinde:
- **Title:** `asistan-panel deploy`
- **Key:** aşağıdaki satırı olduğu gibi yapıştır
- **Allow write access** kutusunu **işaretle**

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEdPz0kfq8PwFihMyTHjgWYnv/9ywWJgP6LisdF4b0vp asistan-panel deploy key
```

### 3. GitHub Pages'i aç
`https://github.com/dryigitcirdi/asistan-panel/settings/pages` adresinde:
- **Source:** `Deploy from a branch`
- **Branch:** `main` / `(root)` → Save

Bu üçü bitince bana "yayınla" de, gerisini ben hallederim:
```bash
git -C /Users/yigit/Desktop/cod/asistan-panel push -u origin main
```

---

## Gizlilik notu

Ücretsiz GitHub Pages **public depo** gerektirir. Bu şu anlama gelir:
site adresi arama motorlarına kapalı (`robots.txt` + `noindex` eklendi), ama
**deponun içeriği github.com üzerinde herkese açık ve GitHub aramasında bulunabilir** —
yani `data/schedule.json` içindeki asistan isimleri ve izin tarihleri de.

İsimleri dışarıya kapatmak istersen, yayınlamadan önce:
```bash
node tools/anonymize.js
```
İsimler `T.K.Y.`, `M.K.` gibi baş harflere iner; tam sürüm `data/.schedule.full.json`
içinde yerel olarak kalır ve git'e girmez. Geri almak için:
```bash
node tools/anonymize.js --restore
```

Depo gizli kalsın istersen GitHub Pages yerine Netlify ya da Cloudflare Pages kullanılabilir;
ikisi de ücretsiz planda **private** depodan yayın yapar (kurulum tarayıcıdan giriş ister).

---

## iPhone ana ekranına ekleme

1. Safari'de siteyi aç
2. Paylaş tuşu → **Ana Ekrana Ekle**
3. Kısayol adı: `Asistan`

İlk açılışta tüm dosyalar telefona indirilir; sonrasında internet olmasa da açılır.

## Veri güncelleme (her ay)

Yeni nöbet listesi çıkınca `data/schedule.json` içindeki `duties`, `postCall` ve
`leaves` alanları güncellenir, sonra:
```bash
git -C /Users/yigit/Desktop/cod/asistan-panel add -A
git -C /Users/yigit/Desktop/cod/asistan-panel commit -m "Ekim 2026 nöbet listesi"
git -C /Users/yigit/Desktop/cod/asistan-panel push
```
`sw.js` içindeki `VERSION` değerini de artır ki telefonlardaki önbellek tazelensin.
