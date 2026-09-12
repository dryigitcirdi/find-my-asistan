# İkon sürümleri — karar bekliyor

`karsilastirma.png` dördünü 180px'te yan yana gösterir. Soldan sağa:

| Klasör | Sürüm | Not |
|---|---|---|
| `v-rings` | halka + kemik | **şu an yüklü olan** — en sakin, alet yok |
| `v-screwring` | halka + kemik + tornavida | Find My halkası + ortopedi göndermesi, dengeli |
| `v-screw` | kemik + tornavida | küçük boyda en okunaklı, halka kimliği yok |
| `v-tools` | kemik + matkap + tornavida | matkap 180px'te tanınmıyor, önerilmez |

Seçilen sürümü yüklemek için:
```bash
node tools/make-icons.js --variant=screwring    # ya da: rings | screw | tools
```
Sonra `index.html` içindeki satır içi SVG işareti de aynı sürüme göre güncellenmeli
ve `sw.js` içindeki `VERSION` artırılmalı.

**Neden matkap okunmuyor:** bir matkabın silueti gövde–sap birleşiminden tanınır,
yani tam ortasından. Çapraz düzende orayı kemik kapatıyor, geriye yalnızca iki
bağlantısız uç kalıyor. Tornavida ise kimliğini uçlarında (sap + yassı uç) taşıdığı
için kısmen örtülse de okunmaya devam ediyor.
