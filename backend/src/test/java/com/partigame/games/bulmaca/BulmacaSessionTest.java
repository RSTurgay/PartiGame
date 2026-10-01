package com.partigame.games.bulmaca;

import com.partigame.game.GameContext;
import com.partigame.game.GameMode;
import com.partigame.game.PlayerInfo;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BulmacaSessionTest {

    private static final ClueBank BANK = new ClueBank(ClueBank.load());
    private static final KareBank KARE_BANK = new KareBank();
    private static final double DT = 1.0 / 30;

    private static BulmacaSession session(GameMode mode, PlayerInfo... players) {
        return session(BulmacaModule.STYLE_KLASIK, mode, players);
    }

    private static BulmacaSession session(String style, GameMode mode, PlayerInfo... players) {
        return new BulmacaSession(new GameContext(mode, List.of(players),
                Map.of(BulmacaModule.OPTION_TIME, "45", BulmacaModule.OPTION_DIFFICULTY, "KOLAY",
                        BulmacaModule.OPTION_STYLE, style)),
                BANK, KARE_BANK, new Random(42));
    }

    private static PlayerInfo player(String id, int team) {
        return new PlayerInfo(id, id, "#fff", team);
    }

    private static void run(BulmacaSession s, double seconds) {
        for (double t = 0; t < seconds; t += DT) {
            s.update(DT);
        }
    }

    private static BulmacaSession.Snapshot snap(BulmacaSession s) {
        return (BulmacaSession.Snapshot) s.snapshot();
    }

    private static void answer(BulmacaSession s, String playerId, Crossword.Entry e, String text) {
        s.onInput(playerId, Map.of("action", "answer", "word", e.id(), "text", text));
    }

    /** Diğer kelimelerle kesişince kendiliğinden tamamlanmamış, hâlâ çözülebilir bir kelime. */
    private static Crossword.Entry unsolved(BulmacaSession s) {
        List<String> solvedBy = snap(s).solvedBy();
        return s.crossword().entries().stream().filter(e -> solvedBy.get(e.id()) == null).findFirst().orElseThrow();
    }

    @Test
    void siraIlkOyuncudaVeSadeceOCevaplayabilir() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0), player("b", 0));
        run(s, 3.1);
        assertEquals(List.of("a"), snap(s).turn());
        Crossword.Entry e = s.crossword().entries().getFirst();
        answer(s, "b", e, e.answer());
        assertEquals(0, s.points("b"), "sırası olmayan cevap veremez");
        answer(s, "a", e, e.answer().toLowerCase(TurkishText.TR));
        assertEquals(e.length(), s.points("a"), "küçük harfle yazılan doğru cevap kabul edilir");
    }

    @Test
    void ardArdaDogruSeriBonusuVerir() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0));
        run(s, 3.1);
        Crossword.Entry first = unsolved(s);
        answer(s, "a", first, first.answer());
        Crossword.Entry second = unsolved(s);
        answer(s, "a", second, second.answer());
        assertEquals(first.length() + second.length() + BulmacaSession.STREAK_BONUS, s.points("a"));
    }

    @Test
    void yanlisCevapPuanDusurmezVeOlayOlusturur() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0));
        run(s, 3.1);
        snap(s); // eski olayları temizle
        answer(s, "a", s.crossword().entries().getFirst(), "YANLIŞCEVAP");
        assertEquals(0, s.points("a"));
        assertTrue(snap(s).events().stream().anyMatch(ev -> ev.type().equals("wrong")));
    }

    @Test
    void harfAlmakPuanDusururAmaSifirinAltinaInmez() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0));
        run(s, 3.1);
        Crossword.Entry e = unsolved(s);
        s.onInput("a", Map.of("action", "hint", "word", e.id()));
        assertEquals(0, s.points("a"));
        String row = snap(s).grid().get(e.row());
        assertTrue(row.chars().anyMatch(Character::isLetter) || snap(s).grid().stream()
                .anyMatch(r -> r.chars().anyMatch(Character::isLetter)), "bir harf açılmalı");
    }

    @Test
    void pasVeSureDolmasiSirayiDevreder() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0), player("b", 0));
        run(s, 3.1);
        s.onInput("a", Map.of("action", "pass"));
        run(s, 2.6);
        assertEquals(List.of("b"), snap(s).turn());
        run(s, 45.1);
        run(s, 2.6);
        assertEquals(List.of("a"), snap(s).turn(), "süre dolunca sıra geçer");
        assertEquals(2, snap(s).round());
    }

    @Test
    void takimModundaIkiUyeDeCevaplayabilir() {
        BulmacaSession s = session(GameMode.TEAMS, player("a", 1), player("b", 1), player("c", 2));
        run(s, 3.1);
        assertEquals(List.of("a", "b"), snap(s).turn());
        Crossword.Entry e1 = unsolved(s);
        answer(s, "b", e1, e1.answer());
        assertEquals(e1.length(), s.points("b"));
    }

    @Test
    void sirasiOlanOyuncuCikincaSiraSonrakineGecer() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0), player("b", 0), player("c", 0));
        run(s, 3.1);
        s.onPlayerLeft("a");
        run(s, 2.6);
        assertEquals(List.of("b"), snap(s).turn());
    }

    @Test
    void tumKelimelerCozulunceOyunBiterVeSiralamaPuanaGoredir() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0), player("b", 0));
        run(s, 3.1);
        for (Crossword.Entry e : s.crossword().entries()) {
            if (snap(s).solvedBy().get(e.id()) == null) {
                answer(s, "a", e, e.answer());
            }
        }
        assertEquals(BulmacaSession.Phase.DONE, s.phase());
        assertFalse(s.isFinished(), "bitişte tamamlanmış bulmaca birkaç saniye gösterilir");
        run(s, 4.1);
        assertTrue(s.isFinished());
        assertEquals("a", s.results().getFirst().playerId());
        assertEquals(10, s.results().getFirst().points());
    }

    @Test
    void kareBulmacaOynanirVeBiter() {
        BulmacaSession s = session(BulmacaModule.STYLE_KARE, GameMode.FFA, player("a", 0));
        assertTrue(s.crossword().kare(), "gazete tipi seçilince kare bulmaca üretilmeli");
        BulmacaSession.Init init = (BulmacaSession.Init) s.initData();
        assertEquals("KARE", init.style());
        assertTrue(init.picture() != null && init.picture().image().startsWith("/bulmaca/resim/"));
        run(s, 3.1);
        for (Crossword.Entry e : s.crossword().entries()) {
            if (snap(s).solvedBy().get(e.id()) == null) {
                answer(s, "a", e, e.answer());
            }
        }
        assertEquals(BulmacaSession.Phase.DONE, s.phase());
    }

    @Test
    void kareBulmacadaResminCevabiIstemciyeGitmez() {
        BulmacaSession s = session(BulmacaModule.STYLE_KARE, GameMode.FFA, player("a", 0));
        String answer = s.crossword().picture().answer();
        BulmacaSession.Init init = (BulmacaSession.Init) s.initData();
        assertFalse(init.picture().toString().contains(answer), "resim bilgisinde cevap olmamalı");
    }

    @Test
    void cevaplarIstemciyeGonderilmez() {
        BulmacaSession s = session(GameMode.FFA, player("a", 0));
        BulmacaSession.Init init = (BulmacaSession.Init) s.initData();
        String text = init.toString();
        for (Crossword.Entry e : s.crossword().entries()) {
            assertFalse(text.contains("answer"), "init'te cevap alanı olmamalı");
        }
        assertTrue(snap(s).grid().stream().allMatch(r -> r.chars().allMatch(c -> c == '#' || c == '_')),
                "başlangıçta hiçbir harf görünmemeli");
    }
}
