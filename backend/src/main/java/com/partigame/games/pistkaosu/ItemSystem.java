package com.partigame.games.pistkaosu;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Sürpriz kutuları, yerdeki muzlar ve eşya kullanımı. Kutular pistin belirli noktalarında
 * yan yana dizilir; alınan kutu bir süre sonra geri gelir.
 */
final class ItemSystem {

    static final double ROLL_SECONDS = 1.0;
    static final double BOX_RESPAWN_SECONDS = 3;
    static final double BOX_RADIUS = 14;
    static final double BANANA_RADIUS = 10;
    static final int MAX_BANANAS = 12;
    static final double BANANA_LIFETIME_SECONDS = 45;
    /** Muzu bırakan, hemen kendi muzuna basmasın. */
    static final double OWNER_IMMUNITY_SECONDS = 1.0;
    static final double SPIN_SECONDS = 1.1;
    static final double FREEZE_SECONDS = 1.5;
    static final double SHIELD_SECONDS = 8;
    static final double TURBO_SECONDS = 1.2;

    /** Kutu sıralarının bulunduğu pist noktaları ve sıradaki kutuların orta çizgiye uzaklıkları. */
    private static final int[] BOX_ROW_POINTS = {35, 75, 115};
    private static final double[] BOX_OFFSETS = {-42, -14, 14, 42};

    /** Birinci ve sonuncu için eşya ağırlıkları; aradakiler doğrusal karışım alır. */
    private static final Map<Item, Integer> LEADER_WEIGHTS = weights(20, 45, 5, 30);
    private static final Map<Item, Integer> LAST_WEIGHTS = weights(40, 10, 40, 10);

    final List<ItemBox> boxes = new ArrayList<>();
    final List<Banana> bananas = new ArrayList<>();
    /** Son snapshot'tan beri olan olaylar; istemcide mesaj ve efekt için. */
    private final List<ItemEvent> events = new ArrayList<>();
    private final Random random;

    ItemSystem(Track track, Random random) {
        this.random = random;
        for (int point : BOX_ROW_POINTS) {
            double heading = track.heading(point);
            double nx = -Math.sin(heading), ny = Math.cos(heading);
            for (double offset : BOX_OFFSETS) {
                boxes.add(new ItemBox(track.xs[point] + nx * offset, track.ys[point] + ny * offset));
            }
        }
    }

    void update(Collection<Car> cars, double dt) {
        for (ItemBox box : boxes) {
            box.respawn = Math.max(0, box.respawn - dt);
        }
        for (Iterator<Banana> it = bananas.iterator(); it.hasNext(); ) {
            Banana b = it.next();
            b.age += dt;
            if (b.age > BANANA_LIFETIME_SECONDS) {
                it.remove();
            }
        }

        for (Car car : cars) {
            if (car.finished) {
                continue;
            }
            car.shieldTimer = Math.max(0, car.shieldTimer - dt);
            if (car.rollTimer > 0) {
                car.rollTimer -= dt;
                if (car.rollTimer <= 0) {
                    car.item = car.pendingItem;
                    car.pendingItem = null;
                }
            }
            pickUpBoxes(car, cars.size());
            hitBananas(car);
            // Tuşa basıldığı an kullanılır; basılı tutmak tekrar kullanmaz.
            if (car.itemPressed && !car.itemWasPressed && car.item != null) {
                use(car, cars);
            }
            car.itemWasPressed = car.itemPressed;
        }
    }

    private void pickUpBoxes(Car car, int carCount) {
        for (ItemBox box : boxes) {
            if (box.active() && Math.hypot(box.x - car.x, box.y - car.y) < Car.RADIUS + BOX_RADIUS) {
                box.respawn = BOX_RESPAWN_SECONDS;
                // Elinde eşya varken kutu yine kırılır ama yeni eşya gelmez.
                if (car.item == null && car.pendingItem == null) {
                    car.pendingItem = roll(car.place, carCount);
                    car.rollTimer = ROLL_SECONDS;
                    events.add(new ItemEvent("pickup", car.playerId, null, null));
                }
            }
        }
    }

    private void hitBananas(Car car) {
        for (Iterator<Banana> it = bananas.iterator(); it.hasNext(); ) {
            Banana b = it.next();
            boolean immune = b.ownerId.equals(car.playerId) && b.age < OWNER_IMMUNITY_SECONDS;
            if (!immune && Math.hypot(b.x - car.x, b.y - car.y) < Car.RADIUS + BANANA_RADIUS) {
                it.remove();
                hit(car, Item.BANANA, b.ownerId);
            }
        }
    }

    /** Sıraya göre ağırlıklı rastgele eşya: öndekine savunma, geridekine saldırı ve turbo. */
    Item roll(int place, int carCount) {
        double f = carCount <= 1 ? 0.5 : (place - 1) / (double) (carCount - 1);
        double total = 0;
        Map<Item, Double> mixed = new EnumMap<>(Item.class);
        for (Item item : Item.values()) {
            double w = LEADER_WEIGHTS.get(item) + (LAST_WEIGHTS.get(item) - LEADER_WEIGHTS.get(item)) * f;
            mixed.put(item, w);
            total += w;
        }
        double r = random.nextDouble() * total;
        for (Map.Entry<Item, Double> e : mixed.entrySet()) {
            r -= e.getValue();
            if (r < 0) {
                return e.getKey();
            }
        }
        return Item.TURBO;
    }

    private void use(Car car, Collection<Car> cars) {
        Item item = car.item;
        car.item = null;
        String target = null;
        switch (item) {
            case TURBO -> car.boost = Math.max(car.boost, TURBO_SECONDS);
            case BANANA -> {
                double back = Car.RADIUS + BANANA_RADIUS + 6;
                bananas.add(new Banana(car.x - Math.cos(car.angle) * back, car.y - Math.sin(car.angle) * back,
                        car.playerId));
                if (bananas.size() > MAX_BANANAS) {
                    bananas.removeFirst();
                }
            }
            case ICE -> {
                Car victim = iceTarget(car, cars);
                if (victim != null) {
                    target = victim.playerId;
                    hit(victim, Item.ICE, car.playerId);
                }
            }
            case SHIELD -> car.shieldTimer = SHIELD_SECONDS;
        }
        events.add(new ItemEvent("use", car.playerId, item.name(), target));
    }

    /** Hemen öndeki rakip; birinciyse hemen arkadaki. Takım arkadaşı hedef olmaz. */
    static Car iceTarget(Car car, Collection<Car> cars) {
        Car ahead = null;
        Car behind = null;
        for (Car other : cars) {
            if (other == car || other.finished || (car.team != 0 && other.team == car.team)) {
                continue;
            }
            if (other.place < car.place && (ahead == null || other.place > ahead.place)) {
                ahead = other;
            } else if (other.place > car.place && (behind == null || other.place < behind.place)) {
                behind = other;
            }
        }
        return ahead != null ? ahead : behind;
    }

    private void hit(Car car, Item kind, String attackerId) {
        if (car.shieldTimer > 0) {
            car.shieldTimer = 0;
            events.add(new ItemEvent("block", car.playerId, kind.name(), attackerId));
            return;
        }
        car.drifting = false;
        car.driftTime = 0;
        car.boost = 0;
        if (kind == Item.BANANA) {
            car.spinTimer = SPIN_SECONDS;
        } else {
            car.frozenTimer = FREEZE_SECONDS;
        }
        events.add(new ItemEvent("hit", car.playerId, kind.name(), attackerId));
    }

    /** Birikmiş olayları verir ve temizler; her snapshot'ta bir kez çağrılır. */
    List<ItemEvent> drainEvents() {
        List<ItemEvent> copy = List.copyOf(events);
        events.clear();
        return copy;
    }

    List<double[]> boxPositions() {
        return boxes.stream().map(b -> new double[]{b.x, b.y}).toList();
    }

    List<Boolean> boxStates() {
        return boxes.stream().map(ItemBox::active).toList();
    }

    List<double[]> bananaPositions() {
        return bananas.stream().map(b -> new double[]{Math.round(b.x), Math.round(b.y)}).toList();
    }

    private static Map<Item, Integer> weights(int turbo, int banana, int ice, int shield) {
        Map<Item, Integer> map = new EnumMap<>(Item.class);
        map.put(Item.TURBO, turbo);
        map.put(Item.BANANA, banana);
        map.put(Item.ICE, ice);
        map.put(Item.SHIELD, shield);
        return map;
    }

    static final class ItemBox {
        final double x;
        final double y;
        /** Geri gelmesine kalan süre; 0 ise kutu yerinde. */
        double respawn;

        ItemBox(double x, double y) {
            this.x = x;
            this.y = y;
        }

        boolean active() {
            return respawn <= 0;
        }
    }

    static final class Banana {
        final double x;
        final double y;
        final String ownerId;
        double age;

        Banana(double x, double y, String ownerId) {
            this.x = x;
            this.y = y;
            this.ownerId = ownerId;
        }
    }

    /**
     * {@code type}: pickup (kutu alındı), use (eşya kullanıldı), hit (isabet), block (kalkan engelledi).
     * {@code other}: use/ICE'da hedef, hit/block'ta saldıran.
     */
    record ItemEvent(String type, String playerId, String item, String other) {
    }
}
