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
- Kamera: yüksek açılı takip (`FOLLOW_OFFSET`); **C** tuşu tüm pist görünümüne geçirir.

## Kurallar ve dikkat edilecekler
- Phaser/Three sahne sınıflarında motorun kendi metot adlarıyla çakışan alan adı kullanma
  (örnek: Phaser'da `init` alanı sahneyi bozmuştu ve siyah ekrana yol açmıştı).
- `GameClient.connect()` dinleyiciler kurulduktan sonra çağrılır (App.tsx); aksi halde ilk mesajlar kaçar.
- Three.js'te `onBeforeCompile` ile özelleştirilen malzemelerde değerleri shader koduna gömme,
  **uniform** olarak ver. Program önbelleği aynı kaynak kodlu shader'ları paylaşır.
- Sunucu metin biçimlendirmesinde `Locale.ROOT` kullan (Türkçe locale ondalıkta virgül üretir).
- Tüm kullanıcı metinleri Türkçe.

## Test
- `node tools/race-bots.mjs`: iki bot oda kurar, takım moduna geçer, yarışı sonuna kadar oynar.
  Yetki kontrolünü, sonuçları, puanları ve lobiye dönüşü doğrular. Sadece backend gerekir.
- `cd tools && npm install && node browser-test.mjs`: gerçek Chrome ile iki oyuncu, ekran görüntüleri
  `tools/screenshots/` altına kaydedilir. Backend ve Vite açık olmalı. Headless FPS gerçekçi değildir.

## Yapılanlar
- [x] Oda sistemi: 4 haneli kod, davet linki (`?oda=KOD`), en fazla 8 oyuncu, oda sahibi, parti puan tablosu
- [x] Modlar: herkes tek, 2'şer kişilik takımlar (takım seçimi), düello
- [x] Pist Kaosu: sunucu fiziği, çim yavaşlatması, çarpışma, kontrol noktalarıyla tur ve sıralama, geri sayım, bitiş süresi
- [x] 3D görüntü (Three.js): yüksek açılı takip kamerası ve genel görünüm, gölgeler, bordürlü pist, tribün, bariyerler
- [x] Detaylar: dönen ön tekerlekler, jantlar, fren lambası ve parlaması, gövde yatması, toz,
      rüzgârda sallanan üç tür ağaç, çalı ve kaya, F1 tarzı start ışıkları
- [x] HUD: tur, sıra, süre, canlı sıralama, mini harita, "Piste dön!" uyarısı

## Yol haritası (sıradaki önce)
1. [ ] **Drift ve turbo hissi**: virajda kayma (sunucu fiziği), lastik izi, hız efektleri, turbo
2. [ ] **Sürpriz kutuları**: ⚡ turbo, 🍌 muz, 🧊 buz, 🛡️ kalkan; geridekilere daha iyi eşya
3. [ ] **Takım mekanikleri**: takım arkadaşının arkasında rüzgâr desteği, eşya pası
4. [ ] **Birden fazla harita**: backend'de harita tanımları, lobide harita seçimi, temalar (kar, çöl, gece)
5. [ ] **Yayın**: Dockerfile ve Fly.io (Frankfurt), herkesin erişebileceği adres
6. [ ] Yeniden bağlanma (sayfa yenilenince odaya geri dönme; şu an oyuncu odadan düşüyor)
7. [ ] Ses efektleri ve müzik, dokunmatik ve mobil kontroller
8. [ ] Yeni mini oyunlar (parti platformu fikri: Bomberman tarzı, futbol ve benzeri)
