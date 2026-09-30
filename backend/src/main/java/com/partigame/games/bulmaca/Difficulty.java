package com.partigame.games.bulmaca;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** Lobide seçilen zorluk; bulmacada hangi sorulardan seçileceğini belirler. */
enum Difficulty {
    KOLAY("Kolay"),
    ORTA("Orta"),
    ZOR("Zor");

    /** Bir alt seviyeden karışıma eklenen soru oranı; oyun çok bunaltıcı olmasın diye. */
    private static final double EASIER_SHARE = 0.4;

    final String label;

    Difficulty(String label) {
        this.label = label;
    }

    /** Bu zorluk için soru havuzu. Orta ve zorda bir alt seviyeden de bir miktar soru karışır. */
    List<Clue> pool(List<Clue> all, Random random) {
        int level = ordinal() + 1;
        List<Clue> pool = new ArrayList<>();
        for (Clue c : all) {
            if (c.zorluk() == level || (c.zorluk() == level - 1 && random.nextDouble() < EASIER_SHARE)) {
                pool.add(c);
            }
        }
        return pool;
    }
}
