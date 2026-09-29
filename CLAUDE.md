# Parti Game: proje rehberi

Arkadaş ve iş arkadaşlarıyla tarayıcıdan oynanan, çok oyunculu **parti mini oyunları platformu**.
Oda kur → link paylaş → mini oyunlarda yarış → oyunlar arası parti puan tablosu.
Sahibi: Turgay (GitHub: RSTurgay). Konuşma dili Türkçe; kod yorumları da Türkçe.

## Teknoloji

| Katman | Seçim | Not |
|---|---|---|
| Backend | Java 21, **Spring Boot 4.1**, Maven (wrapper), raw WebSocket | Jackson **3** (`tools.jackson.*` paketleri, `JsonMapper`) |
| Frontend | React 19, TypeScript, Vite | `erasableSyntaxOnly`: enum ve parametre property kullanılmaz |
| 3D | **Three.js** | Pist Kaosu için. Phaser kaldırıldı; 2D oyun gerekirse tekrar eklenebilir |
| Mesaj formatı | JSON | İleride gerekirse binary |
| Yayın (plan) | Fly.io, Frankfurt | Tek imaj: Spring Boot, derlenmiş frontend'i de sunar |

Makinede JDK 23 kurulu (Java 21 hedefiyle derliyor), Node 22.

## Çalıştırma

```bash
# Backend: http://localhost:8080 (Windows'ta mvnw.cmd; Git Bash'te ./mvnw wrapper indirme hatası verebilir)
cd backend && mvnw.cmd spring-boot:run
# Frontend: http://localhost:5173 (/ws isteklerini 8080'e proxy'ler)
cd frontend && npm run dev
# Tek port: build çıktısı backend/src/main/resources/static'e yazılır (git'te yok sayılır)
cd frontend && npm run build
```

Kontroller: `npx tsc -b` ve `npx oxlint src` (frontend), `mvnw.cmd test` (backend).
Paket ekleyip çıkardıktan sonra Vite'i yeniden başlat; gerekirse `node_modules/.vite` klasörünü sil.

## Mimari

**Sunucu otoriter:** Tüm oyun mantığı ve fizik sunucuda çalışır. İstemci sadece tuş durumunu
(`input`) gönderir, gelen durumu (`state`, ~30 Hz) yumuşatarak (interpolasyon) çizer. Hile yapılamaz.

```
backend/src/main/java/com/partigame/
├── game/        GameModule (oyun tanımı), GameSession (tek maç), GameRegistry, GameMode (FFA/TEAMS/DUEL)
├── room/        Room (oyuncular, lobi, 30 tick/sn oyun döngüsü, parti puanı), RoomManager, Messages (çıkan mesajlar)
├── net/         GameSocketHandler (/ws), ClientMessage (gelen mesajlar)
├── config/      WebSocketConfig
└── games/pistkaosu/  Track (pist), Car, PistKaosuSession (fizik, tur, sıralama), PistKaosuModule

frontend/src/
├── net/         GameClient (WebSocket, tipli abonelik), protocol.ts (backend mesajlarının birebir tipi)
├── components/  Home, Lobby, GameView, Results, PlayerName
└── games/
    ├── registry.ts          ClientGame arayüzü: mount(parent, client, start) → temizleme fonksiyonu
    └── pist-kaosu/          PistKaosu3D (ana döngü, kamera), world (pist, kemer, start ışıkları, tribün, bariyer),
                             nature (ağaç, çalı, kaya, rüzgâr shader'ı), car (araba modeli), effects (toz),
                             hud (HTML göstergeler, mini harita), input (klavye), types
```

### Yeni mini oyun eklemek
1. Backend: `games/<oyun>/` altında `@Component` bir `GameModule` ve `GameSession`. Lobi, oda ve puan otomatik tanır.
2. Frontend: `src/games/<oyun>/` altında bir `ClientGame` yaz ve `registry.ts` listesine ekle.

`GameSession` metotları oda kilidi altında tek thread'den çağrılır, senkronizasyon gerekmez.

### Protokol (JSON, WebSocket `/ws`)
- İstemci → sunucu: `create {name}`, `join {name, code}`, `leave`, `selectGame {gameId?, mode?}`,
  `setTeam {team}`, `start`, `lobby`, `input {input}`
- Sunucu → istemci: `welcome {games}`, `joined {code, playerId}`, `room {room}`,
  `gameStart {gameId, mode, init}`, `state {state}`, `gameEnd {results}`, `error {message}`
- Tipler iki tarafta elle eşleniyor: `frontend/src/net/protocol.ts` ↔ `room/Messages.java`,
  `pist-kaosu/types.ts` ↔ `PistKaosuSession` içindeki record'lar. **Bir tarafı değiştirince diğerini de güncelle.**

### Pist Kaosu detayları
- Koordinatlar: sunucu 2D (x, y) → Three.js (x, z). Dünya 1600×900, pist genişliği 130, bordür 12.
  Bordür hem `Track.CURB_WIDTH` hem `world.ts CURB_WIDTH` içinde tanımlı; birlikte değiştir.
- Pist: `Track.CONTROL` kontrol noktaları → Catmull-Rom ile 140 nokta. Nokta 0 başlangıç çizgisidir.
  Bu noktalar tur sayımında kontrol noktası olarak da kullanılır. Kısa yoldan kesmeyi ±3'lük arama penceresi engeller.
- Tur: ilk başlangıç çizgisi geçişi dahil `LAPS * size + 1` geçişte bitiş. İlk bitirenden sonra 20 sn ek süre.
- Puan: 10-7-5-3-2-1. Takım modunda istemci takım toplamını hesaplar.
- Görsel süsler istemcide sunucu durumundan türetilir: tekerlek dönüşü, direksiyon (`steer` sunucudan gelir),
  virajda yatma, fren lambası (yavaşlamadan çıkarılır), çimde toz.
- Kamera: yüksek açılı takip (`FOLLOW_OFFSET`); **C** tuşu tüm pist görünümüne geçirir. Turboda FOV genişler, kamera titrer.
- **Fizik:** Arabanın hız vektörü (`vx, vy`) burun yönünden bağımsızdır. Her tick hız ileri/yan bileşenlere
  ayrılır; yan bileşen tutunmayla söner (`GRIP_TRACK` 14, `GRIP_GRASS` 7, `GRIP_DRIFT` 3.2). Tutunma
  düştükçe araba kayar.
- **Drift:** Boşluk/Shift + yön, hız ≥ 170 ve pistteyken başlar. Araba sürekli drift yönüne döner;
  iç tarafa basmak sıkılaştırır, dış tarafa basmak açar. Bırakınca 0.8 sn üstü mini turbo (0.6 sn, mavi),
  1.6 sn üstü süper turbo (1.2 sn, turuncu). Çime kaçan ya da yavaşlayan drift ödül vermez.
- **Turbo:** Azami hız 470. Kaynaklar: drift, turbo şeritleri (`Track.BOOST_PAD_POINTS`, 0.9 sn) ve
  roket start (gaza yeşilden önceki son 0.8 sn içinde basmak, 1 sn). Erken basan roket start alamaz.
- İstemci efektleri (`effects.ts`, `skids.ts`): drift kıvılcımı (şarj rengine göre), lastik izi (drift, kayma, sert fren;
  kare hızından bağımsız, yol boyunca doldurulur), egzoz alevi, turbo şeridinde akan oklar, HUD drift göstergesi.

## Kurallar ve dikkat edilecekler
- Phaser/Three sahne sınıflarında motorun kendi metot adlarıyla çakışan alan adı kullanma
  (örnek: Phaser'da `init` alanı sahneyi bozmuştu ve siyah ekrana yol açmıştı).
- `GameClient.connect()` dinleyiciler kurulduktan sonra çağrılır (App.tsx); aksi halde ilk mesajlar kaçar.
- Three.js'te `onBeforeCompile` ile özelleştirilen malzemelerde değerleri shader koduna gömme,
  **uniform** olarak ver. Program önbelleği aynı kaynak kodlu shader'ları paylaşır.
- Sunucu metin biçimlendirmesinde `Locale.ROOT` kullan (Türkçe locale ondalıkta virgül üretir).
- Tüm kullanıcı metinleri Türkçe.

## Test
- `mvnw.cmd test`: `PistKaosuSessionTest` roket start, erken gaz, turbo şeridi ve drift turbosu kurallarını test eder.
- `node tools/race-bots.mjs`: iki bot oda kurar, takım moduna geçer, yarışı sonuna kadar oynar.
  Yetki kontrolünü, sonuçları, puanları ve lobiye dönüşü doğrular. Sadece backend gerekir.
- `cd tools && npm install && node browser-test.mjs`: gerçek Chrome ile iki oyuncu, ekran görüntüleri
  `tools/screenshots/` altına kaydedilir. Backend ve Vite açık olmalı. Headless ortamda saniyede 2-6 kare
  çizilir; zamanlamaya bağlı sahneler (drift anı, roket start) her koşuda aynı yere denk gelmeyebilir.

## Yapılanlar
- [x] Oda sistemi: 4 haneli kod, davet linki (`?oda=KOD`), en fazla 8 oyuncu, oda sahibi, parti puan tablosu
- [x] Modlar: herkes tek, 2'şer kişilik takımlar (takım seçimi), düello
- [x] Pist Kaosu: sunucu fiziği, çim yavaşlatması, çarpışma, kontrol noktalarıyla tur ve sıralama, geri sayım, bitiş süresi
- [x] 3D görüntü (Three.js): yüksek açılı takip kamerası ve genel görünüm, gölgeler, bordürlü pist, tribün, bariyerler
- [x] Detaylar: dönen ön tekerlekler, jantlar, fren lambası ve parlaması, gövde yatması, toz,
      rüzgârda sallanan üç tür ağaç, çalı ve kaya, F1 tarzı start ışıkları
- [x] HUD: tur, sıra, süre, canlı sıralama, mini harita, "Piste dön!" uyarısı
- [x] Drift ve turbo: kayma fiziği, şarjlı drift turbosu, turbo şeritleri, roket start, kıvılcım, lastik izi,
      egzoz alevi, turboda kamera efekti, drift göstergesi

## Yol haritası (sıradaki önce)
1. [ ] **Sürpriz kutuları**: ⚡ turbo, 🍌 muz, 🧊 buz, 🛡️ kalkan; geridekilere daha iyi eşya.
      Eşya tuşu **E** (Boşluk drift'e ayrıldı)
2. [ ] **Takım mekanikleri**: takım arkadaşının arkasında rüzgâr desteği, eşya pası
3. [ ] **Birden fazla harita**: backend'de harita tanımları, lobide harita seçimi, temalar (kar, çöl, gece).
      Turbo şeritleri haritaya özel olmalı (şu an `Track.BOOST_PAD_POINTS`)
4. [ ] **Yayın**: Dockerfile ve Fly.io (Frankfurt), herkesin erişebileceği adres
5. [ ] Yeniden bağlanma (sayfa yenilenince odaya geri dönme; şu an oyuncu odadan düşüyor)
6. [ ] Ses efektleri ve müzik (motor, drift, turbo), dokunmatik ve mobil kontroller
7. [ ] Yeni mini oyunlar (parti platformu fikri: Bomberman tarzı, futbol ve benzeri)
