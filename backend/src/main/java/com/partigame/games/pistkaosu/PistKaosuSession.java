package com.partigame.games.pistkaosu;

import com.partigame.game.GameContext;
import com.partigame.game.GameSession;
import com.partigame.game.PlayerInfo;
import com.partigame.game.PlayerResult;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;

final class PistKaosuSession implements GameSession {

    static final int LAPS = 3;

    private static final double COUNTDOWN_SECONDS = 3;
    /** İlk oyuncu bitirdikten sonra diğerlerine tanınan süre. */
    private static final double FINISH_GRACE_SECONDS = 20;
    private static final double MAX_RACE_SECONDS = 300;

    private static final double ACCELERATION = 420;
    private static final double BRAKE = 600;
    private static final double MAX_SPEED_TRACK = 340;
    private static final double MAX_SPEED_GRASS = 130;
    private static final double MAX_REVERSE = -140;
    private static final double ROLLING_FRICTION = 1.4;
    private static final double TURN_RATE = 3.3;
    /** Yanal tutunma: büyüdükçe araba burnunun yönüne daha hızlı hizalanır, küçüldükçe kayar. */
    private static final double GRIP_TRACK = 14;
    private static final double GRIP_GRASS = 7;
    private static final double GRIP_DRIFT = 3.2;

    private static final double DRIFT_MIN_SPEED = 170;
    /** Drift'te tuşa basılmazken dönüş gücü; iç tarafa basmak sıkılaştırır, dış tarafa basmak açar. */
    private static final double DRIFT_STEER_BASE = 0.7;
    private static final double DRIFT_STEER_RANGE = 0.4;
    private static final double MAX_SPEED_BOOST = 470;
    private static final double BOOST_ACCELERATION = 1100;
    static final double MINI_TURBO_SECONDS = 0.6;
    static final double SUPER_TURBO_SECONDS = 1.2;
    private static final double BOOST_PAD_SECONDS = 0.9;
    private static final double ROCKET_START_SECONDS = 1.0;
    /** Gaza son bu kadar saniye içinde basılmışsa roket start; daha erken basan kaçırır. */
    private static final double ROCKET_START_WINDOW = 0.8;
    /** Muza basınca saniyedeki dönüş (radyan): ~2 tam tur. */
    private static final double SPIN_RATE = 12;
    /** Kontrol noktası ararken bakılan pencere; kısa yoldan kesmeyi engeller. */
    private static final int SEARCH_WINDOW = 3;
    /**
     * Asfalta dönen araba ilerlemesini bu kadar nokta ileriden yakalayabilir (~500 birim). Çimde pencere
     * dar kalır; böylece virajda pistten çıkıp biraz ileriden dönen takılmaz ama çimden uzun kestirme işe yaramaz.
     */
    private static final int REJOIN_WINDOW = 12;
    private static final int[] POINTS_BY_PLACE = {10, 7, 5, 3, 2, 1};

    private enum Phase { COUNTDOWN, RACE, DONE }

    private final Track track = Track.standard();
    private final List<Track.BoostPad> boostPads = track.boostPads();
    private final ItemSystem items;
    private final List<PlayerInfo> players;
    private final Map<String, Car> cars = new LinkedHashMap<>();
    private Phase phase = Phase.COUNTDOWN;
    private double countdown = COUNTDOWN_SECONDS;
    private double raceTime;
    /** İlk oyuncu bitirince başlar; kalan oyuncuların süresi. */
    private boolean graceStarted;
    private double finishTimer;

    PistKaosuSession(GameContext context) {
        this(context, new Random());
    }

    /** Testler için: eşya çarkı sabit tohumla. */
    PistKaosuSession(GameContext context, Random random) {
        this.players = context.players();
        this.items = new ItemSystem(track, random);
        placeOnGrid();
        rank();
    }

    /** Arabaları başlangıç çizgisinin arkasına iki sütun halinde dizer. */
    private void placeOnGrid() {
        double heading = track.heading(0);
        double dirX = Math.cos(heading), dirY = Math.sin(heading);
        double normX = -dirY, normY = dirX;
        for (int i = 0; i < players.size(); i++) {
            int row = i / 2;
            double side = (i % 2 == 0) ? -28 : 28;
            double back = 45 + row * 55;
            double x = track.xs[0] - dirX * back + normX * side;
            double y = track.ys[0] - dirY * back + normY * side;
            PlayerInfo p = players.get(i);
            cars.put(p.id(), new Car(p.id(), p.team(), x, y, heading));
        }
    }

    @Override
    public Object initData() {
        return new Init(Track.WIDTH, Track.HEIGHT, Track.TRACK_WIDTH, LAPS, track.points(), boostPads,
                items.boxPositions(), players);
    }

    @Override
    public void onInput(String playerId, Map<String, Object> input) {
        Car car = cars.get(playerId);
        if (car == null) {
            return;
        }
        car.up = flag(input, "up");
        car.down = flag(input, "down");
        car.left = flag(input, "left");
        car.right = flag(input, "right");
        car.driftHeld = flag(input, "drift");
        car.itemPressed = flag(input, "item");
    }

    private static boolean flag(Map<String, Object> input, String key) {
        return Boolean.TRUE.equals(input.get(key));
    }

    /** Testler için. */
    Car car(String playerId) {
        return cars.get(playerId);
    }

    @Override
    public void onPlayerLeft(String playerId) {
        cars.remove(playerId);
    }

    @Override
    public void update(double dt) {
        switch (phase) {
            case COUNTDOWN -> {
                countdown -= dt;
                for (Car car : cars.values()) {
                    car.throttleHeld = car.up ? car.throttleHeld + dt : 0;
                }
                if (countdown <= 0) {
                    phase = Phase.RACE;
                    rocketStart();
                }
            }
            case RACE -> updateRace(dt);
            case DONE -> {
            }
        }
    }

    /** Gaza tam zamanında (son anda) basanlar kalkışta turbo alır. */
    private void rocketStart() {
        for (Car car : cars.values()) {
            if (car.throttleHeld > 0 && car.throttleHeld <= ROCKET_START_WINDOW) {
                car.boost = ROCKET_START_SECONDS;
            }
        }
    }

    private void updateRace(double dt) {
        raceTime += dt;
        for (Car car : cars.values()) {
            if (!car.finished) {
                drive(car, dt);
                trackProgress(car);
            } else {
                double decay = Math.max(0, 1 - 3 * dt);
                car.vx *= decay;
                car.vy *= decay;
                car.speed *= decay;
                car.drifting = false;
                car.boost = 0;
                car.spinTimer = 0;
                car.frozenTimer = 0;
                move(car, dt);
            }
        }
        items.update(cars.values(), dt);
        resolveCollisions();
        rank();

        if (graceStarted) {
            finishTimer -= dt;
        }
        boolean allFinished = cars.values().stream().allMatch(c -> c.finished);
        if (allFinished || (graceStarted && finishTimer <= 0) || raceTime >= MAX_RACE_SECONDS) {
            phase = Phase.DONE;
        }
    }

    /**
     * Hız vektörü burun yönüne göre ileri ve yan bileşenlere ayrılır. İleri bileşeni gaz/fren değiştirir,
     * yan bileşen tutunmayla söner. Araba döndüğünde hız eski yönde kalmaya çalışır; tutunma zayıfsa
     * (drift, çim) araba yana kayar.
     */
    private void drive(Car car, double dt) {
        // Pistin tamamına bakılır; sadece son kontrol noktasının çevresine bakmak, pistten çıkıp
        // ileriden dönen arabayı asfalttayken de "pist dışı" sayıyordu.
        car.onTrack = track.distanceToTrack(car.x, car.y) <= Track.TRACK_WIDTH / 2 + Track.CURB_WIDTH;
        if (car.disabled()) {
            driveDisabled(car, dt);
            return;
        }
        car.boost = Math.max(0, car.boost - dt);
        for (Track.BoostPad pad : boostPads) {
            if (pad.contains(car.x, car.y)) {
                car.boost = Math.max(car.boost, BOOST_PAD_SECONDS);
            }
        }
        boolean boosting = car.boost > 0;
        double maxSpeed = boosting ? MAX_SPEED_BOOST : car.onTrack ? MAX_SPEED_TRACK : MAX_SPEED_GRASS;

        double fx = Math.cos(car.angle), fy = Math.sin(car.angle);
        double forward = car.vx * fx + car.vy * fy;
        double lateral = -car.vx * fy + car.vy * fx;

        if (boosting) {
            forward += BOOST_ACCELERATION * dt;
        } else if (car.up) {
            forward += ACCELERATION * dt;
        } else if (car.down) {
            forward -= (forward > 0 ? BRAKE : ACCELERATION * 0.6) * dt;
        } else {
            forward *= Math.max(0, 1 - ROLLING_FRICTION * dt);
        }
        if (forward > maxSpeed) {
            // Çimde ya da turbo bitince ani durma yerine hızlıca yavaşla.
            forward = Math.max(maxSpeed, forward - 900 * dt);
        }
        forward = Math.max(MAX_REVERSE, forward);

        updateDrift(car, forward, dt);
        double grip = car.drifting ? GRIP_DRIFT : car.onTrack ? GRIP_TRACK : GRIP_GRASS;
        lateral *= Math.exp(-grip * dt);

        car.vx = fx * forward - fy * lateral;
        car.vy = fy * forward + fx * lateral;
        car.speed = forward;
        car.slip = lateral;

        // Dururken dönülmez; hız arttıkça dönüş tam güce ulaşır.
        double steer = car.steerInput();
        if (car.drifting) {
            // Drift'te araba sürekli drift yönüne döner; tuşlar sadece dönüşün sertliğini ayarlar.
            steer = car.driftDirection * (DRIFT_STEER_BASE + DRIFT_STEER_RANGE * steer * car.driftDirection);
        }
        double steerGrip = Math.min(1, Math.abs(forward) / 120) * Math.signum(forward);
        car.angle += steer * TURN_RATE * steerGrip * dt;

        move(car, dt);
    }

    /** Muza basan araba kendi etrafında döner, donan araba kayarak durur; ikisinde de kontrol yoktur. */
    private void driveDisabled(Car car, double dt) {
        car.drifting = false;
        car.driftTime = 0;
        double damping;
        if (car.spinTimer > 0) {
            car.spinTimer = Math.max(0, car.spinTimer - dt);
            car.angle += SPIN_RATE * dt;
            damping = 2.2;
        } else {
            car.frozenTimer = Math.max(0, car.frozenTimer - dt);
            damping = 4;
        }
        double decay = Math.exp(-damping * dt);
        car.vx *= decay;
        car.vy *= decay;
        car.speed = Math.hypot(car.vx, car.vy);
        car.slip = 0;
        move(car, dt);
    }

    /** Boşluk + yön ile drift başlar; bırakınca süresine göre turbo verir. */
    static void updateDrift(Car car, double forward, double dt) {
        if (!car.drifting) {
            if (car.driftHeld && car.steerInput() != 0 && forward >= DRIFT_MIN_SPEED && car.onTrack) {
                car.drifting = true;
                car.driftDirection = car.steerInput();
                car.driftTime = 0;
            }
            return;
        }
        car.driftTime += dt;
        boolean released = !car.driftHeld;
        if (released || forward < DRIFT_MIN_SPEED * 0.6 || !car.onTrack) {
            // Sadece düzgün bitirilen drift ödüllendirilir; çime kaçan ya da yavaşlayan kaybeder.
            int level = car.driftLevel();
            if (released && car.onTrack && level > 0) {
                car.boost = Math.max(car.boost, level == 1 ? MINI_TURBO_SECONDS : SUPER_TURBO_SECONDS);
            }
            car.drifting = false;
            car.driftTime = 0;
        }
    }

    private void move(Car car, double dt) {
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        double clampedX = Math.max(Car.RADIUS, Math.min(Track.WIDTH - Car.RADIUS, car.x));
        double clampedY = Math.max(Car.RADIUS, Math.min(Track.HEIGHT - Car.RADIUS, car.y));
        if (clampedX != car.x || clampedY != car.y) {
            car.vx *= 0.3;
            car.vy *= 0.3;
            car.x = clampedX;
            car.y = clampedY;
        }
    }

    /**
     * Arabanın yakınındaki segmentleri tarar; sıradaki noktayı geçmişse ilerletir.
     * Segment i, nokta i'den i+1'e uzanır; araba segment i'deyse nokta i'yi geçmiştir.
     */
    void trackProgress(Car car) {
        int bestOffset = 0;
        double bestDistance = Double.MAX_VALUE;
        int ahead = car.onTrack ? REJOIN_WINDOW : SEARCH_WINDOW;
        for (int k = -SEARCH_WINDOW; k <= ahead; k++) {
            double d = track.distanceToSegment(car.nextCheckpoint + k, car.x, car.y);
            if (d < bestDistance) {
                bestDistance = d;
                bestOffset = k;
            }
        }
        if (bestOffset >= 0 && bestDistance < Track.TRACK_WIDTH) {
            int advance = bestOffset + 1;
            car.passed += advance;
            car.nextCheckpoint = track.wrap(car.nextCheckpoint + advance);
        }

        // İlk geçiş başlangıç çizgisidir; LAPS tur = LAPS * size + 1 geçiş.
        if (car.passed >= LAPS * track.size + 1) {
            car.finished = true;
            car.finishTime = raceTime;
            if (!graceStarted) {
                graceStarted = true;
                finishTimer = FINISH_GRACE_SECONDS;
            }
        }

        int prev = track.wrap(car.nextCheckpoint - 1);
        double segLen = Math.hypot(track.xs[car.nextCheckpoint] - track.xs[prev],
                track.ys[car.nextCheckpoint] - track.ys[prev]);
        double toNext = Math.hypot(track.xs[car.nextCheckpoint] - car.x, track.ys[car.nextCheckpoint] - car.y);
        car.progress = car.passed + Math.max(0, 1 - toNext / Math.max(1, segLen));
    }

    private void resolveCollisions() {
        List<Car> list = new ArrayList<>(cars.values());
        for (int i = 0; i < list.size(); i++) {
            for (int j = i + 1; j < list.size(); j++) {
                Car a = list.get(i), b = list.get(j);
                double dx = b.x - a.x, dy = b.y - a.y;
                double dist = Math.hypot(dx, dy);
                double minDist = Car.RADIUS * 2;
                if (dist >= minDist || dist == 0) {
                    continue;
                }
                double push = (minDist - dist) / 2;
                double nx = dx / dist, ny = dy / dist;
                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;
                a.vx *= 0.85;
                a.vy *= 0.85;
                b.vx *= 0.85;
                b.vy *= 0.85;
            }
        }
    }

    private void rank() {
        List<Car> ordered = new ArrayList<>(cars.values());
        ordered.sort(RANKING);
        for (int i = 0; i < ordered.size(); i++) {
            ordered.get(i).place = i + 1;
        }
    }

    private static final Comparator<Car> RANKING = (a, b) -> {
        if (a.finished != b.finished) {
            return a.finished ? -1 : 1;
        }
        if (a.finished) {
            return Double.compare(a.finishTime, b.finishTime);
        }
        return Double.compare(b.progress, a.progress);
    };

    @Override
    public Object snapshot() {
        List<CarView> views = new ArrayList<>(cars.size());
        for (Car c : cars.values()) {
            int lap = Math.min(LAPS, Math.max(1, (c.passed - 1) / track.size + 1));
            int steer = c.finished ? 0 : c.drifting ? c.driftDirection : c.steerInput();
            int drift = c.drifting ? c.driftLevel() + 1 : 0;
            views.add(new CarView(c.playerId, round(c.x), round(c.y), round(c.angle), round(c.speed),
                    round(c.slip), steer, drift, c.boost > 0, lap, c.place, c.finished, c.onTrack,
                    c.item, c.rollTimer > 0, c.spinTimer > 0, c.frozenTimer > 0, c.shieldTimer > 0));
        }
        return new Snapshot(phase.name(), round(Math.max(0, countdown)), round(raceTime),
                graceStarted ? round(Math.max(0, finishTimer)) : -1, views,
                items.boxStates(), items.bananaPositions(), items.drainEvents());
    }

    private static double round(double v) {
        return Math.round(v * 10) / 10.0;
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.DONE;
    }

    @Override
    public List<PlayerResult> results() {
        rank();
        List<Car> ordered = new ArrayList<>(cars.values());
        ordered.sort(RANKING);
        List<PlayerResult> results = new ArrayList<>();
        for (int i = 0; i < ordered.size(); i++) {
            Car c = ordered.get(i);
            int points = i < POINTS_BY_PLACE.length ? POINTS_BY_PLACE[i] : 0;
            String detail = c.finished ? formatTime(c.finishTime) : "Bitiremedi";
            results.add(new PlayerResult(c.playerId, i + 1, points, detail));
        }
        return results;
    }

    private static String formatTime(double seconds) {
        int min = (int) (seconds / 60);
        return String.format(Locale.ROOT, "%d:%04.1f", min, seconds - min * 60);
    }

    record Init(int width, int height, double trackWidth, int laps, List<int[]> points,
                List<Track.BoostPad> boostPads, List<double[]> itemBoxes, List<PlayerInfo> players) {
    }

    /**
     * {@code boxes}: kutuların yerinde olup olmadığı (init.itemBoxes ile aynı sırada).
     * {@code events}: bu tick'te olan eşya olayları; snapshot her tick bir kez alınır, olaylar sonra silinir.
     */
    record Snapshot(String phase, double countdown, double time, double finishTimer, List<CarView> cars,
                    List<Boolean> boxes, List<double[]> bananas, List<ItemSystem.ItemEvent> events) {
    }

    /**
     * {@code slip}: yana kayma hızı (lastik izi için). {@code steer}: -1 sol, 0 düz, 1 sağ.
     * {@code drift}: 0 yok, 1 drift (şarj yok), 2 mavi, 3 turuncu turbo şarjı.
     */
    record CarView(String id, double x, double y, double a, double speed, double slip, int steer, int drift,
                   boolean boost, int lap, int place, boolean finished, boolean onTrack,
                   Item item, boolean rolling, boolean spin, boolean frozen, boolean shield) {
    }
}
