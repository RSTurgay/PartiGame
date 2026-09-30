package com.partigame.games.bulmaca;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CrosswordGeneratorTest {

    private static final ClueBank BANK = new ClueBank(ClueBank.load());

    @Test
    void soruBankasindakiHicbirSoruAtlanmaz() throws Exception {
        String json = new String(ClueBank.class.getResourceAsStream("/bulmaca/sorular.json").readAllBytes());
        long raw = json.chars().filter(c -> c == '{').count();
        assertEquals(raw, BANK.all().size(), "geçersiz (atlanan) soru var");
        for (int level = 1; level <= 3; level++) {
            int l = level;
            long count = BANK.all().stream().filter(c -> c.zorluk() == l).count();
            assertTrue(count >= 80, "zorluk " + level + " için soru az: " + count);
        }
    }

    @Test
    void uretilenBulmacalarGecerliVeDoludur() {
        for (Difficulty d : Difficulty.values()) {
            for (int seed = 0; seed < 30; seed++) {
                Random random = new Random(seed);
                Crossword cw = new CrosswordGenerator(random).generate(d.pool(BANK.all(), random));
                String where = d + " seed " + seed;
                assertTrue(cw.entries().size() >= 10, where + ": kelime az: " + cw.entries().size());
                assertTrue(cw.rows() <= CrosswordGenerator.MAX_DIM && cw.cols() <= CrosswordGenerator.MAX_DIM,
                        where + ": boyut " + cw.rows() + "x" + cw.cols());
                assertValid(cw, where);
            }
        }
    }

    /** Her kelimenin harfleri ızgarayla tutarlı, ızgaradaki her 2+ harflik dizi de bir kelime olmalı. */
    private static void assertValid(Crossword cw, String where) {
        char[][] g = cw.solution();
        Set<String> starts = new HashSet<>();
        Set<String> answers = new HashSet<>();
        for (Crossword.Entry e : cw.entries()) {
            assertTrue(answers.add(e.answer()), where + ": aynı cevap iki kez: " + e.answer());
            for (int i = 0; i < e.length(); i++) {
                assertEquals(e.answer().charAt(i), g[e.rowAt(i)][e.colAt(i)], where + ": " + e.answer());
            }
            starts.add(e.row() + ":" + e.col() + ":" + e.across());
        }
        for (boolean across : List.of(true, false)) {
            int outer = across ? cw.rows() : cw.cols();
            int inner = across ? cw.cols() : cw.rows();
            for (int o = 0; o < outer; o++) {
                int runStart = -1;
                for (int i = 0; i <= inner; i++) {
                    boolean filled = i < inner && (across ? g[o][i] : g[i][o]) != 0;
                    if (filled && runStart < 0) {
                        runStart = i;
                    } else if (!filled && runStart >= 0) {
                        if (i - runStart >= 2) {
                            String key = across ? o + ":" + runStart + ":true" : runStart + ":" + o + ":false";
                            assertTrue(starts.contains(key), where + ": istenmeyen harf dizisi " + key);
                        }
                        runStart = -1;
                    }
                }
            }
        }
    }

    @Test
    void numaralarOkumaSirasindaVeBirdenBaslar() {
        Random random = new Random(7);
        Crossword cw = new CrosswordGenerator(random).generate(Difficulty.KOLAY.pool(BANK.all(), random));
        int last = 0;
        for (Crossword.Entry e : cw.entries()) {
            assertTrue(e.number() == last || e.number() == last + 1, "numara sırası: " + e.number());
            last = e.number();
        }
        assertEquals(1, cw.entries().getFirst().number());
    }

    @Test
    void turkceBuyukHarfDonusumu() {
        assertEquals("İSTANBUL", TurkishText.normalize("istanbul"));
        assertEquals("ILIK", TurkishText.normalize("ılık"));
        assertEquals("ÇANAKKALE", TurkishText.normalize(" çanak-kale "));
    }
}
