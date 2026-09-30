# 🎉 Parti Game

Arkadaşlarla tarayıcıdan oynanan, çok oyunculu mini oyun platformu. Oda kur, linki paylaş, kapışın.

## İlk oyun: Pist Kaosu 🏁

3D, yüksek açılı kameralı yarış. 3 turu ilk bitiren kazanır.

- **Kontroller:** Yön tuşları veya WASD · **Boşluk/Shift + yön** ile drift, bırakınca turbo · **E** eşya kullan · **C** ile kamera
- **Modlar:** Herkes tek · 2'şer kişilik takımlar · Düello (1v1)
- **Puanlar:** 10-7-5-3-2-1. Takım modunda takım arkadaşlarının puanları toplanır.
- Çime çıkınca yavaşlarsın. Pistten kestirme yapmak işe yaramaz, kontrol noktaları sırayla geçilmeli.

## İkinci oyun: Bulmaca Kapışması 🧩

Herkes aynı bulmacayı **sırayla** çözer. Sıra sendeyken süren içinde bildiğin kelimeleri yaz; çözülen kelimeler
bulmacada kalır, kesişen harfler sıradaki oyuncuya ipucu olur.

- **Lobide seçilir:** tur süresi (45 / 60 / 90 sn) ve zorluk (Kolay / Orta / Zor)
- **Puan:** kelimenin harf sayısı + aynı turda art arda bildiklerine +2 seri bonusu. 💡 Harf al: −3 puan
- **Modlar:** Herkes tek · 2'şer kişilik takımlar (takımın iki üyesi birlikte yazar) · Düello
- Bulmaca bitene kadar oynanır; her oyunda soru bankasından yeni bir bulmaca üretilir

## Yapı

```
PartiGame/
├── backend/    Java 21 · Spring Boot 4 · WebSocket · Maven
│   └── src/main/java/com/partigame/
│       ├── game/      GameModule / GameSession: mini oyun arayüzü
│       ├── room/      Oda, oyuncu, lobi, oyun döngüsü (30 tick/sn), parti puanı
│       ├── net/       WebSocket handler, JSON mesajları
│       └── games/     Her mini oyun kendi paketinde (pistkaosu/ ...)
└── frontend/   React 19 · TypeScript · Vite · Three.js (3D)
    └── src/
        ├── net/        WebSocket istemcisi, protokol tipleri
        ├── components/ Giriş, lobi, oyun, sonuç ekranları
        └── games/      Her mini oyunun istemci tarafı (pist-kaosu/ ...)
```

Oyun mantığı tamamen sunucuda çalışır (hileye kapalı). İstemci sadece tuş durumunu gönderir, gelen durumu yumuşatarak çizer.

## Çalıştırma

Gereksinimler: JDK 21+ ve Node.js 20+.

**Geliştirme** (iki terminal, anlık yenileme):

```bash
cd backend && ./mvnw spring-boot:run      # Windows: mvnw.cmd spring-boot:run   → :8080
cd frontend && npm install && npm run dev  # → http://localhost:5173
```

Aynı anda iki tarayıcı sekmesi açıp kendinle yarışarak test edebilirsin.

**Tek port** (yerel ağda arkadaşlarla oynamak için):

```bash
cd frontend && npm run build               # çıktıyı backend/src/main/resources/static'e yazar
cd backend && ./mvnw spring-boot:run       # → http://<bilgisayarın-ip'si>:8080
```

## Canlıya alma (Render.com, ücretsiz)

1. [render.com](https://render.com)'a GitHub hesabınla giriş yap.
2. **New → Blueprint** seç, `PartiGame` reposunu bağla. `render.yaml` otomatik okunur, **Apply**'a bas.
3. İlk derleme ~5-10 dk sürer. Sonra `https://partigame-xxxx.onrender.com` gibi bir adres verilir. Linki arkadaşlarına gönder.
4. `main` dalına her push'ta oyun kendiliğinden yeniden yayınlanır.

Not: Ücretsiz planda 15 dk kimse girmezse sunucu uyur, ilk giren ~1 dk bekler.

## Yeni mini oyun eklemek

1. **Backend:** `games/<oyun>/` altında `GameModule` implementasyonu (`@Component`) ve `GameSession` yaz.
   Lobi, oda ve puan sistemi oyunu otomatik tanır.
2. **Frontend:** `src/games/<oyun>/` altında bir `ClientGame` yaz ve `src/games/registry.ts` içindeki listeye ekle.

`GameSession` metotları oda kilidi altında tek thread'den çağrılır, senkronizasyon gerekmez.

## Mesaj protokolü (JSON / WebSocket `/ws`)

| İstemci → Sunucu | Sunucu → İstemci |
|---|---|
| `create {name}` · `join {name, code}` · `leave` | `welcome {games}` · `joined {code, playerId}` |
| `selectGame {gameId?, mode?}` · `setTeam {team}` | `room {room}`: her değişiklikte tüm oda durumu |
| `start` · `lobby` | `gameStart {gameId, mode, init}` · `state {state}` · `gameEnd {results}` |
| `input {input}` (oyuna özel) | `error {message}` |

Tipler: `frontend/src/net/protocol.ts` ↔ `backend/.../room/Messages.java`
