package com.partigame.games.pistkaosu;

import com.partigame.game.GameContext;
import com.partigame.game.GameMode;
import com.partigame.game.PlayerInfo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PistKaosuSessionTest {

    private static final double DT = 1.0 / 30;
    private static final String ID = "p1";

    private final PistKaosuSession session = new PistKaosuSession(
            new GameContext(GameMode.FFA, List.of(new PlayerInfo(ID, "Test", "#ffffff", 0))));

    private void run(double seconds) {
        for (double t = 0; t < seconds; t += DT) {
            session.update(DT);
        }
    }

    private PistKaosuSession.CarView car() {
        return ((PistKaosuSession.Snapshot) session.snapshot()).cars().getFirst();
    }

    @Test
    void gazaSonAndaBasmakRoketStartVerir() {
        run(2.5);
        session.onInput(ID, Map.of("up", true));
        run(0.6);
        assertTrue(car().boost());
    }

    @Test
    void gazaErkenBasmakRoketStartVermez() {
        session.onInput(ID, Map.of("up", true));
        run(3.1);
        assertFalse(car().boost());
    }

    @Test
    void turboSeridiArabayiHizlandirir() {
        Track.BoostPad pad = Track.standard().boostPads().getFirst();
        session.onInput(ID, Map.of("up", true));
        run(3.1);
        boolean boosted = false;
        double maxSpeed = 0;
        for (int i = 0; i < 90; i++) {
            // Şeridin ortasına doğru sür (şerit pistin tam ortasında, kenardan geçen alamaz).
            PistKaosuSession.CarView c = car();
            double diff = Math.atan2(pad.y() - c.y(), pad.x() - c.x()) - c.a();
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            session.onInput(ID, Map.of("up", true, "left", diff < -0.05, "right", diff > 0.05));
            run(DT);
            boosted |= car().boost();
            maxSpeed = Math.max(maxSpeed, car().speed());
        }
        assertTrue(boosted, "Düzlükteki turbo şeridinden geçilmeli");
        assertTrue(maxSpeed > 350, "Turbo normal azami hızı (340) aşmalı: " + maxSpeed);
    }

    @Test
    void pistenCikipIlerdenDonenArabaPisteSayilirVeTuruIlerler() {
        run(3.1);
        Car car = session.car(ID);
        Track track = Track.standard();
        // Başlangıçtan geçir, sonra pistin 9 nokta ilerisine (eski ±3'lük pencerenin dışı) ışınla.
        car.x = track.xs[1];
        car.y = track.ys[1];
        run(DT);
        int before = car.passed;
        car.x = track.xs[10];
        car.y = track.ys[10];
        run(DT);
        assertTrue(car().onTrack(), "asfalttaki araba pistte sayılmalı");
        assertTrue(car.passed >= before + 8, "ilerleme yakalanmalı: " + before + " → " + car.passed);
    }

    @Test
    void cimdenUzunKestirmeIlerlemeSaymaz() {
        run(3.1);
        Car car = session.car(ID);
        Track track = Track.standard();
        car.x = track.xs[1];
        car.y = track.ys[1];
        run(DT);
        int before = car.passed;
        // Pist içindeki çimde, 30 nokta ileriye karşılık gelen bir yere geç.
        car.x = 700;
        car.y = 450;
        run(DT);
        assertFalse(car().onTrack());
        assertEquals(before, car.passed, "çimdeki araba ilerleme kazanmamalı");
    }

    @Test
    void uzunDriftBirakilincaSuperTurboVerir() {
        Car car = new Car(ID, 0, 0, 0, 0);
        car.onTrack = true;
        car.driftHeld = true;
        car.right = true;
        for (int i = 0; i < 60; i++) {
            PistKaosuSession.updateDrift(car, 250, DT);
        }
        assertTrue(car.drifting);
        assertEquals(2, car.driftLevel());

        car.driftHeld = false;
        PistKaosuSession.updateDrift(car, 250, DT);
        assertFalse(car.drifting);
        assertEquals(PistKaosuSession.SUPER_TURBO_SECONDS, car.boost);
    }

    @Test
    void kisaDriftTurboVermez() {
        Car car = new Car(ID, 0, 0, 0, 0);
        car.onTrack = true;
        car.driftHeld = true;
        car.left = true;
        for (int i = 0; i < 10; i++) {
            PistKaosuSession.updateDrift(car, 250, DT);
        }
        car.driftHeld = false;
        PistKaosuSession.updateDrift(car, 250, DT);
        assertEquals(0, car.boost);
    }

    @Test
    void cimeKacanDriftTurboKaybeder() {
        Car car = new Car(ID, 0, 0, 0, 0);
        car.onTrack = true;
        car.driftHeld = true;
        car.right = true;
        for (int i = 0; i < 40; i++) {
            PistKaosuSession.updateDrift(car, 250, DT);
        }
        car.onTrack = false;
        PistKaosuSession.updateDrift(car, 250, DT);
        assertFalse(car.drifting);
        assertEquals(0, car.boost);
    }
}
