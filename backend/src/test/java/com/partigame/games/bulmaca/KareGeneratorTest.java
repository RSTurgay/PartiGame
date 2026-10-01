package com.partigame.games.bulmaca;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KareGeneratorTest {

    private static final KareBank BANK = new KareBank();
    private static final int SAMPLES = 30;

    @Test
    void kareBulmacalarTamamenDoluVeGecerlidir() {
        int ok = 0;
        long totalMs = 0;
        long worstMs = 0;
        for (int seed = 0; seed < SAMPLES; seed++) {
            Random random = new Random(seed);
            Picture picture = BANK.pictures().get(random.nextInt(BANK.pictures().size()));
            long t0 = System.currentTimeMillis();
            Crossword cw = new KareGenerator(random, BANK.clues()).generate(picture);
            long ms = System.currentTimeMillis() - t0;
            totalMs += ms;
            worstMs = Math.max(worstMs, ms);
            if (cw != null) {
                ok++;
                assertValid(cw, picture, "seed " + seed);
            }
        }
        System.out.printf("KARE: %d/%d başarılı, ortalama %d ms, en kötü %d ms%n",
                ok, SAMPLES, totalMs / SAMPLES, worstMs);
        assertEquals(SAMPLES, ok, "her bulmaca doldurulabilmeli");
    }

    @Test
    void ipuclariKutuyaSigarVeResimlerLisansliDir() {
        for (var e : BANK.clues().entrySet()) {
            for (String clue : e.getValue()) {
                assertTrue(clue.length() <= 30, "ipucu kutuya sığmayacak kadar uzun: " + e.getKey() + " / " + clue);
                assertTrue(clue.length() >= 2 && !clue.equalsIgnoreCase("x"), "yer tutucu ipucu: " + e.getKey());
            }
        }
        assertTrue(BANK.clues().size() >= 1200, "kelime bankası küçük: " + BANK.clues().size());
        assertTrue(BANK.pictures().size() >= 40, "resimli soru az: " + BANK.pictures().size());
        for (Picture p : BANK.pictures()) {
            assertTrue(java.nio.file.Files.exists(java.nio.file.Path.of("../frontend/public" + p.image())),
                    "resim dosyası yok: " + p.image());
            assertTrue(!p.author().isBlank() && !p.license().isBlank() && p.source().startsWith("https://"),
                    "lisans bilgisi eksik: " + p.answer());
            assertTrue(p.answer().length() <= KareGenerator.COLS - KareGenerator.IMAGE, "resim cevabı uzun: " + p.answer());
        }
    }

    private static void assertValid(Crossword cw, Picture picture, String where) {
        char[][] g = cw.solution();
        List<String> layout = cw.layout();
        Set<String> answers = new HashSet<>();
        // Boş hücre yok: her hücre harf, soru kutusu ya da resim.
        for (int r = 0; r < cw.rows(); r++) {
            for (int c = 0; c < cw.cols(); c++) {
                char kind = layout.get(r).charAt(c);
                assertTrue("LCI".indexOf(kind) >= 0, where);
                if (kind == KareGenerator.LETTER) {
                    assertTrue(g[r][c] != 0, where + ": boş harf hücresi " + r + "," + c);
                }
            }
        }
        boolean pictureFound = false;
        for (Crossword.Entry e : cw.entries()) {
            assertTrue(answers.add(e.answer()), where + ": tekrar eden cevap " + e.answer());
            if (e.clueRow() < 0) {
                pictureFound = true;
                assertEquals(picture.answer(), e.answer());
            } else {
                assertEquals(KareGenerator.CLUE, layout.get(e.clueRow()).charAt(e.clueCol()), where);
                assertNotNull(e.clue());
            }
        }
        assertTrue(pictureFound, where + ": resim sorusu yok");
    }
}
