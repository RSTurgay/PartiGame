package com.partigame.games.pistkaosu;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ItemSystemTest {

    private static final double DT = 1.0 / 30;

    private final ItemSystem items = new ItemSystem(Track.standard(), new Random(1));

    private static Car car(String id, int team, int place, double x, double y) {
        Car c = new Car(id, team, x, y, 0);
        c.place = place;
        return c;
    }

    private void run(List<Car> cars, double seconds) {
        for (double t = 0; t < seconds; t += DT) {
            items.update(cars, DT);
        }
    }

    @Test
    void geridekineDahaCokBuzCikar() {
        int leaderIce = 0;
        int lastIce = 0;
        for (int i = 0; i < 3000; i++) {
            if (items.roll(1, 6) == Item.ICE) {
                leaderIce++;
            }
            if (items.roll(6, 6) == Item.ICE) {
                lastIce++;
            }
        }
        assertTrue(lastIce > leaderIce * 4, "birinci: " + leaderIce + ", sonuncu: " + lastIce);
    }

    @Test
    void buzHemenOndekiRakibeGider() {
        Car first = car("a", 0, 1, 0, 0);
        Car second = car("b", 0, 2, 0, 0);
        Car third = car("c", 0, 3, 0, 0);
        List<Car> cars = List.of(first, second, third);
        assertSame(second, ItemSystem.iceTarget(third, cars));
        assertSame(second, ItemSystem.iceTarget(first, cars), "birinci arkasındakini dondurur");
    }

    @Test
    void buzTakimArkadasinaGitmez() {
        Car first = car("a", 1, 1, 0, 0);
        Car teammate = car("b", 2, 2, 0, 0);
        Car me = car("c", 2, 3, 0, 0);
        assertSame(first, ItemSystem.iceTarget(me, List.of(first, teammate, me)));
    }

    @Test
    void kutudanGecinceCarkSonrasiEsyaGelir() {
        ItemSystem.ItemBox box = items.boxes.getFirst();
        Car c = car("a", 0, 1, box.x, box.y);
        run(List.of(c), DT);
        assertNull(c.item);
        assertNotNull(c.pendingItem);
        assertTrue(!box.active());

        run(List.of(c), ItemSystem.ROLL_SECONDS + 0.1);
        assertNotNull(c.item);

        // Araba kutunun üstünden çekilince kutu süresi dolunca geri gelir.
        c.x += 500;
        run(List.of(c), ItemSystem.BOX_RESPAWN_SECONDS);
        assertTrue(box.active(), "kutu " + ItemSystem.BOX_RESPAWN_SECONDS + " sn sonra geri gelmeli");
    }

    @Test
    void muzaBasanDoner() {
        Car owner = car("a", 0, 1, 500, 500);
        owner.item = Item.BANANA;
        owner.itemPressed = true;
        run(List.of(owner), DT);
        assertEquals(1, items.bananas.size());

        ItemSystem.Banana banana = items.bananas.getFirst();
        Car victim = car("b", 0, 2, banana.x, banana.y);
        run(List.of(owner, victim), DT);
        assertTrue(victim.spinTimer > 0);
        assertTrue(items.bananas.isEmpty());
    }

    @Test
    void kalkanBuzuEngeller() {
        Car attacker = car("a", 0, 2, 0, 0);
        Car leader = car("b", 0, 1, 0, 0);
        leader.shieldTimer = ItemSystem.SHIELD_SECONDS;
        attacker.item = Item.ICE;
        attacker.itemPressed = true;
        run(List.of(attacker, leader), DT);
        assertEquals(0, leader.frozenTimer);
        assertEquals(0, leader.shieldTimer, "kalkan bir saldırıda tükenir");
    }

    @Test
    void basiliTutmakEsyayiTekrarKullanmaz() {
        Car c = car("a", 0, 1, 500, 500);
        c.item = Item.TURBO;
        c.itemPressed = true;
        run(List.of(c), DT);
        assertTrue(c.boost > 0);
        assertNull(c.item);

        c.item = Item.TURBO;
        run(List.of(c), DT);
        assertEquals(Item.TURBO, c.item, "tuş bırakılıp tekrar basılmadan kullanılmamalı");
    }
}
